import { describe, expect, it } from "vitest";
import { formatLevelProgression } from "./level-progression.js";

describe("formatLevelProgression", () => {
  it("renders forward ASCII arrows as right arrows", () => {
    expect(formatLevelProgression("Level 4 -> Level 5")).toBe("Level 4 → Level 5");
  });

  it("renders backward ASCII arrows as left arrows", () => {
    expect(formatLevelProgression("Level 5 <- Level 4")).toBe("Level 5 ← Level 4");
  });

  it("keeps user text literal and does not interpret HTML", () => {
    expect(formatLevelProgression("<b>Level 4 -> 5</b>")).toBe("<b>Level 4 → 5</b>");
  });
});
