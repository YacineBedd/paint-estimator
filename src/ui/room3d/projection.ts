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

  return {
    scale,
    faces: [
      wall(0, w, `translateZ(${dPx / 2}px)`),
      wall(1, d, `translateX(${wPx / 2}px) rotateY(90deg)`),
      wall(2, w, `translateZ(${-dPx / 2}px) rotateY(180deg)`),
      wall(3, d, `translateX(${-wPx / 2}px) rotateY(-90deg)`),
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
  const widthPx = clamp0(o.width) * scale;
  const heightPx = clamp0(o.height) * scale;
  const wallPx = clamp0(wallWidthFt) * scale;

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
