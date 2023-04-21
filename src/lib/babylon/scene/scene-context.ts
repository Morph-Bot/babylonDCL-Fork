import * as BABYLON from '@babylonjs/core'
import future, { IFuture } from 'fp-future'
import { Entity } from '../../decentraland/types'

import { EngineApiInterface } from '../../decentraland/scene/types'
import { CrdtMessageType, readAllMessages } from '../../decentraland/crdt-wire-protocol'
import { ByteBuffer, ReadWriteByteBuffer } from '../../decentraland/ByteBuffer'
import { LoadableScene, resolveFile, resolveFileAbsolute } from '../../decentraland/scene/content-server-entity'
import { BabylonEntity } from './entity'
import { transformComponent } from '../../decentraland/sdk-components/transform-component'
import { createLwwStore } from '../../decentraland/crdt-internal/last-write-win-element-set'
import { BaseComponent, ComponentDefinition } from '../../decentraland/crdt-internal/components'
import { resolveCyclicParening } from './logic/cyclic-transform'
import { Vector3 } from '@babylonjs/core'
import { Scene } from '@dcl/schemas'
import { billboardComponent } from '../../decentraland/sdk-components/billboard-component'
import { raycastComponent, raycastResultComponent } from '../../decentraland/sdk-components/raycast-component'
import { meshRendererComponent } from '../../decentraland/sdk-components/mesh-renderer-component'
import { processRaycasts } from './logic/raycasts'
import { meshColliderComponent } from '../../decentraland/sdk-components/mesh-collider-component'
import { PARCEL_SIZE_METERS, gridToWorld, parseParcelPosition } from '../../decentraland/positions'
import { createParcelOutline } from '../visual/parcelOutline'
import { CrdtGetStateResponse, CrdtSendToRendererRequest, CrdtSendToResponse } from '@dcl/protocol/out-ts/decentraland/kernel/apis/engine_api.gen'
import { gltfContainerComponent } from '../../decentraland/sdk-components/gltf-component'
import { AssetManager } from './asset-manager'
import { pointerEventsComponent } from '../../decentraland/sdk-components/pointer-events'
import { StaticEntities, updateStaticEntities } from './logic/static-entities'
import { animatorComponent } from '../../decentraland/sdk-components/animator-component'

export class SceneContext implements EngineApiInterface {
  entities = new Map<Entity, BabylonEntity>()
  #ref = new WeakRef(this)
  rootNode: BabylonEntity

  // this future is resolved when the scene is disposed
  readonly stopped = future<void>()

  // after the "tick" is completed, resolving the futures will send back the CRDT
  // updates to the scripting scene
  nextFrameFutures: Array<IFuture<{ data: Array<Uint8Array> }>> = []
  // stash of incoming CRDT messages from the scripting scene, processed using a
  // quota each renderer frame. ByteBuffer reading is continuable using iterators.
  incomingMessages: ByteBuffer[] = []
  // stash of outgoing messages ready to be sent to back to the scripting scene
  outgoingMessagesBuffer: ByteBuffer = new ReadWriteByteBuffer()
  // when we finish to process all the income messages of a tick, 
  // set finishedProcessingFrame to true to send the outgoing messages, then to false.
  finishedProcessingFrame: boolean = false

  // the follwing set contains a list of pending raycast queries. if a query is continous,
  // it won't be removed from the set
  pendingRaycastOperations = new Set<Entity>()

  // log function for tests
  log: (message: string) => void = () => void 0

  components = {
    [transformComponent.componentId]: createLwwStore(transformComponent),
    [billboardComponent.componentId]: createLwwStore(billboardComponent),
    [raycastComponent.componentId]: createLwwStore(raycastComponent),
    [raycastResultComponent.componentId]: createLwwStore(raycastResultComponent),
    [meshRendererComponent.componentId]: createLwwStore(meshRendererComponent),
    [meshColliderComponent.componentId]: createLwwStore(meshColliderComponent),
    [gltfContainerComponent.componentId]: createLwwStore(gltfContainerComponent),
    [pointerEventsComponent.componentId]: createLwwStore(pointerEventsComponent),
    [animatorComponent.componentId]: createLwwStore(animatorComponent),
  } as const

  // this flag is changed every time an entity changed its parent. the change
  // in the hierarchy is not immediately applied, instead, it should be queued
  // in the unparentedEntities set. Once there, at the end of the "tick", the
  // scene will perform all possible acyclic updates of entities to prevent
  // breaking the Babylon's hierarcy and generating stack overflows while calculating
  // the world matrix of the entitiesg
  hierarchyChanged: boolean = false
  unparentedEntities = new Set<Entity>

