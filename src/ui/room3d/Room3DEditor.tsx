import { useState } from "react";
import type {
  OpeningKind,
  PaintProduct,
  Room,
  RoomGeometry,
  Warning,
} from "../../engine/types";
import { RoomEditor } from "../RoomEditor";
import { newOpening } from "../OpeningsEditor";
import { Room3D } from "./Room3D";

interface Props {
  room: Room;
  geometry?: RoomGeometry;
  priceBook: PaintProduct[];
  warnings: Warning[];
  onChange: (room: Room) => void;
  onRemove: () => void;
  onBack: () => void;
}

let placementCounter = 0;

// projection.ts (Task 2, reviewed, do not modify) documents that the room's
// faces have inward normals so backface-visibility:hidden culls the near
// walls and you see into an open box — and, as a consequence, each wall's
// local offset=0 end renders on the FAR side from where a person standing
// inside facing that wall would put it. That is consistent across all four
// walls (an inherent property of viewing the box from outside it, not an
// accidental mirror).
//
// WallPlane's click handler (reviewed, do not modify) does not know about
// that geometry: it reports a raw DOM fraction of the clicked wall's own
// on-screen bounding box (0 = the box's screen-left edge, 1 = its
// screen-right edge). Stored as-is, a click near a wall's visual left would
// render its marker back out at the opposite end. This is the one place
// that correction belongs — one uniform rule, not per-wall special cases,
// because the mirror is uniform across all four walls.
function correctMirroredOffset(rawOffset: number): number {
  return 1 - rawOffset;
}

export function Room3DEditor({
  room,
  geometry,
  priceBook,
  warnings,
  onChange,
  onRemove,
  onBack,
}: Props) {
  const [armed, setArmed] = useState<OpeningKind | null>(null);

  const place = (wallIndex: 0 | 1 | 2 | 3, rawOffset: number) => {
    if (!armed) return;
    placementCounter += 1;
    const opening = {
      ...newOpening(armed, `place-${placementCounter}`),
      wallIndex,
      offset: correctMirroredOffset(rawOffset),
    };
    onChange({ ...room, openings: [...room.openings, opening] });
    // One click places one opening. Staying armed makes it far too easy to
    // scatter duplicates while orbiting.
    setArmed(null);
  };

  return (
    <div className="room3d-editor">
      <div className="room3d-editor-scene">
        <div className="room3d-tools">
          <button
            type="button"
            aria-pressed={armed === "door"}
            onClick={() => setArmed(armed === "door" ? null : "door")}
          >
            Place door
          </button>
          <button
            type="button"
            aria-pressed={armed === "window"}
            onClick={() => setArmed(armed === "window" ? null : "window")}
          >
            Place window
          </button>
        </div>

        <Room3D
          room={room}
          geometry={geometry}
          maxPx={360}
          onAddOpening={place}
          onSelectOpening={() => {}}
        />
      </div>

      <div className="room3d-editor-panel">
        <RoomEditor
          room={room}
          geometry={geometry}
          priceBook={priceBook}
          warnings={warnings}
          onChange={onChange}
          onRemove={onRemove}
          onBack={onBack}
        />
      </div>
    </div>
  );
}
