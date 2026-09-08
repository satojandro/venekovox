// Browser stand-in for Node's `assert`.
// MACI's crypto package calls `assert(...)` at import time. Vite's browser
// bundle exposes Node's assert as a named-export object, so `.default` is
// missing and the whole React tree fails to start.
function assert(value: unknown, message?: string | Error): asserts value {
  if (!value) {
    throw message instanceof Error ? message : new Error(message || "Assertion failed");
  }
}

export default assert;
export { assert };
