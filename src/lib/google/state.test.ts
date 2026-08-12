import { describe, it, expect } from "vitest";
import { signState, verifyState } from "./state";

describe("OAuth state signing", () => {
  it("round-trips a signed state", () => {
    const s = signState({ uid: "user-123", authed: true });
    expect(verifyState(s)).toEqual({ uid: "user-123", authed: true });
  });

  it("rejects a tampered state", () => {
    const s = signState({ uid: "user-123", authed: false });
    const [body] = s.split(".");
    expect(verifyState(`${body}.deadbeef`)).toBeNull();
  });

  it("rejects malformed state", () => {
    expect(verifyState("garbage")).toBeNull();
  });
});
