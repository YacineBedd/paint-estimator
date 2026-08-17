import { useEffect, useState } from "react";
import type { Opening, OpeningKind } from "../engine/types";

const DEFAULTS: Record<OpeningKind, { width: number; height: number }> = {
  door: { width: 3, height: 7 },
  window: { width: 4, height: 3 },
  passage: { width: 5, height: 7 },
};

export function newOpening(kind: OpeningKind, id: string): Opening {
  return {
    id,
    kind,
    quantity: 1,
    ...DEFAULTS[kind],
    paintSlab: kind === "door",
    casedSides: 2,
  };
}

// Monotonically increasing counter, module-scoped. Date.now() can collide
// when two openings are added within the same millisecond (fast clicks,
// synthetic test events); a counter is deterministic and always unique
// across the lifetime of the page, regardless of timing.
let openingIdSeq = 0;
function nextOpeningId(kind: OpeningKind): string {
  openingIdSeq += 1;
  return `${kind}-${openingIdSeq}`;
}

interface RowProps {
  opening: Opening;
  onUpdate: (patch: Partial<Opening>) => void;
  onRemove: () => void;
}

function OpeningRow({ opening: o, onUpdate, onRemove }: RowProps) {
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

  return (
    <div className="opening-row">
      <span>{o.kind}</span>
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
}

export function OpeningsEditor({ openings, onChange }: Props) {
  const update = (id: string, patch: Partial<Opening>) =>
    onChange(openings.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const add = (kind: OpeningKind) =>
    onChange([...openings, newOpening(kind, nextOpeningId(kind))]);

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
          onUpdate={(patch) => update(o.id, patch)}
          onRemove={() => onChange(openings.filter((x) => x.id !== o.id))}
        />
      ))}
    </div>
  );
}
