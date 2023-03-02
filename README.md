# hammurabi

The reference/educational implementation of the Decentraland protocol.

This implementation uses the [babylon.js](htttps://babylonjs.org) framework and runs entirely on web browsers.

This project's goals are to:
- document current and future protocol standards
- experiment with changes to the protocol
- guide new contributors into how Decentraland works
- enable easy prototyping of new features

This repository is the companion material for the implementation guide (still work in progress, check out this [design doc](https://docs.google.com/document/d/1CLjcr3AU-fm-vfjV41kogTmNZc9JgQufwmh2b2y_AT8/edit) and [ongoing documentation of the protocol](https://github.com/decentraland/documentation/pulls?q=label%3Aprotocol)).

**Status: Proof of Concept, does not run**

# Commit Guide

- This commit sets up the tooling to build the project. It uses Typescript as language, `esbuild` to compile and build the project, `npm` for package management, `jest` for tests, and GitHub actions for continuous integrattion.

# Building and Running

1. Clone the repo using `git clone https://github.com/decentraland/hammurabi`
2. `cd hammurabi` to move into the repo
3. `make watch` to start the development web server
4. Open `https://localhost:7081`

Additionally, `make build` builds the project into the `./static` folder, and `make test` executes all tests.

## Testing

- `make test` executes all the tests
- `make test-watch` executes all the tests and watches for file changes to run the tests again
- `make test-watch TESTARGS='test/file.spec.ts'` runs the tests of `test/file.spec.ts`
