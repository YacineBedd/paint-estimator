import { useEffect, useRef, useState } from "react";
import type { Opening, OpeningKind } from "../engine/types";
import { nextId } from "./idGen";

const DEFAULTS: Record<OpeningKind, { width: number; height: number }> = {
  door: { width: 3, height: 7 },
  window: { width: 4, height: 3 },
  passage: { width: 5, height: 7 },
};

// A door or passage is an interior opening: both faces of its frame are
// inside the house, so both get cased. A window sits in an exterior wall —
// only the interior face is ever cased; the exterior face is siding/brick
// trim that this estimate doesn't touch. Defaulting a window to 2 cased
// sides overstates its casing linear footage enough to make adding a
// window raise the bid (28 linear ft of casing on a 4x3 window vs. the 12
// sq ft of wall it removes) -- exactly backwards for what a window should
// do to the number.
const DEFAULT_CASED_SIDES: Record<OpeningKind, 0 | 1 | 2> = {
  door: 2,
  window: 1,
  passage: 2,
};

export function newOpening(kind: OpeningKind, id: string): Opening {
  return {
    id,
    kind,
    quantity: 1,
    ...DEFAULTS[kind],
    paintSlab: kind === "door",
    casedSides: DEFAULT_CASED_SIDES[kind],
  };
}

interface RowProps {
  opening: Opening;
  selected: boolean;
  onUpdate: (patch: Partial<Opening>) => void;
  onRemove: () => void;
}

function OpeningRow({ opening: o, selected, onUpdate, onRemove }: RowProps) {
  // Quantity/width/height mirror local state instead of reading straight off
  // `o` on every keystroke, for the same reason as RoomRow's wall/height
  // inputs: a purely prop-controlled number input has its DOM value forced
  // back to the last prop after every change unless the caller feeds the
  // updated project back synchronously. In real usage that round trip lands
  // one commit later (RoomRow -> TakeoffScreen -> App state); typing more
  // than one character in a row then clobbers itself. Local state removes
  // that dependency while still calling onUpdate on every change, and
  // resyncs via useEffect if the value changes for a reason other than this
  // row's own edit (e.g. the containing project is swapped out).
  const [quantity, setQuantity] = useState(o.quantity);
  const [width, setWidth] = useState(o.width);
  const [height, setHeight] = useState(o.height);

  useEffect(() => setQuantity(o.quantity), [o.quantity]);
  useEffect(() => setWidth(o.width), [o.width]);
  useEffect(() => setHeight(o.height), [o.height]);

  // Scrolls this row into view when the 3D view's marker for it gets
  // clicked, so a painter working the split layout doesn't have to hunt
  // for which row corresponds to which opening. Keyed on `selected`
  // (a boolean derived from comparing this row's own stable id against the
  // parent's selectedId) rather than depending on anything that changes on
  // every render — a row that's already selected and re-renders because he
  // is typing into one of its own fields must not scroll again.
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) {
      rowRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  return (
    <div
      ref={rowRef}
      data-testid={`opening-row-${o.id}`}
      className={`opening-row${selected ? " selected" : ""}`}
    >
      <span>{o.kind}</span>
      {o.kind === "door" && (
        <label>
          Paint door faces
          <input
            type="checkbox"
            checked={o.paintSlab}
            onChange={(e) => onUpdate({ paintSlab: e.target.checked })}
          />
        </label>
      )}
      <label>
        Qty
        <input
          type="number"
          min={0}
          value={quantity}
          onChange={(e) => {
            const value = Number(e.target.value);
            setQuantity(value);
            onUpdate({ quantity: value });
          }}
        />
      </label>
      <label>
        W
        <input
          type="number"
          step="0.1"
          min={0}
          value={width}
          onChange={(e) => {
            const value = Number(e.target.value);
            setWidth(value);
            onUpdate({ width: value });
          }}
        />
      </label>
      <label>
        H
        <input
          type="number"
          step="0.1"
          min={0}
          value={height}
          onChange={(e) => {
            const value = Number(e.target.value);
            setHeight(value);
            onUpdate({ height: value });
          }}
        />
      </label>
      <label>
        Cased sides
        <select
          value={o.casedSides}
          onChange={(e) =>
            onUpdate({ casedSides: Number(e.target.value) as 0 | 1 | 2 })
          }
        >
          <option value={0}>0</option>
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
      </label>
      <button type="button" aria-label={`remove ${o.kind}`} onClick={onRemove}>
        ×
      </button>
    </div>
  );
}

interface Props {
  openings: Opening[];
  onChange: (openings: Opening[]) => void;
  /** Highlights and scrolls to the matching row — set by the 3D view when
   *  its own opening marker is clicked. Optional and unused by the plain
   *  (non-3D) room-list path, which never has anything selected. */
  selectedId?: string | null;
}

export function OpeningsEditor({ openings, onChange, selectedId }: Props) {
  const update = (id: string, patch: Partial<Opening>) =>
    onChange(openings.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const add = (kind: OpeningKind) =>
    onChange([...openings, newOpening(kind, nextId(kind))]);

  return (
    <div className="openings">
      <div className="openings-actions">
        <button type="button" onClick={() => add("door")}>
          Add door
        </button>
        <button type="button" onClick={() => add("window")}>
          Add window
        </button>
      </div>

      {openings.map((o) => (
        <OpeningRow
          key={o.id}
          opening={o}
          selected={selectedId != null && o.id === selectedId}
          onUpdate={(patch) => update(o.id, patch)}
          onRemove={() => onChange(openings.filter((x) => x.id !== o.id))}
        />
      ))}
    </div>
  );
}
