import { useState } from "react";
import type { Opening, Room, RoomGeometry } from "../../engine/types";
import { WallPlane } from "./WallPlane";
import {
  clampPitch,
  clampYaw,
  orbitTransform,
  projectRoom,
  type Face,
} from "./projection";

interface Props {
  room: Room;
  geometry?: RoomGeometry;
  maxPx: number;
  onAddOpening: (wallIndex: 0 | 1 | 2 | 3, offset: number) => void;
  onSelectOpening: (id: string) => void;
  selectedOpeningId?: string | null;
}

const YAW_STEP = 15;
const PITCH_STEP = 10;

// --- Viewport height -------------------------------------------------------
//
// .room3d-viewport used to be a fixed 320px with overflow:hidden while the
// stage inside it (position:absolute, so it never grows its own parent) was
// scaled up to maxPx=360 of room extent. A large room's floor face — whose
// own footprint grows with room depth, not ceiling height — could project
// taller than 320px and get cropped at the bottom edge.
//
// The box's true on-screen vertical extent depends on its orientation, not
// just its size. orbitTransform's `rotateX(pitch) rotateY(yaw)` composes to
// a matrix that (per CSS's transform-list semantics) first spins the box
// around the vertical Y axis by yaw, then tips the *result* forward/back
// around the X axis by pitch. rotateY alone never moves a point's Y
// coordinate; rotateX is what mixes Y with the post-yaw Z. So a corner that
// started at local (±hx, ±hy, ±hz) — half-extents of the box in px — ends up
// at a screen-Y offset of:
//   y = hy*cos(pitch) ± hx*sin(yaw)*sin(pitch) ± hz*cos(yaw)*sin(pitch)
// Each of the three ± signs is chosen independently by that corner's own
// x/y/z sign, so the single farthest corner (in either direction) is found
// by summing the absolute value of every term — see verticalExtentPx below.
//
// This ignores the 1400px CSS perspective's foreshortening (projection.ts's
// .room3d-stage), which only ever shrinks a corner's apparent size as it
// recedes from the camera — so the formula's output is always a safe upper
// bound on the real extent, never an undercount that would clip the box.
function verticalExtentPx(
  hxPx: number,
  hyPx: number,
  hzPx: number,
  yawDeg: number,
  pitchDeg: number,
): number {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  return (
    hyPx * Math.abs(Math.cos(pitch)) +
    hxPx * Math.abs(Math.sin(yaw)) * Math.abs(Math.sin(pitch)) +
    hzPx * Math.abs(Math.cos(yaw)) * Math.abs(Math.sin(pitch))
  );
}

/** The previous fixed height — keeps a tiny room's viewport from collapsing
 *  to a sliver once it's no longer the only thing setting the height. */
const VIEWPORT_FLOOR_PX = 320;
/** Twice the floor: generous enough to show a genuinely large room's extra
 *  extent at a steep tilt without letting the scene push the estimate panel
 *  and controls off screen on a smaller viewport. */
const VIEWPORT_CAP_PX = 640;
/** Slack for the 1px face borders, the baseboard strip, and the corner
 *  annotation text — none of which the box math above accounts for. */
const VIEWPORT_PADDING_PX = 40;

/** Openings from the phone list carry no wallIndex. Spread them evenly and
 *  deterministically so the same room always renders the same way. */
function wallFor(o: Opening, index: number): 0 | 1 | 2 | 3 {
  return o.wallIndex ?? ((index % 4) as 0 | 1 | 2 | 3);
}

