import { useMemo } from "react";
import type { Project } from "../engine/types";
import { computeEstimate } from "../engine/estimate";
import { WarningList } from "./warningGroups";
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
          they can't be mistaken for informational notices. Both lists are
          grouped and height-capped by <WarningList> exactly like Takeoff's,
          so the same empty price book that used to stack four STOP banners
          here too now renders one. */}
      <WarningList
        warnings={warnings.filter((w) => w.level === "error")}
        className="warnings-errors"
        testId="results-errors"
      />
      <WarningList warnings={warnings.filter((w) => w.level !== "error")} />

      <section className="labor">
        <h3>Labor</h3>

        {/* The caption carries the words; the value carries the figure and
            the shortest unit that keeps it unambiguous. That is what lets
            the right-hand column be a clean stack of tabular numerals
            instead of a wall of monospaced English. */}
        <div className="readouts">
          <Readout
            label="Hours worked"
            testId="hours-worked"
            value={`${formatHours(labor.hoursWorked)} h`}
          />
          <Readout
            label="Billed, rooms"
            testId="hours-billed-rooms"
            value={`${labor.billedRoomHours} h`}
            note="each room rounded up to the whole hour"
          />
          <Readout
            label="Value of that rounding"
            testId="roundup-value"
            value={formatMoney(roundupValue)}
          />
          <Readout
            label="Travel"
            testId="hours-travel"
            value={`${labor.travelHours} h`}
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
            value={`${labor.totalBilledHours} h`}
            strong
          />
        </div>

        {/* Deliberately NOT monospaced. A mono hyphen at this weight is
            nearly as wide as an em-dash, which is how "1 crew-day" came to
            look like "1 crew—days" in the first place. This is a sentence,
            so it is set in the text face; only the digits inside it get the
            tabular treatment. */}
        <p className="labor-days">
          <span data-testid="crew-days">{formatCrewDays(labor.days)}</span> at{" "}
          <span className="num">{project.rateProfile.hoursPerDay}</span> hrs a
          day.
        </p>
        <div className="section-total">
          <span className="section-total-label">Labour</span>
          <span data-testid="labor-cost">{formatMoney(pricing.laborCost)}</span>
        </div>
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
        <div className="section-total">
          <span className="section-total-label">Materials</span>
          <span data-testid="material-cost">
            {formatMoney(pricing.materialCost)}
          </span>
        </div>
      </section>

      <section className="total">
        <h3>Total</h3>
        <p data-testid="grand-total">{formatMoney(pricing.total)}</p>
      </section>
    </div>
  );
}
