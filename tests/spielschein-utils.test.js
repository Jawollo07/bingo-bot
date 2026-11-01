import test from "node:test";
import assert from "node:assert/strict";
import { selectSpielscheine } from "../spielschein-utils.js";

const makeSheets = (count) => Array.from({ length: count }, (_, i) => ({ id: String(i + 1) }));

test("accepts exactly four game sheets", () => {
    assert.deepEqual(selectSpielscheine(makeSheets(4)), makeSheets(4));
});

test("uses the first four when LOTTO returns more than four game sheets", () => {
    assert.deepEqual(selectSpielscheine(makeSheets(20)), makeSheets(4));
});

test("does not accept fewer than four game sheets", () => {
    assert.equal(selectSpielscheine(makeSheets(3)), null);
});

test("rejects invalid input", () => {
    assert.throws(() => selectSpielscheine(null), /Array/);
});