export function Room3D({
  room,
  geometry,
  maxPx,
  onAddOpening,
  onSelectOpening,
  selectedOpeningId,
}: Props) {
  const [yaw, setYaw] = useState(30);
  const [pitch, setPitch] = useState(-20);

  const widthFt = Math.max(0, room.walls[0] ?? 0);
  const depthFt = Math.max(0, room.walls[1] ?? 0);
  const heightFt = Math.max(0, room.ceilingHeight);

  if (widthFt <= 0 || depthFt <= 0 || heightFt <= 0) {
    return (
      <div className="room3d-empty" data-testid="room3d-empty">
        <p>Enter this room&rsquo;s dimensions to see it.</p>
      </div>
    );
  }

  const projection = projectRoom(widthFt, depthFt, heightFt, maxPx);

  const wPx = widthFt * projection.scale;
  const dPx = depthFt * projection.scale;
  const hPx = heightFt * projection.scale;
  const extentPx = verticalExtentPx(wPx / 2, hPx / 2, dPx / 2, yaw, pitch);
  const viewportHeightPx = Math.min(
    VIEWPORT_CAP_PX,
    Math.max(VIEWPORT_FLOOR_PX, Math.round(2 * extentPx + VIEWPORT_PADDING_PX)),
  );

  const openingsOnWall = (index: 0 | 1 | 2 | 3): Opening[] =>
    room.openings.filter((o, i) => wallFor(o, i) === index);

  const annotate = (face: Face): string => {
    if (face.kind !== "wall") {
      const area = face.widthFt * face.heightFt;
      return `${face.widthFt} × ${face.heightFt} = ${area.toFixed(1)} sq ft`;
    }
    const gross = face.widthFt * face.heightFt;
    const deduction = openingsOnWall(face.wallIndex!).reduce(
      (sum, o) => sum + o.width * o.height * o.quantity,
      0,
    );
    if (deduction <= 0) return `${gross.toFixed(1)} sq ft`;
    // Rounding gross, deduction and net independently (each to a whole
    // number) can produce an annotation whose own arithmetic doesn't add
    // up -- "94 - 13 = 82" when the true numbers are 94.4 - 12.5 = 81.9.
    // This annotation exists so he can check our arithmetic against his own
    // head; one decimal keeps that promise. The engine clamps net area at
    // zero (an opening can never remove more wall than exists), so the
    // displayed net does too, rather than showing a negative that the
    // estimate never charges.
    const net = Math.max(0, gross - deduction);
    return `${gross.toFixed(1)} − ${deduction.toFixed(1)} = ${net.toFixed(1)} sq ft`;
  };

  const inScope = (face: Face): boolean =>
    face.kind === "ceiling"
      ? room.scope.ceiling
      : face.kind === "floor"
        ? true
        : room.scope.walls;

  return (
    <div className="room3d">
      <div
        className="room3d-viewport"
        data-testid="room3d-viewport"
        style={{ height: `${viewportHeightPx}px` }}
      >
        <div
          className="room3d-stage"
          data-testid="room3d-stage"
          style={{ transform: orbitTransform(yaw, pitch) }}
        >
          {projection.faces.map((face) => (
            <WallPlane
              key={face.id}
              face={face}
              openings={
                face.kind === "wall" ? openingsOnWall(face.wallIndex!) : []
              }
              scale={projection.scale}
              inScope={inScope(face)}
              showTrim={face.kind === "wall" && room.scope.trim}
              annotation={annotate(face)}
              selectedOpeningId={selectedOpeningId}
              onPlace={(offset) =>
                face.kind === "wall" && onAddOpening(face.wallIndex!, offset)
              }
              onSelectOpening={onSelectOpening}
            />
          ))}
        </div>
      </div>

      {geometry && (
        <p className="room3d-summary" data-testid="room3d-summary">
          Net wall {geometry.netWallArea.toFixed(0)} sq ft · ceiling{" "}
          {geometry.ceilingArea.toFixed(0)} sq ft · trim{" "}
          {geometry.trimArea.toFixed(0)} sq ft
        </p>
      )}

      <div className="room3d-controls">
        <button
          type="button"
          onClick={() => setYaw((y) => clampYaw(y - YAW_STEP))}
        >
          Rotate left
        </button>
        <button
          type="button"
          onClick={() => setYaw((y) => clampYaw(y + YAW_STEP))}
        >
          Rotate right
        </button>
        <button
          type="button"
          onClick={() => setPitch((p) => clampPitch(p - PITCH_STEP))}
        >
          Tilt down
        </button>
        <button
          type="button"
          onClick={() => setPitch((p) => clampPitch(p + PITCH_STEP))}
        >
          Tilt up
        </button>
      </div>
    </div>
  );
}
