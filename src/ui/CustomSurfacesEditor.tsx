import { useEffect, useState } from "react";
import type { CustomSurface, PaintProduct } from "../engine/types";

// Monotonically increasing counter, module-scoped, mirroring the fix in
// RoomRow.tsx/OpeningsEditor.tsx: Date.now() alone can collide when a row is
// added more than once within the same millisecond (fast clicks, synthetic
// test events), which breaks React's key uniqueness. A counter is
// deterministic.
let customSurfaceIdSeq = 0;
function nextCustomSurfaceId(): string {
  customSurfaceIdSeq += 1;
  return `custom-${customSurfaceIdSeq}`;
}

export function blankCustomSurface(id: string): CustomSurface {
  return {
    id,
    name: "New surface",
    area: 0,
    rateMinPerSqFt: 0.75,
    productId: "",
    coats: 1,
    includeInPrimer: false,
  };
}

interface RowProps {
  surface: CustomSurface;
  priceBook: PaintProduct[];
  onUpdate: (patch: Partial<CustomSurface>) => void;
  onRemove: () => void;
}

// Area/rate/coats mirror local state instead of reading straight off the
// surface on every keystroke, for the same reason as RoomRow's wall/height
// inputs and OpeningsEditor's quantity/width/height inputs: a purely
// prop-controlled number input has its DOM value forced back to the last
// prop after every change unless the caller feeds the updated project back
// synchronously, which in real usage lands one commit later. Local state
// removes that dependency while still calling onUpdate on every change, and
// resyncs via useEffect if the value changes for a reason other than this
// row's own edit (e.g. a different project is loaded).
function CustomSurfaceRow({
  surface: cs,
  priceBook,
  onUpdate,
  onRemove,
}: RowProps) {
  const [area, setArea] = useState(cs.area);
  const [rate, setRate] = useState(cs.rateMinPerSqFt);
  const [coats, setCoats] = useState(cs.coats);

  useEffect(() => setArea(cs.area), [cs.area]);
  useEffect(() => setRate(cs.rateMinPerSqFt), [cs.rateMinPerSqFt]);
  useEffect(() => setCoats(cs.coats), [cs.coats]);

  return (
    <div className="custom-surface-row">
      <label>
        Name
        <input
          value={cs.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </label>
      <label>
        Area (sq ft)
        <input
          type="number"
          step="1"
          min={0}
          value={area}
          onChange={(e) => {
            const value = Number(e.target.value);
            setArea(value);
            onUpdate({ area: value });
          }}
        />
      </label>
      <label>
        Rate (min/sq ft)
        <input
          type="number"
          step="0.01"
          min={0}
          value={rate}
          onChange={(e) => {
            const value = Number(e.target.value);
            setRate(value);
            onUpdate({ rateMinPerSqFt: value });
          }}
        />
      </label>
      <label>
        Coats
        <input
          type="number"
          step="1"
          min={0}
          value={coats}
          onChange={(e) => {
            const value = Number(e.target.value);
            setCoats(value);
            onUpdate({ coats: value });
          }}
        />
      </label>
      <label>
        Product
        <select
          value={cs.productId}
          onChange={(e) => onUpdate({ productId: e.target.value })}
        >
          <option value="" disabled>
            Select a product
          </option>
          {priceBook.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Include in primer
        <input
          type="checkbox"
          checked={cs.includeInPrimer}
          onChange={(e) => onUpdate({ includeInPrimer: e.target.checked })}
        />
      </label>
      <button
        type="button"
        aria-label={`remove custom surface ${cs.name}`}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}

interface Props {
  customSurfaces: CustomSurface[];
  priceBook: PaintProduct[];
  onChange: (customSurfaces: CustomSurface[]) => void;
}

export function CustomSurfacesEditor({
  customSurfaces,
  priceBook,
  onChange,
}: Props) {
  const update = (id: string, patch: Partial<CustomSurface>) =>
    onChange(
      customSurfaces.map((cs) => (cs.id === id ? { ...cs, ...patch } : cs)),
    );

  const add = () =>
    onChange([...customSurfaces, blankCustomSurface(nextCustomSurfaceId())]);

  return (
    <div className="custom-surfaces">
      <h3>Other surfaces</h3>
      <p className="note">
        Doors &amp; trim runs, garage doors, exterior elevations — anything that
        isn't a room.
      </p>
      {customSurfaces.map((cs) => (
        <CustomSurfaceRow
          key={cs.id}
          surface={cs}
          priceBook={priceBook}
          onUpdate={(patch) => update(cs.id, patch)}
          onRemove={() =>
            onChange(customSurfaces.filter((x) => x.id !== cs.id))
          }
        />
      ))}
      <button type="button" onClick={add}>
        Add custom surface
      </button>
    </div>
  );
}
