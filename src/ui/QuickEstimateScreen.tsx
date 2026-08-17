import { useMemo, useState } from "react";
import type { PaintProduct, RateProfile } from "../engine/types";
import { buildQuickProject, type QuickInput } from "../engine/quickEstimate";
import { computeEstimate } from "../engine/estimate";
import { formatHours, formatMoney } from "./format";

interface Props {
  rates: RateProfile;
  priceBook: PaintProduct[];
}

export function QuickEstimateScreen({ rates, priceBook }: Props) {
  const [input, setInput] = useState<QuickInput>({
    floorAreaSqFt: 0,
    ceilingHeight: 8,
    doorCount: 0,
    windowCount: 0,
    paintCeilings: true,
    paintTrim: true,
  });

  const estimate = useMemo(
    () => computeEstimate(buildQuickProject(input, rates, priceBook)),
    [input, rates, priceBook],
  );

  const set = (patch: Partial<QuickInput>) =>
    setInput((prev) => ({ ...prev, ...patch }));

  return (
    <div className="quick">
      <h2>Quick estimate</h2>

      <label>
        Square feet (from the listing)
        <input
          type="number"
          value={input.floorAreaSqFt}
          onChange={(e) => set({ floorAreaSqFt: Number(e.target.value) })}
        />
      </label>
      <label>
        Ceiling height
        <input
          type="number"
          step="0.5"
          value={input.ceilingHeight}
          onChange={(e) => set({ ceilingHeight: Number(e.target.value) })}
        />
      </label>
      <label>
        Doors
        <input
          type="number"
          value={input.doorCount}
          onChange={(e) => set({ doorCount: Number(e.target.value) })}
        />
      </label>
      <label>
        Windows
        <input
          type="number"
          value={input.windowCount}
          onChange={(e) => set({ windowCount: Number(e.target.value) })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={input.paintCeilings}
          onChange={(e) => set({ paintCeilings: e.target.checked })}
        />
        Ceilings
      </label>
      <label>
        <input
          type="checkbox"
          checked={input.paintTrim}
          onChange={(e) => set({ paintTrim: e.target.checked })}
        />
        Trim
      </label>

      <p data-testid="quick-total">{formatMoney(estimate.pricing.total)}</p>
      <p>
        {formatHours(estimate.labor.hoursWorked)} hrs · {estimate.labor.days}{" "}
        crew-days
      </p>
      <p className="note">
        Ballpark only — wall area is estimated from floor area. Do a
        room-by-room takeoff before quoting.
      </p>
    </div>
  );
}
