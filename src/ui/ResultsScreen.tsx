import { useMemo } from "react";
import type { Project } from "../engine/types";
import { computeEstimate } from "../engine/estimate";
import { formatArea, formatHours, formatMoney } from "./format";

export function ResultsScreen({ project }: { project: Project }) {
  const estimate = useMemo(() => computeEstimate(project), [project]);
  const { labor, pricing, materials } = estimate;
  const rate = project.rateProfile.laborRate;

  const roundupValue = (labor.billedRoomHours - labor.hoursWorked) * rate;
  const travelValue = labor.travelHours * rate;

  return (
    <div className="results">
      <h2>Estimate</h2>

      <section className="labor">
        <h3>Labor</h3>
        <p>
          <span data-testid="hours-worked">
            {formatHours(labor.hoursWorked)} hrs worked
          </span>
          {" · "}
          <span data-testid="hours-billed-rooms">
            {labor.billedRoomHours} billed
          </span>
          {" (rounding "}
          <span data-testid="roundup-value">{formatMoney(roundupValue)}</span>
          {") · "}
          <span data-testid="hours-travel">{labor.travelHours} travel</span>
          {" ("}
          <span data-testid="travel-value">{formatMoney(travelValue)}</span>
          {") · "}
          <strong data-testid="hours-total">
            {labor.totalBilledHours} total
          </strong>
        </p>
        <p>
          <span data-testid="crew-days">{labor.days}</span> crew-days at{" "}
          {project.rateProfile.hoursPerDay} hrs
        </p>
        <p data-testid="labor-cost">{formatMoney(pricing.laborCost)}</p>
      </section>

      <section className="materials">
        <h3>Materials</h3>
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
        <p data-testid="material-cost">{formatMoney(pricing.materialCost)}</p>
      </section>

      <section className="total">
        <h3>Total</h3>
        <p data-testid="grand-total">{formatMoney(pricing.total)}</p>
      </section>
    </div>
  );
}
