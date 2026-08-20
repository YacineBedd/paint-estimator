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
}

const YAW_STEP = 15;
const PITCH_STEP = 10;

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
      <div className="room3d-viewport">
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
