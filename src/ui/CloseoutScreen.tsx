import { useEffect, useMemo, useState } from "react";
import type { CoverageDrift, Project } from "../engine/types";
import { computeEstimate } from "../engine/estimate";
import { computeCalibration } from "../engine/calibration";

interface Props {
  project: Project;
  onChange: (project: Project) => void;
}

interface GallonsRowProps {
  productId: string;
  name: string;
  estimatedGallons: number;
  purchased: number;
  drift: CoverageDrift | undefined;
  onCommit: (gallons: number) => void;
}

function driftNote(drift: CoverageDrift | undefined): string | null {
  if (!drift) return null;
  const direction =
    drift.deltaPct > 0 ? "over" : drift.deltaPct < 0 ? "under" : "on";
  return `${drift.actualGallons} gal bought (${drift.deltaPct >= 0 ? "+" : ""}${drift.deltaPct.toFixed(0)}% ${direction} estimate)`;
}

// Same local-state-mirror pattern as SettingsScreen.tsx's RateField/PriceRow
// and RoomRow.tsx's wall/height fields: a purely prop-controlled number
// input has its DOM value forced back to the last rendered prop after every
// keystroke unless the caller feeds the updated project back synchronously,
// so typing a multi-digit value clobbers itself. Local state removes that
// dependency while still notifying the parent on every keystroke, and
// resyncs via useEffect if the value changes for a reason other than this
// row's own edit (e.g. a different project is loaded).
function GallonsRow({
  productId,
  name,
  estimatedGallons,
  purchased,
  drift,
  onCommit,
}: GallonsRowProps) {
  const [local, setLocal] = useState(purchased);
  useEffect(() => setLocal(purchased), [purchased]);

  const note = driftNote(drift);

  return (
    <tr data-testid={`drift-${productId}`}>
      <td>{name}</td>
      <td>{estimatedGallons}</td>
      <td>
        <input
          type="number"
          step="1"
          aria-label={`${name} gallons purchased`}
          value={local}
          onChange={(e) => {
            const next = Number(e.target.value);
            setLocal(next);
            onCommit(next);
          }}
        />
      </td>
      <td className="drift-note">{note}</td>
    </tr>
  );
}

export function CloseoutScreen({ project, onChange }: Props) {
  const estimate = useMemo(() => computeEstimate(project), [project]);
  const report = useMemo(
    () => computeCalibration(project, estimate),
    [project, estimate],
  );

  const actuals = project.actuals ?? {
    hoursWorked: 0,
    gallonsPurchased: {},
  };

  const [hoursLocal, setHoursLocal] = useState(actuals.hoursWorked);
  useEffect(() => setHoursLocal(actuals.hoursWorked), [actuals.hoursWorked]);

  const coverageById = useMemo(
    () => new Map((report?.coverage ?? []).map((c) => [c.productId, c])),
    [report],
  );

  const setGallons = (productId: string, gallons: number) =>
    onChange({
      ...project,
      actuals: {
        ...actuals,
        gallonsPurchased: {
          ...actuals.gallonsPurchased,
          [productId]: gallons,
        },
      },
    });

  const setHours = (hours: number) =>
    onChange({ ...project, actuals: { ...actuals, hoursWorked: hours } });

  return (
    <div className="closeout">
      <h2>Job close-out</h2>

      <label>
        Hours actually worked
        <input
          type="number"
          step="0.25"
          value={hoursLocal}
          onChange={(e) => {
            const next = Number(e.target.value);
            setHoursLocal(next);
            setHours(next);
          }}
        />
      </label>

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Estimated (gal)</th>
            <th>Actually bought (gal)</th>
            <th>Drift</th>
          </tr>
        </thead>
        <tbody>
          {estimate.materials.requirements.map((r) => {
            const product = project.priceBook.find((p) => p.id === r.productId);
            const name = product?.name ?? r.productId;
            return (
              <GallonsRow
                key={r.productId}
                productId={r.productId}
                name={name}
                estimatedGallons={r.gallons}
                purchased={actuals.gallonsPurchased[r.productId] ?? 0}
                drift={coverageById.get(r.productId)}
                onCommit={(gallons) => setGallons(r.productId, gallons)}
              />
            );
          })}
        </tbody>
      </table>

      {report === null || report.finishGallonsActual === 0 ? (
        <p>Enter what you actually used to calibrate future estimates.</p>
      ) : (
        <section className="drift">
          <p>
            Finish coverage ran{" "}
            <strong data-testid="finish-coverage">
              {report.finishRealCoverage.toFixed(0)} sq ft/gal
            </strong>{" "}
            against {project.rateProfile.wallCoverage} assumed for walls and{" "}
            {project.rateProfile.ceilingCoverage} for ceilings.
          </p>
          <p>
            Finish paint: estimated {report.finishGallonsEstimated} gal, bought{" "}
            {report.finishGallonsActual} gal (
            {report.finishShortfallPct >= 0 ? "+" : ""}
            {report.finishShortfallPct.toFixed(0)}%). Primer is tracked
            separately so it cannot mask a finish-coat shortfall.
          </p>
        </section>
      )}
    </div>
  );
}
