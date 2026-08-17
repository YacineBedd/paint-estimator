import { useMemo, useState } from "react";
import type { PaintProduct, RateProfile } from "../engine/types";
import { buildQuickProject, type QuickInput } from "../engine/quickEstimate";
import { computeEstimate } from "../engine/estimate";
import { formatCrewDays, formatHours, formatMoney } from "./format";

interface Props {
  rates: RateProfile;
  priceBook: PaintProduct[];
}

/**
 * Not a destination of its own any more — this is the "start from square
 * footage" panel inside Takeoff. It stays a self-contained component (and
 * keeps its own tests) because it owns a scratch input that must NOT touch
 * the real project: a ballpark off a listing is not a takeoff.
 */
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
      <div className="quick-fields">
        <label>
          Square feet (from the listing)
          <input
            type="number"
            inputMode="numeric"
            value={input.floorAreaSqFt}
            onChange={(e) => set({ floorAreaSqFt: Number(e.target.value) })}
          />
        </label>
        <label>
          Ceiling height
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={input.ceilingHeight}
            onChange={(e) => set({ ceilingHeight: Number(e.target.value) })}
          />
        </label>
        <label>
          Doors
          <input
            type="number"
            inputMode="numeric"
            value={input.doorCount}
            onChange={(e) => set({ doorCount: Number(e.target.value) })}
          />
        </label>
        <label>
          Windows
          <input
            type="number"
            inputMode="numeric"
            value={input.windowCount}
            onChange={(e) => set({ windowCount: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="quick-scope">
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
      </div>

      <p data-testid="quick-total">{formatMoney(estimate.pricing.total)}</p>
      {/* Only the digits are monospaced: a mono hyphen reads as an em-dash,
          which is exactly how "crew-days" went wrong before. */}
      <p className="quick-sub">
        <span className="num">{formatHours(estimate.labor.hoursWorked)}</span>{" "}
        hrs · {formatCrewDays(estimate.labor.days)}
      </p>
      <p className="note">
        Ballpark only — wall area is estimated from floor area. Do a
        room-by-room takeoff before quoting.
      </p>
    </div>
  );
}
