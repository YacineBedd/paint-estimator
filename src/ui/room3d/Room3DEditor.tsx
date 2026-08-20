import { useEffect, useState } from "react";
import type {
  OpeningKind,
  PaintProduct,
  Room,
  RoomGeometry,
  Warning,
} from "../../engine/types";
import { RoomEditor } from "../RoomEditor";
import { newOpening } from "../OpeningsEditor";
import { nextId } from "../idGen";
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

// Below 900px the painter is one-handed with a tape measure, not building
// the room — see the module-level note in the split editor's styles
// (section 20). matchMedia is absent in jsdom unless a test stubs it, so
// both the initial state and the effect guard for it; defaulting to wide
// means an environment that can't tell gets the full tool, not a crippled
// one.
function useIsWide(): boolean {
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 900px)").matches
      : true,
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    const mq = window.matchMedia("(min-width: 900px)");
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return wide;
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
  const isWide = useIsWide();

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
    if (!isWide || !armed) return;
    const opening = {
      ...newOpening(armed, nextId("place")),
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
        {isWide && (
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
        )}

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
