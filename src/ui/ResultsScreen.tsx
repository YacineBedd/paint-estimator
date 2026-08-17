import { useMemo } from "react";
import type { Project } from "../engine/types";
import { computeEstimate } from "../engine/estimate";
import { formatArea, formatCrewDays, formatHours, formatMoney } from "./format";

interface ReadoutProps {
  label: string;
  testId: string;
  value: string;
  note?: string;
  strong?: boolean;
}

/**
 * One line of the labour breakdown: a caption in the normal text face and a
 * figure in tabular mono.
 *
 * Previously the whole section was set in mono, sentences and all, so a
 * client-facing labour breakdown read like terminal output. Mono is for
 * digits — it exists here so columns of figures line up, not as a typeface
 * for prose.
 */
function Readout({ label, testId, value, note, strong }: ReadoutProps) {
  return (
    <div className="readout">
      <span className="readout-label">{label}</span>
      <span
        className={`readout-value${strong ? " readout-value-strong" : ""}`}
        data-testid={testId}
      >
        {value}
      </span>
      {note && <span className="readout-note">{note}</span>}
    </div>
  );
}

export function ResultsScreen({ project }: { project: Project }) {
  const estimate = useMemo(
    () => computeEstimate(project, Date.now()),
    [project],
  );
  const { labor, pricing, materials, warnings } = estimate;
  const rate = project.rateProfile.laborRate;

  const roundupValue = (labor.billedRoomHours - labor.hoursWorked) * rate;
  const travelValue = labor.travelHours * rate;

  return (
    <div className="results">
      <header className="screen-head">
        <h2>Estimate</h2>
        <span className="screen-head-meta">{project.name}</span>
      </header>

      {/* F6: a hard OPENINGS_EXCEED_WALL validation error must not sit
          silently behind a printed total — this was previously only shown
          on TakeoffScreen. Errors get their own visually distinct list so
          they can't be mistaken for informational notices. */}
      {warnings.length > 0 && (
        <>
          {warnings.some((w) => w.level === "error") && (
            <ul
              className="warnings warnings-errors"
              data-testid="results-errors"
            >
              {warnings
                .filter((w) => w.level === "error")
                .map((w, i) => (
                  <li key={`${w.code}-${i}`} className="warning-error">
                    {w.message}
                  </li>
                ))}
            </ul>
          )}
          {warnings.some((w) => w.level !== "error") && (
            <ul className="warnings">
              {warnings
                .filter((w) => w.level !== "error")
                .map((w, i) => (
                  <li key={`${w.code}-${i}`} className={`warning-${w.level}`}>
                    {w.message}
                  </li>
                ))}
            </ul>
          )}
        </>
      )}

      <section className="labor">
        <h3>Labor</h3>

        <div className="readouts">
          <Readout
            label="Hours worked"
            testId="hours-worked"
            value={`${formatHours(labor.hoursWorked)} hrs worked`}
          />
          <Readout
            label="Billed, rooms"
            testId="hours-billed-rooms"
            value={`${labor.billedRoomHours} billed`}
            note="rounded up per room"
          />
          <Readout
            label="Value of that rounding"
            testId="roundup-value"
            value={formatMoney(roundupValue)}
          />
          <Readout
            label="Travel"
            testId="hours-travel"
            value={`${labor.travelHours} travel`}
            note={`${formatCrewDays(labor.days)} at ${project.rateProfile.travelHoursPerDay} hr each`}
          />
          <Readout
            label="Value of travel"
            testId="travel-value"
            value={formatMoney(travelValue)}
          />
          <Readout
            label="Total billed hours"
            testId="hours-total"
            value={`${labor.totalBilledHours} total`}
            strong
          />
        </div>

        <p className="labor-days">
          <span data-testid="crew-days">{formatCrewDays(labor.days)}</span> at{" "}
          {project.rateProfile.hoursPerDay} hrs a day.
        </p>
        <p className="section-total" data-testid="labor-cost">
          {formatMoney(pricing.laborCost)}
        </p>
      </section>

      <section className="materials">
        <h3>Materials</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Area</th>
                <th>Coats</th>
                <th>Gallons</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {pricing.materialLines.map((line) => {
                const req = materials.requirements.find(
                  (r) => r.productId === line.productId,
                );
                return (
                  <tr key={line.productId}>
                    <td>{line.name}</td>
                    <td>{req ? formatArea(req.coatedArea) : "—"}</td>
                    <td>{req?.coats ?? "—"}</td>
                    <td>{line.gallons}</td>
                    <td>{formatMoney(line.lineCost)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="section-total" data-testid="material-cost">
          {formatMoney(pricing.materialCost)}
        </p>
      </section>

      <section className="total">
        <h3>Total</h3>
        <p data-testid="grand-total">{formatMoney(pricing.total)}</p>
      </section>
    </div>
  );
}
