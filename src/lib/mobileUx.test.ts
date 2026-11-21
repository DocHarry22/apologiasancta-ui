import { describe, expect, it } from "vitest";
import { getLiveQuizConnectionUrl, shouldKeepQuizAwake } from "./mobileUx";

describe("live quiz resource lifecycle", () => {
  it("does not open the live stream until a room has been selected", () => {
    expect(getLiveQuizConnectionUrl("https://engine.test", null)).toBeNull();
    expect(getLiveQuizConnectionUrl("", "parish-room")).toBeNull();
    expect(getLiveQuizConnectionUrl("https://engine.test", "parish-room")).toBe("https://engine.test");
  });

  it("keeps the device awake only for registered players in an active room", () => {
    expect(shouldKeepQuizAwake({ roomId: null, isRegistered: false, phase: "LOCKED" })).toBe(false);
    expect(shouldKeepQuizAwake({ roomId: "parish-room", isRegistered: false, phase: "OPEN" })).toBe(false);
    expect(shouldKeepQuizAwake({ roomId: "parish-room", isRegistered: true, phase: "OPEN" })).toBe(true);
    expect(shouldKeepQuizAwake({ roomId: "parish-room", isRegistered: true, phase: "LOCKED" })).toBe(true);
    expect(shouldKeepQuizAwake({ roomId: "parish-room", isRegistered: true, phase: "REVEAL" })).toBe(true);
    expect(shouldKeepQuizAwake({ roomId: "parish-room", isRegistered: true, phase: "IDLE" })).toBe(false);
  });
});