  // the assetmanager is used to centralize all the loadinng/unloading of assets
  // of this scene. 
  assetManager = new AssetManager(this)

  // bounding vectors to calculate the distance to the outer bounds of the scene
  // for the throttling mechanism
  boundingBox?: BABYLON.BoundingBox

  constructor(public babylonScene: BABYLON.Scene, public loadableScene: LoadableScene) {
    this.rootNode = this.getOrCreateEntity(StaticEntities.RootEntity)

    // the rootNode must be positioned according to the value of the "scenes.base" of the scene metadata (scene.json)
    const metadata = loadableScene.entity.metadata as Scene
    if (metadata.scene?.base) {
      const base = parseParcelPosition(metadata.scene.base)
      this.rootNode.name = metadata.scene.base
      gridToWorld(base.x, base.y, this.rootNode.position)

      const r = createParcelOutline(babylonScene, metadata.scene.base, metadata.scene.parcels)
      r.result.parent = this.rootNode
    }

    // calculate a naive bounding box for the scene to calculate the distance to the outer bounds
    // and use that distance to prioritize the message quota for ADR-148
    if (metadata.scene?.parcels) {
      let minX: number | null = null
      let minZ: number | null = null
      let maxX: number | null = null
      let maxZ: number | null = null
      for (const position of metadata.scene.parcels) {
        const vec = parseParcelPosition(position)
        if (minX == null || vec.x < minX) minX = vec.x
        if (minZ == null || vec.y < minZ) minZ = vec.y
        if (maxX == null || vec.x > maxX) maxX = vec.x
        if (maxZ == null || vec.y > maxZ) maxZ = vec.y
      }

      // as per https://docs.decentraland.org/creator/development-guide/scene-limitations/
      const height = Math.log2(metadata.scene.parcels.length + 1) * 20

      if (minX) {
        this.boundingBox = new BABYLON.BoundingBox(
          new Vector3(minX! * PARCEL_SIZE_METERS, -1, minZ! * PARCEL_SIZE_METERS),
          new Vector3((maxX! + 1) * PARCEL_SIZE_METERS, height, (maxZ! + 1) * PARCEL_SIZE_METERS)
        )
      }
    }
  }

  // naivest implementation of the distance to the outer bounds of the scene
  distanceToPoint(point: BABYLON.Vector3) {
    if (!this.boundingBox) return 0
    if (this.boundingBox?.intersectsPoint(point)) return 0
    return this.boundingBox?.centerWorld.subtract(point).length()
  }

  removeEntity(entityId: Entity) {
    const entity = this.getEntityOrNull(entityId)
    if (entity) {
      entity.dispose()
      this.entities.delete(entityId)
      this.unparentedEntities.delete(entityId)
    }
  }

