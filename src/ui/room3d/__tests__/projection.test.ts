import { describe, it, expect } from "vitest";
import {
  PX_PER_FT_MAX,
  WINDOW_SILL_FT,
  clampPitch,
  clampYaw,
  openingBox,
  orbitTransform,
  projectRoom,
} from "../projection";
import type { Opening } from "../../../engine/types";

const win = (over: Partial<Opening> = {}): Opening => ({
  id: "o",
  kind: "window",
  quantity: 1,
  width: 4,
  height: 3,
  paintSlab: false,
  casedSides: 1,
  ...over,
});

describe("projectRoom", () => {
  it("returns six faces: four walls, floor, ceiling", () => {
    const p = projectRoom(10, 12, 8, 400);
    expect(p.faces).toHaveLength(6);
    expect(p.faces.filter((f) => f.kind === "wall")).toHaveLength(4);
    expect(p.faces.filter((f) => f.kind === "floor")).toHaveLength(1);
    expect(p.faces.filter((f) => f.kind === "ceiling")).toHaveLength(1);
  });

  it("gives walls 0 and 2 the room width, walls 1 and 3 the depth", () => {
    const p = projectRoom(10, 12, 8, 400);
    const byIndex = (i: number) => p.faces.find((f) => f.wallIndex === i)!;
    expect(byIndex(0).widthFt).toBe(10);
    expect(byIndex(2).widthFt).toBe(10);
    expect(byIndex(1).widthFt).toBe(12);
    expect(byIndex(3).widthFt).toBe(12);
  });

  it("gives every wall the ceiling height", () => {
    const p = projectRoom(10, 12, 8, 400);
    for (const f of p.faces.filter((x) => x.kind === "wall")) {
      expect(f.heightFt).toBe(8);
    }
  });

  it("sizes floor and ceiling to the footprint", () => {
    const p = projectRoom(10, 12, 8, 400);
    const floor = p.faces.find((f) => f.kind === "floor")!;
    expect(floor.widthFt).toBe(10);
    expect(floor.heightFt).toBe(12);
  });

  it("scales the largest dimension to fit maxPx", () => {
    const p = projectRoom(10, 20, 8, 400);
    expect(p.scale * 20).toBeLessThanOrEqual(400);
    expect(p.scale).toBeGreaterThan(0);
  });

  it("never exceeds PX_PER_FT_MAX on a small room", () => {
    const p = projectRoom(2, 2, 8, 4000);
    expect(p.scale).toBeLessThanOrEqual(PX_PER_FT_MAX);
  });

  it("gives every wall, the floor, and the ceiling the exact inward-facing transform", () => {
    // Full-string assertions (not toContain) so a wrong sign, wrong axis, or a wall
    // swapped with its opposite fails the test. Pixel values are computed with the
    // same arithmetic as the implementation so the float representation matches
    // exactly rather than relying on hand-rounded literals.
    const widthFt = 10;
    const depthFt = 12;
    const heightFt = 8;
    const maxPx = 400;
    const p = projectRoom(widthFt, depthFt, heightFt, maxPx);

    const largest = Math.max(widthFt, depthFt, heightFt);
    const scale = Math.min(maxPx / largest, PX_PER_FT_MAX);
    const wPx = widthFt * scale;
    const dPx = depthFt * scale;
    const hPx = heightFt * scale;

    const byIndex = (i: number) => p.faces.find((f) => f.wallIndex === i)!;

    // Wall 0 (front, +depthPx/2) needs normal -Z (inward): rotateY(180deg) flips
    // the Z axis but leaves the local up/down (Y) axis untouched.
    expect(byIndex(0).transform).toBe(
      `translateZ(${dPx / 2}px) rotateY(180deg)`,
    );
    // Wall 1 (right, +widthPx/2) needs normal -X (inward).
    expect(byIndex(1).transform).toBe(
      `translateX(${wPx / 2}px) rotateY(-90deg)`,
    );
    // Wall 2 (back, -depthPx/2) needs normal +Z (inward): the default,
    // untransformed face already faces +Z, so no rotation is applied at all.
    expect(byIndex(2).transform).toBe(`translateZ(${-dPx / 2}px)`);
    // Wall 3 (left, -widthPx/2) needs normal +X (inward).
    expect(byIndex(3).transform).toBe(
      `translateX(${-wPx / 2}px) rotateY(90deg)`,
    );

    const floor = p.faces.find((f) => f.kind === "floor")!;
    const ceiling = p.faces.find((f) => f.kind === "ceiling")!;
    // Floor needs normal -Y (up, inward); ceiling needs normal +Y (down, inward).
    expect(floor.transform).toBe(`translateY(${hPx / 2}px) rotateX(90deg)`);
    expect(ceiling.transform).toBe(`translateY(${-hPx / 2}px) rotateX(-90deg)`);
  });

  it("returns a degenerate but safe projection for a zero-size room", () => {
    const p = projectRoom(0, 0, 0, 400);
    expect(p.faces).toHaveLength(6);
    for (const f of p.faces) {
      expect(f.widthPx).toBeGreaterThanOrEqual(0);
      expect(f.heightPx).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(f.widthPx)).toBe(true);
    }
    expect(Number.isFinite(p.scale)).toBe(true);
  });

  it("clamps negative dimensions to zero rather than inverting the box", () => {
    const p = projectRoom(-10, 12, 8, 400);
    const w0 = p.faces.find((f) => f.wallIndex === 0)!;
    expect(w0.widthFt).toBe(0);
    expect(w0.widthPx).toBe(0);
  });
});

