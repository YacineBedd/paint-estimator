import type { Opening } from "../../engine/types";

/** Never render a tiny room enormous. */
export const PX_PER_FT_MAX = 28;
/** Windows are drawn at a conventional sill height. Rendering only. */
export const WINDOW_SILL_FT = 3;

const PITCH_MIN = -60;
const PITCH_MAX = 5;

const clamp0 = (n: number): number => (Number.isFinite(n) ? Math.max(0, n) : 0);

export type FaceKind = "wall" | "floor" | "ceiling";

export interface Face {
  id: string;
  kind: FaceKind;
  wallIndex?: 0 | 1 | 2 | 3;
  widthFt: number;
  heightFt: number;
  widthPx: number;
  heightPx: number;
  transform: string;
}

export interface RoomProjection {
  scale: number;
  faces: Face[];
}

export function projectRoom(
  widthFt: number,
  depthFt: number,
  heightFt: number,
  maxPx: number,
): RoomProjection {
  const w = clamp0(widthFt);
  const d = clamp0(depthFt);
  const h = clamp0(heightFt);

  const largest = Math.max(w, d, h);
  const scale =
    largest > 0 ? Math.min(maxPx / largest, PX_PER_FT_MAX) : PX_PER_FT_MAX;

  const wPx = w * scale;
  const dPx = d * scale;
  const hPx = h * scale;

  const wall = (
    index: 0 | 1 | 2 | 3,
    widthFtOfWall: number,
    transform: string,
  ): Face => ({
    id: `wall-${index}`,
    kind: "wall",
    wallIndex: index,
    widthFt: widthFtOfWall,
    heightFt: h,
    widthPx: widthFtOfWall * scale,
    heightPx: hPx,
    transform,
  });

  // Every face's transform must leave its visible side facing the room centre —
  // backface-visibility:hidden (Task 3) relies on that to cull whichever wall sits
  // between the camera and the room, so you see into an open box.
  //
  // A face's default (untransformed) normal is +Z. To point inward each wall gets
  // rotated 180deg from the "naive" outward-facing transform:
  //   wall 0 (front, +depthPx/2) → normal -Z  → rotateY(180deg)
  //   wall 1 (right, +widthPx/2) → normal -X  → rotateY(-90deg)
  //   wall 2 (back,  -depthPx/2) → normal +Z  → identity (already faces +Z)
  //   wall 3 (left,  -widthPx/2) → normal +X  → rotateY(90deg)
  //
  // All four only ever compose rotateY (rotation about the vertical axis), so the
  // local up/down (Y) axis is never touched — a door's floor-anchored edge stays on
  // the floor and a window's sill stays below the top of the wall on every wall.
  // The trade-off is that each wall's local "left" (offset 0) lands on the far side
  // of the wall from where it would if you were standing inside facing it — that is
  // consistent across all four walls (an inherent, expected property of viewing the
  // inside of a box from outside it, not an accidental mirror), so a click handler
  // that places openings can correct for it with one uniform rule.
  return {
    scale,
    faces: [
      wall(0, w, `translateZ(${dPx / 2}px) rotateY(180deg)`),
      wall(1, d, `translateX(${wPx / 2}px) rotateY(-90deg)`),
      wall(2, w, `translateZ(${-dPx / 2}px)`),
      wall(3, d, `translateX(${-wPx / 2}px) rotateY(90deg)`),
      {
        id: "floor",
        kind: "floor",
        widthFt: w,
        heightFt: d,
        widthPx: wPx,
        heightPx: dPx,
        transform: `translateY(${hPx / 2}px) rotateX(90deg)`,
      },
      {
        id: "ceiling",
        kind: "ceiling",
        widthFt: w,
        heightFt: d,
        widthPx: wPx,
        heightPx: dPx,
        transform: `translateY(${-hPx / 2}px) rotateX(-90deg)`,
      },
    ],
  };
}

export function clampPitch(deg: number): number {
  if (!Number.isFinite(deg)) return PITCH_MIN;
  return Math.min(PITCH_MAX, Math.max(PITCH_MIN, deg));
}

export function clampYaw(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((deg % 360) + 360) % 360;
}

export function orbitTransform(yawDeg: number, pitchDeg: number): string {
  return `rotateX(${pitchDeg}deg) rotateY(${yawDeg}deg)`;
}

export function openingBox(
  o: Opening,
  wallWidthFt: number,
  scale: number,
): { leftPx: number; bottomPx: number; widthPx: number; heightPx: number } {
  const wallPx = clamp0(wallWidthFt) * scale;
  // An opening can never be wider (or, absent a passed-in wall height, taller) than
  // the wall it sits on — clamp both to the only extent this function knows about
  // so a misconfigured opening can't overflow past the wall's edge.
  const widthPx = Math.min(clamp0(o.width) * scale, wallPx);
  const heightPx = Math.min(clamp0(o.height) * scale, wallPx);

  const rawOffset = o.offset ?? 0.5;
  const offset = Math.min(
    1,
    Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0.5),
  );

  const centre = offset * wallPx;
  const maxLeft = Math.max(0, wallPx - widthPx);
  const leftPx = Math.min(maxLeft, Math.max(0, centre - widthPx / 2));

  const bottomPx = o.kind === "window" ? WINDOW_SILL_FT * scale : 0;

  return { leftPx, bottomPx, widthPx, heightPx };
}
