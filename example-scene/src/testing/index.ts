import { engine } from "@dcl/sdk/ecs"
import { createTestRuntime } from "./runtime"
import { TestDefinitionFunction, TestingModule } from "./types"

declare var require: any

/**
 * In development builds, this function serves as test runner for automated test scenarios
 * if the runtime accepts the `~system/Testing` module
 * @public
 */
/* @__PURE__ */
export const test: TestDefinitionFunction = DEBUG ? /* @__PURE__ */ createTestFunction() : /* @__PURE__ */ () => { }

function createTestFunction() {
  let testingModule: TestingModule
  try {
    testingModule = /* @__PURE__ */ require('~system/Testing')
  } catch (err) {
    console.error(err)

    console.error(`🔴🚨‼️ WARNING: The test runner is not available. The test runner will be mocked. ‼️🚨🔴`)

    testingModule = {
      async logResult(data) {
        console.log(`mocked '~system/Testing'.logResult`, data)
        return {}
      },
      async plan(data) {
        console.log(`mocked '~system/Testing'.plan`, data)
        return {}
      },
      async setCameraPosition(transform) {
        console.log(`mocked '~system/Testing'.setCameraPosition`, transform)
        return {}
      },
    }
  }

  const runtime = createTestRuntime(testingModule, engine)
  return runtime.test
}