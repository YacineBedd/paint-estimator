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
        <div key={o.id} className="opening-row">
          <span>{o.kind}</span>
          <label>
            Qty
            <input
              type="number"
              min={0}
              value={o.quantity}
              onChange={(e) =>
                update(o.id, { quantity: Number(e.target.value) })
              }
            />
          </label>
          <label>
            W
            <input
              type="number"
              step="0.1"
              value={o.width}
              onChange={(e) => update(o.id, { width: Number(e.target.value) })}
            />
          </label>
          <label>
            H
            <input
              type="number"
              step="0.1"
              value={o.height}
              onChange={(e) => update(o.id, { height: Number(e.target.value) })}
            />
          </label>
          <label>
            Cased sides
            <select
              value={o.casedSides}
              onChange={(e) =>
                update(o.id, {
                  casedSides: Number(e.target.value) as 0 | 1 | 2,
                })
              }
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
          <button
            type="button"
            aria-label={`remove ${o.kind}`}
            onClick={() => onChange(openings.filter((x) => x.id !== o.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
