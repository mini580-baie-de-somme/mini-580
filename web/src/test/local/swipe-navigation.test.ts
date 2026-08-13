import { describe, expect, it } from "vitest";
import {
  getSwipeSnapTranslateX,
  isHorizontalSwipeGesture,
  isVerticalScrollGesture,
  resolveHorizontalSwipe,
} from "@/lib/swipe-navigation";

describe("swipe-navigation", () => {
  it("returns 0 when horizontal travel is below threshold", () => {
    expect(resolveHorizontalSwipe({ deltaX: 30, deltaY: 0 })).toBe(0);
    expect(resolveHorizontalSwipe({ deltaX: -40, deltaY: 0 })).toBe(0);
  });

  it("maps swipe left to next (+1) and swipe right to previous (-1)", () => {
    expect(resolveHorizontalSwipe({ deltaX: -80, deltaY: 0 })).toBe(1);
    expect(resolveHorizontalSwipe({ deltaX: 80, deltaY: 0 })).toBe(-1);
  });

  it("ignores mostly vertical movement", () => {
    expect(resolveHorizontalSwipe({ deltaX: 60, deltaY: 120 })).toBe(0);
    expect(resolveHorizontalSwipe({ deltaX: -60, deltaY: -90 })).toBe(0);
  });

  it("accepts clearly horizontal swipes with slight vertical drift", () => {
    expect(resolveHorizontalSwipe({ deltaX: -100, deltaY: 20 })).toBe(1);
    expect(resolveHorizontalSwipe({ deltaX: 100, deltaY: -15 })).toBe(-1);
  });

  it("detects horizontal gesture early during touchmove", () => {
    expect(isHorizontalSwipeGesture({ deltaX: 20, deltaY: 4 })).toBe(true);
    expect(isHorizontalSwipeGesture({ deltaX: -18, deltaY: 6 })).toBe(true);
    expect(isHorizontalSwipeGesture({ deltaX: 8, deltaY: 30 })).toBe(false);
  });

  it("detects vertical scroll intent for nested scroll areas", () => {
    expect(isVerticalScrollGesture({ deltaX: 4, deltaY: 40 })).toBe(true);
    expect(isVerticalScrollGesture({ deltaX: 30, deltaY: 8 })).toBe(false);
  });

  it("computes snap translate in finger direction for full panel exit", () => {
    expect(getSwipeSnapTranslateX(1, 400)).toBe(-400);
    expect(getSwipeSnapTranslateX(-1, 400)).toBe(400);
    expect(getSwipeSnapTranslateX(1, 0)).toBe(-120);
    expect(getSwipeSnapTranslateX(-1, 0)).toBe(120);
  });
});
