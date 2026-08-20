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

  // WallPlane's click offset (0 = the clicked wall's own screen-left edge,
  // 1 = its screen-right edge) is stored as-is. It looks like it should
  // need correcting for the room's inward-facing wall normals (see
  // projection.ts), but it doesn't: whichever wall is actually visible is
  // only ever visible because backface-visibility:hidden let it through,
  // and that visibility condition and the wall's own rotateY exactly
  // cancel out — swept across every reachable orbit angle, a wall's local
  // left is always its screen-left whenever that wall can be clicked at
  // all. Click, storage, and render already round-trip correctly.
  const place = (wallIndex: 0 | 1 | 2 | 3, offset: number) => {
    if (!armed) return;
    placementCounter += 1;
    const opening = {
      ...newOpening(armed, `place-${placementCounter}`),
      wallIndex,
      offset,
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
