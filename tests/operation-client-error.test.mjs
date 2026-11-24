import assert from "node:assert/strict";
import test from "node:test";
import { isMissingOperation, OperationHttpError } from "../lib/operations/client-error.ts";

test("only a 404 marks an optional operation endpoint as missing", () => {
  assert.equal(isMissingOperation(new OperationHttpError("not found", 404)), true);
  assert.equal(isMissingOperation(new OperationHttpError("server error", 500)), false);
  assert.equal(isMissingOperation(new Error("network failure")), false);
});
