import { useEffect, useState } from "react";
import type { PaintProduct, Project, RateProfile } from "../engine/types";

interface Props {
  project: Project;
  onChange: (project: Project) => void;
}

// Every numeric field in RateProfile except the checkbox (roundRoomHoursUp)
// and the nested coats object, which aren't edited through this component.
type NumericRateKey = Exclude<keyof RateProfile, "roundRoomHoursUp" | "coats">;

const NUMERIC_FIELDS: Array<{
  key: NumericRateKey;
  label: string;
  step: string;
}> = [
  { key: "laborRate", label: "Labor rate ($/hr)", step: "1" },
  { key: "wallRate", label: "Wall rate (min/sq ft)", step: "0.01" },
  { key: "ceilingRate", label: "Ceiling rate (min/sq ft)", step: "0.01" },
  { key: "trimRate", label: "Trim rate (min/sq ft)", step: "0.01" },
  { key: "hoursPerDay", label: "Hours per day", step: "0.5" },
  { key: "travelHoursPerDay", label: "Travel hours per day", step: "0.5" },
  { key: "wallCoverage", label: "Wall coverage (sq ft/gal)", step: "10" },
  { key: "ceilingCoverage", label: "Ceiling coverage (sq ft/gal)", step: "10" },
  { key: "trimGirthFt", label: "Trim girth (ft)", step: "0.05" },
  { key: "spotPrimeFraction", label: "Spot prime fraction", step: "0.05" },
];

interface RateFieldProps {
  label: string;
  step: string;
  value: number;
  onCommit: (value: number) => void;
}

// Mirrors the fix in RoomRow.tsx / OpeningsEditor.tsx: a purely
// prop-controlled number input has its DOM value forced back to the last
// prop after every keystroke unless the caller feeds the updated project
// back synchronously. In real usage that round trip lands one commit later
// (this field -> SettingsScreen -> App state); typing more than one
// character in a row then clobbers itself. Local state removes that
// dependency while still calling onCommit on every change, and resyncs via
// useEffect if the value changes for a reason other than this field's own
// edit (e.g. a different project is loaded).
function RateField({ label, step, value, onCommit }: RateFieldProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);

  return (
    <label>
      {label}
      <input
        type="number"
        step={step}
        value={local}
        onChange={(e) => {
          const next = Number(e.target.value);
          setLocal(next);
          onCommit(next);
        }}
      />
    </label>
  );
}

interface PriceRowProps {
  product: PaintProduct;
  onChange: (patch: Partial<PaintProduct>) => void;
}

// Same local-state-mirror pattern as RateField, applied to the two numeric
// price inputs. The product name field is text, not subject to the
// mid-typing revert (it isn't driven by Number() coercion and every
// character typed is still a valid string), so it stays plain-controlled.
function PriceRow({ product: p, onChange }: PriceRowProps) {
  const [listPrice, setListPrice] = useState(p.listPrice);
  const [actualPrice, setActualPrice] = useState(p.actualPrice);

  useEffect(() => setListPrice(p.listPrice), [p.listPrice]);
  useEffect(() => setActualPrice(p.actualPrice), [p.actualPrice]);

  return (
    <tr>
      <td>
        <input
          aria-label={`${p.id} name`}
          value={p.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          aria-label={`${p.id} list price per gallon`}
          value={listPrice}
          onChange={(e) => {
            const next = Number(e.target.value);
            setListPrice(next);
            onChange({ listPrice: next });
          }}
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          aria-label={`${p.id} your price per gallon`}
          value={actualPrice}
          onChange={(e) => {
            const next = Number(e.target.value);
            setActualPrice(next);
            onChange({ actualPrice: next });
          }}
        />
      </td>
      <td>{p.packSizeGal} gal</td>
    </tr>
  );
}

export function SettingsScreen({ project, onChange }: Props) {
  const rates = project.rateProfile;

  // Accepts boolean too — roundRoomHoursUp is a checkbox — do not force it
  // through `as never` or `as any`.
  const setRate = (key: keyof RateProfile, value: number | boolean) =>
    onChange({ ...project, rateProfile: { ...rates, [key]: value } });

  const setProduct = (id: string, patch: Partial<PaintProduct>) =>
    onChange({
      ...project,
      priceBook: project.priceBook.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    });

  return (
    <div className="settings">
      <h2>Rates</h2>
      {NUMERIC_FIELDS.map(({ key, label, step }) => (
        <RateField
          key={key}
          label={label}
          step={step}
          value={rates[key]}
          onCommit={(value) => setRate(key, value)}
        />
      ))}

      {rates.trimRate === rates.wallRate && (
        <p data-testid="trim-rate-note" className="note">
          Trim is set to the same rate as walls, matching your spreadsheet. Trim
          typically runs 2–3× slower per square foot — worth revisiting on a
          heavy-trim house.
        </p>
      )}

      <label>
        <input
          type="checkbox"
          checked={rates.roundRoomHoursUp}
          onChange={(e) => setRate("roundRoomHoursUp", e.target.checked)}
        />
        Round each room up to whole hours
      </label>

      <h2>Price book</h2>
      <p className="note">All prices are per gallon.</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>List (per gallon)</th>
              <th>Yours (per gallon)</th>
              <th>Pack size</th>
            </tr>
          </thead>
          <tbody>
            {project.priceBook.map((p) => (
              <PriceRow
                key={p.id}
                product={p}
                onChange={(patch) => setProduct(p.id, patch)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
