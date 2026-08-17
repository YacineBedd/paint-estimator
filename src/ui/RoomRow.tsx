import { useEffect, useState } from "react";
import type { PaintProduct, Room, RoomGeometry } from "../engine/types";
import { OpeningsEditor } from "./OpeningsEditor";
import { formatArea } from "./format";

interface Props {
  room: Room;
  geometry?: RoomGeometry;
  priceBook: PaintProduct[];
  onChange: (room: Room) => void;
  onRemove: () => void;
}

interface ProductSelectProps {
  label: string;
  productId: string;
  priceBook: PaintProduct[];
  onSelect: (productId: string) => void;
}

// Primer is applied to a room via `room.scope.primer` (none/spot/full), not
// by picking a per-room primer product, so primer-use products are excluded
// from these lists — every other use (wall/ceiling/trim/specialty) is a
// legitimate finish for any surface. Specialty products like Aura Bath & Spa
// are the whole point (F2): a bathroom needs to reach them for walls AND
// ceiling, not just the "wall"/"ceiling"-use products.
function ProductSelect({
  label,
  productId,
  priceBook,
  onSelect,
}: ProductSelectProps) {
  const options = priceBook.filter((p) => p.use !== "primer");
  return (
    <label>
      {label}
      <select value={productId} onChange={(e) => onSelect(e.target.value)}>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function RoomRow({
  room,
  geometry,
  priceBook,
  onChange,
  onRemove,
}: Props) {
  // Wall/height fields keep a small mirror of local state instead of being
  // driven straight off `room` on every keystroke. A purely prop-controlled
  // <input value={room.walls[0]}> has its DOM value forced back to the last
  // prop after every change unless the caller feeds the updated project back
  // in synchronously (real usage does, via TakeoffScreen -> App state, but
  // that round trip is one React commit behind the keystroke) — typing
  // multiple characters in a row then clobbers itself. Local state removes
  // that dependency while still notifying the parent on every change and
  // resyncing if the room's own value changes for a reason other than our
  // own edit (e.g. a different project is loaded).
  const [wall0, setWall0] = useState(room.walls[0] ?? 0);
  const [wall1, setWall1] = useState(room.walls[1] ?? 0);
  const [height, setHeight] = useState(room.ceilingHeight);

  useEffect(() => setWall0(room.walls[0] ?? 0), [room.walls[0]]);
  useEffect(() => setWall1(room.walls[1] ?? 0), [room.walls[1]]);
  useEffect(() => setHeight(room.ceilingHeight), [room.ceilingHeight]);

  const setWall = (index: number, value: number) => {
    const walls = [...room.walls];
    walls[index] = value;
    onChange({ ...room, walls });
  };

  return (
    <div className="room-row">
      <input
        aria-label="room name"
        value={room.name}
        onChange={(e) => onChange({ ...room, name: e.target.value })}
      />
      <label>
        Wall 1
        <input
          type="number"
          step="0.1"
          min={0}
          value={wall0}
          onChange={(e) => {
            const value = Number(e.target.value);
            setWall0(value);
            setWall(0, value);
          }}
        />
      </label>
      <label>
        Wall 2
        <input
          type="number"
          step="0.1"
          min={0}
          value={wall1}
          onChange={(e) => {
            const value = Number(e.target.value);
            setWall1(value);
            setWall(1, value);
          }}
        />
      </label>
      <label>
        Height
        <input
          type="number"
          step="0.1"
          min={0}
          value={height}
          onChange={(e) => {
            const value = Number(e.target.value);
            setHeight(value);
            onChange({ ...room, ceilingHeight: value });
          }}
        />
      </label>

      <fieldset className="scope">
        <legend>Paint</legend>
        {(["walls", "ceiling", "trim"] as const).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={room.scope[key]}
              onChange={(e) =>
                onChange({
                  ...room,
                  scope: { ...room.scope, [key]: e.target.checked },
                })
              }
            />
            {key}
          </label>
        ))}
      </fieldset>

      <fieldset className="products">
        <legend>Products</legend>
        <ProductSelect
          label="Wall product"
          productId={room.wallProductId}
          priceBook={priceBook}
          onSelect={(wallProductId) => onChange({ ...room, wallProductId })}
        />
        <ProductSelect
          label="Ceiling product"
          productId={room.ceilingProductId}
          priceBook={priceBook}
          onSelect={(ceilingProductId) =>
            onChange({ ...room, ceilingProductId })
          }
        />
        <ProductSelect
          label="Trim product"
          productId={room.trimProductId}
          priceBook={priceBook}
          onSelect={(trimProductId) => onChange({ ...room, trimProductId })}
        />
      </fieldset>

      {geometry && (
        <div className="room-geometry">
          <span>Net wall {formatArea(geometry.netWallArea)}</span>
          {geometry.openingArea > 0 && (
            <span> (−{formatArea(geometry.openingArea)} openings)</span>
          )}
          <span> · Ceiling {formatArea(geometry.ceilingArea)}</span>
        </div>
      )}

      <OpeningsEditor
        openings={room.openings}
        onChange={(openings) => onChange({ ...room, openings })}
      />

      <button type="button" aria-label="remove room" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}
