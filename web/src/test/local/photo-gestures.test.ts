import { describe, expect, it } from "vitest";
import {
  angleDeg,
  distance,
  layoutFromPinch,
  pinchSnapshot,
  rotationFromPinch,
  scaleFromPinch,
} from "@/lib/photo-gestures";

describe("photo-gestures", () => {
  it("computes distance and angle between two points", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(angleDeg({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0, 5);
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 5);
  });

  it("scales uniformly when lockAspect is true", () => {
    const start = pinchSnapshot(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      1,
      1,
      0,
      0,
      0
    );
    const next = scaleFromPinch(start, 200, true);
    expect(next.scaleX).toBeCloseTo(2, 5);
    expect(next.scaleY).toBeCloseTo(2, 5);
  });

  it("derives rotation delta from finger angle change", () => {
    const start = pinchSnapshot(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      1,
      1,
      10,
      0,
      0
    );
    expect(rotationFromPinch(start, 90)).toBeCloseTo(100, 5);
  });

  it("layoutFromPinch scales offset with zoom for crop-center pivot", () => {
    const start = pinchSnapshot(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      1,
      1,
      0,
      0.5,
      -0.25
    );
    const next = layoutFromPinch(start, 200, 0, true);
    expect(next.scaleX).toBeCloseTo(2, 5);
    expect(next.offsetX).toBeCloseTo(1, 5);
    expect(next.offsetY).toBeCloseTo(-0.5, 5);
  });
});