describe("orbit", () => {
  it("composes pitch then yaw", () => {
    expect(orbitTransform(30, -20)).toBe("rotateX(-20deg) rotateY(30deg)");
  });

  it("clamps pitch so the camera never drops below the floor", () => {
    expect(clampPitch(-90)).toBe(-60);
    expect(clampPitch(40)).toBe(5);
    expect(clampPitch(-10)).toBe(-10);
  });

  it("wraps yaw into 0..360 so it never grows unbounded", () => {
    expect(clampYaw(370)).toBe(10);
    expect(clampYaw(-10)).toBe(350);
    expect(clampYaw(45)).toBe(45);
  });
});

describe("openingBox", () => {
  it("centres an opening on its offset along the wall", () => {
    const box = openingBox(win({ offset: 0.5 }), 10, 20);
    // wall 200px wide, opening 80px wide, centred at 100 → left 60
    expect(box.widthPx).toBe(80);
    expect(box.leftPx).toBe(60);
  });

  it("defaults a missing offset to the wall centre", () => {
    const box = openingBox(win({}), 10, 20);
    expect(box.leftPx).toBe(60);
  });

  it("keeps an opening inside the wall at offset 0 and 1", () => {
    const left = openingBox(win({ offset: 0 }), 10, 20);
    const right = openingBox(win({ offset: 1 }), 10, 20);
    expect(left.leftPx).toBe(0);
    expect(right.leftPx).toBe(200 - 80);
  });

  it("sits a door on the floor and a window at the sill height", () => {
    const door = openingBox(win({ kind: "door", width: 3, height: 7 }), 10, 20);
    const window = openingBox(win({}), 10, 20);
    expect(door.bottomPx).toBe(0);
    expect(window.bottomPx).toBe(WINDOW_SILL_FT * 20);
  });

  it("never returns a negative box for bad input", () => {
    const box = openingBox(win({ width: -4, height: -3, offset: -1 }), 10, 20);
    expect(box.widthPx).toBeGreaterThanOrEqual(0);
    expect(box.heightPx).toBeGreaterThanOrEqual(0);
    expect(box.leftPx).toBeGreaterThanOrEqual(0);
  });

  it("clamps widthPx and heightPx to the wall's own extent", () => {
    // wall is 2ft wide at scale 1 -> 2px; a 10ft opening must not overflow it
    const box = openingBox(win({ width: 10, height: 10 }), 2, 1);
    expect(box.widthPx).toBe(2);
    expect(box.heightPx).toBe(2);
    expect(box.leftPx).toBe(0);
  });
});
