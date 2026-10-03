import { describe, expect, it } from "bun:test";
import { confirmsExecution } from "../../src/utils/input";

describe("explicit execution confirmation", () => {
  it("only accepts y or yes", () => {
    for (const answer of ["y", "yes", "Y", " YES "]) expect(confirmsExecution(answer)).toBe(true);
    for (const answer of ["", "n", "no", "maybe", "yes please"]) expect(confirmsExecution(answer)).toBe(false);
  });
});