  getOrCreateEntity(entityId: Entity): BabylonEntity {
    let entity = this.entities.get(entityId)
    if (!entity) {
      entity = new BabylonEntity(entityId, this.#ref)
      // every new entity is parented to the scene's rootEntity by default
      entity.parent = this.rootNode
      this.entities.set(entityId, entity)
    }
    return entity
  }

  getEntityOrNull(entityId: Entity): BabylonEntity | null {
    return this.entities.get(entityId) || null
  }

  /**
   * The "update" function handles all the incoming messages from the scene and
   * applies the changes to the renderer entities.
   * 
   * This function is declared as a property to be added and removed to the
   * rendering engine without binding the SceneContext object.
   * 
   * Returns false if the quota was exceeded. True if there is still time to continue
   * processing more messages, similar to cooperative scheduling.
   */
  update(hasQuota: () => boolean) {
    // process all the incoming messages
    while (this.incomingMessages.length) {
      const message = this.incomingMessages[0]

      for (const crdtMessage of readAllMessages(message)) {
        // STUB create or delete entities based on putComponent and deleteEntity
        switch (crdtMessage.type) {
          case CrdtMessageType.DELETE_COMPONENT:
          case CrdtMessageType.PUT_COMPONENT: {
            const entity = this.getOrCreateEntity(crdtMessage.entityId)
            const component = (this.components as any)[crdtMessage.componentId] as ComponentDefinition<any> | void

            // if the change is accepted, then we instruct the entity to update its internal state
            // via putComponent or deleteComponent calls
            if (component && component.updateFromCrdt(crdtMessage, this.outgoingMessagesBuffer)) {
              if (crdtMessage.type === CrdtMessageType.PUT_COMPONENT)
                entity.putComponent(component)
              else
                entity.deleteComponent(component)

              component.declaration.applyChanges(entity, component)
            }

            break
          }
          case CrdtMessageType.DELETE_ENTITY: {
            this.removeEntity(crdtMessage.entityId)
            break
          }
        }

        // if we exceeded the quota, finish the processing of this "message" and yield
        // the execution control back to the event loop
        if (!hasQuota()) {
          return false
        }
      }

      // at this point, the whole "message" was consumed, we proceed to its removal
      this.incomingMessages.shift()

      // this process resolves the re parenting of all entities preventing cycles
      resolveCyclicParening(this)
    }

    // mark the frame as processed. this signals the lateUpdate to respond to the scene with updates
    this.finishedProcessingFrame = true
    return true
  }

  /**
   * lateUpdate should run in each frame AFTER the physics are processed. This is described
   * in ADR-148.
   * 
   * The lateUpdate function is declared as a property to be added and removed to the
   * rendering engine without binding the SceneContext object.
   */
  lateUpdate() {
    // only emit messages if there are receiver promises
    if (!this.nextFrameFutures.length) return

    // only finalize the frame once the incoming messages were cleared
    if (!this.finishedProcessingFrame) return
    this.finishedProcessingFrame = false

    const outMessages: Uint8Array[] = []

    processRaycasts(this)

    // TODO: Execute queries into this.outgoingMessages
    // TODO: Collect events into this.outgoingMessages

    // update the components of the static entities to be sent to the scene
    this.updateStaticEntities()

    // write all the CRDT updates in the outgoingMessagesBuffer
    for (const component of Object.values(this.components)) {
      component.dumpCrdtUpdates(this.outgoingMessagesBuffer)
    }

    if (this.outgoingMessagesBuffer.currentWriteOffset()) {
      outMessages.push(this.outgoingMessagesBuffer.toBinary())
      this.outgoingMessagesBuffer.incrementWriteOffset(-this.outgoingMessagesBuffer.currentWriteOffset())
      this.outgoingMessagesBuffer.incrementReadOffset(-this.outgoingMessagesBuffer.currentReadOffset())
    }

    // finally resolve the future so the function "receiveBatch" is unblocked
    // and the next scripting frame is allowed to happen
    this.nextFrameFutures.forEach((fut) => fut.resolve({ data: outMessages }))

    // finally clean the futures
    this.nextFrameFutures.length = 0
  }

  dispose() {
    for (const [entityId] of this.entities) {
      this.removeEntity(entityId)
    }

    this.stopped.resolve()

    this.assetManager.dispose()
    this.rootNode.parent = null
    this.rootNode.dispose()
  }

  // this method exists to be a wrapper of the function. so it can be mocked for tests without
  // wizzardy
  updateStaticEntities() {
    updateStaticEntities(this)
  }

  // impl RuntimeApi {
  async readFile(file: string): Promise<{ content: Uint8Array, hash: string }> {
    // this method resolves a file deployed with the entity. it returns the content of the file and its hash
    const hash = resolveFile(this.loadableScene.entity, file)
    if (!hash) throw new Error(`File not found: ${file}`)

    const absoluteLocation = resolveFileAbsolute(this.loadableScene, file)
    if (!absoluteLocation) throw new Error(`File not found: ${file}`)

    const result = await fetch(absoluteLocation).then($ => $.arrayBuffer())

    return { content: new Uint8Array(result), hash }
  }
  // }

  // impl EngineApiInterface {
  async crdtGetState(): Promise<CrdtGetStateResponse> {

    // update the components of the static entities to be sent to the scene
    this.updateStaticEntities()

    // dump all the content of the components into a single outgoing buffer
    const outgoingMessages = new ReadWriteByteBuffer()
    for (const component of Object.values(this.components)) {
      component.dumpCrdtUpdates(outgoingMessages)
    }

    return { hasEntities: false, data: [outgoingMessages.toBinary()] }
  }
  async crdtSendToRenderer(payload: CrdtSendToRendererRequest): Promise<CrdtSendToResponse> {
    if (payload.data.byteLength) {
      this.incomingMessages.push(new ReadWriteByteBuffer(payload.data))
    }

    // create a future to wait until all the messages are processed. even if there
    // are no updates, we must return the future for CRDT updates like the camera
    // position
    const fut = future<CrdtSendToResponse>()
    this.nextFrameFutures.push(fut)
    return fut
  }
  // }
}