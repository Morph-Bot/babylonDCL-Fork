# State of this implementation

# Implemented features

- CRDT protocol for scenes ([ADR-117](https://adr.decentraland.org/adr/ADR-117))
  - [x] Message handling (serialization & deserialization)
  - [x] LastWriteWins-Element-Set
  - [x] GrowOnly-Value-Set
- Synchronization of CRDT messages between scenes and Renderer ([ADR-148](https://adr.decentraland.org/adr/ADR-148))
  - [x] Distance-to-scene based processing prioritization
  - [x] Scene "Tick"
- Loading scenes
  - [-] Scene runtime ([ADR-133](https://adr.decentraland.org/adr/ADR-133))
    - [-] RuntimeApi
      - [ ] update ADR
      - [x] `getSceneInformation`
      - [ ] `getRealm`
      - [ ] `getWorldTime`
      - [x] `readFile`
    - [x] EngineApi
      - [ ] update ADR
      - [x] getInitialState
      - [x] crdtSendToRenderer
    - [x] setImmediate
    - [ ] fetch
    - [ ] WebSocket
  - [x] Rapid scene culling (LAND based scenes)
  - [ ] Loading global scenes
- [ ] Player locomotion
  - [ ] First person camera
  - [ ] Third person camera
  - [ ] Jump
- [-] Loading the world
  - [x] Load entities using URNs ([ADR-207](https://adr.decentraland.org/adr/ADR-207)
  - [x] Resolve a realm URL ([ADR-144](https://adr.decentraland.org/adr/ADR-144))
    - [x] Fetching information about the realm ([ADR-110](https://adr.decentraland.org/adr/ADR-110))
    - [x] Load a realm with static scenes (`sceneUrns`) ([ADR-111](https://adr.decentraland.org/adr/ADR-111))
  - [ ] Realm with city loading
- [ ] Communications
  - [ ] update ADR
  - [ ] Parse communications connection strings [ADR-180](https://adr.decentraland.org/adr/ADR-180)
    - [ ] Connect WebSocket transport ([ADR-105](https://adr.decentraland.org/adr/ADR-105))
    - [ ] Exposing transports to avatars scenes [ADR-?]
      - [ ] create ADR
- [ ] Rendering Avatars
  - [ ] Playing emotes
  - [ ] Attaching points for avatars

# SDK Components
- [x] Transform component ([ADR-153](https://adr.decentraland.org/adr/ADR-153))
  - [x] update ADR
  - [x] throrough tests
  - [x] Handle cycles
- [x] Billboard component ([ADR-198](https://adr.decentraland.org/adr/ADR-198))
  - [x] update ADR
  - [ ] throrough tests
- [x] Raycast & RaycastResult components ([ADR-200](https://adr.decentraland.org/adr/ADR-200))
  - [ ] update ADR
  - [ ] throrough tests
  - [x] local direction
  - [x] global direction
  - [x] global target
  - [x] entity target
  - [x] continous mode
  - [x] query_all
  - [x] query_first
  - [x] query_none
- [ ] MeshRenderer component [ADR-?]
- [ ] MeshCollider component [ADR-?]
- [ ] PointerEvents & PointerEventsResult components ([ADR-125](https://adr.decentraland.org/adr/ADR-125)) & ([ADR-200](https://adr.decentraland.org/adr/ADR-200))
- [ ] GltfContainer component [ADR-?]
- [ ] Animator component [ADR-?]
- [ ] Cinematic Camera Component [ADR-?]
- [ ] AvatarAttach Component [ADR-?]
- [ ] AudioSource Component [ADR-?]
- [ ] AudioStream Component [ADR-?]
- [ ] AudioStream Component [ADR-?]
- [ ] CameraMode Component [ADR-?]
- [ ] CameraModeArea Component [ADR-?]
- [ ] Material Component [ADR-?]
  - [ ] Basic material
  - [ ] PBR Material
  - [ ] Reuse materials
- [ ] TextShape Component [ADR-?]
- [ ] PointerLock Component [ADR-?]
- [ ] VideoPlayer Component [ADR-?]
- [ ] Visibility Component [ADR-?]

## SDK User Interface
- [ ] UiTransform Component ([ADR-124](https://adr.decentraland.org/adr/ADR-124))
  - [ ] Implement flexbox
  - [ ] UI Rendering order ([ADR-151](https://adr.decentraland.org/adr/ADR-151))
- [ ] UiBackground Component ([ADR-125](https://adr.decentraland.org/adr/ADR-125))
- [ ] UiLabel Component ([ADR-125](https://adr.decentraland.org/adr/ADR-125))
- [ ] UiText Component ([ADR-125](https://adr.decentraland.org/adr/ADR-125))
- [ ] UiInput & UiInputResult Component ([ADR-125](https://adr.decentraland.org/adr/ADR-125))
- [ ] UiDropdown & UiDropdownResult Component ([ADR-125](https://adr.decentraland.org/adr/ADR-125))

## Static entities
- [ ] Create ADR
- [ ] CameraEntity
  - [x] TransformComponent
  - [ ] PointerLock component
- [ ] RootEntity
  - ... components (including UI)
- [ ] Player entity
  - [x] TransformComponent

# Pending tests

Babylon
- When a SceneContext is disposed, all entities should be deleted
- When an entity is deleted all components should be disposed
- When a component is removed all resources should be disposed