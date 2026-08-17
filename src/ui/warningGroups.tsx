import { useState } from "react";
import type { Warning, WarningLevel } from "../engine/types";

/**
 * A normal takeoff against an empty price book raises one UNPRICED_PRODUCT
 * warning per product the job actually touches — four, typically (walls,
 * ceiling, trim, primer). Rendered one banner per warning, at ~200px of
 * near-identical red STOP each, that was the entire first screen at phone
 * width: he had to scroll past four warnings before seeing a single room.
 *
 * Every screen that renders `Estimate.warnings` — Takeoff's list view, the
 * room editor, and both halves of Estimate's error/non-error split — routes
 * through `<WarningList>` below so a repeated code always collapses to one
 * banner, everywhere, rather than each screen reimplementing its own
 * grouping (and inevitably drifting).
 */

export interface WarningGroup {
  code: string;
  level: WarningLevel;
  message: string;
  count: number;
  warnings: Warning[];
}

/** The text of `message` before the first occurrence of `marker`. */
function subjectBefore(message: string, marker: string): string {
  const i = message.indexOf(marker);
  return i >= 0 ? message.slice(0, i) : message;
}

/** The name inside a leading `"..."` segment — how room warnings open. */
function quotedSubject(message: string): string {
  const m = /^"([^"]+)"/.exec(message);
  return m ? m[1]! : message;
}

type GroupFormatter = (warnings: Warning[]) => string;

// One formatter per engine warning code that can plausibly repeat within a
// single job, each naming every affected room/product rather than just a
// count — the whole point of grouping is that he can still tell WHICH four
// without opening each one. A code with no formatter here (none currently
// repeats in practice, and any added later) falls back to `genericFormat`,
// which loses no information, only the tighter wording.
const FORMATTERS: Record<string, GroupFormatter> = {
  UNPRICED_PRODUCT: (warnings) => {
    const names = warnings.map((w) =>
      subjectBefore(w.message, " has no price set"),
    );
    return `${warnings.length} products have no price set: ${names.join(", ")}. Set their prices in Settings before quoting.`;
  },
  EMPTY_ROOM: (warnings) => {
    const names = warnings.map((w) => quotedSubject(w.message));
    return `${warnings.length} rooms have no dimensions and contribute nothing to the estimate: ${names.join(", ")}.`;
  },
  OPENINGS_EXCEED_WALL: (warnings) => {
    const names = warnings.map((w) => quotedSubject(w.message));
    return `${warnings.length} rooms have doors and windows that meet or exceed their wall area: ${names.join(", ")}. Fix each room's measurements before quoting.`;
  },
  STALE_PRICE: (warnings) => {
    const names = warnings.map((w) =>
      subjectBefore(w.message, " price last updated"),
    );
    return `${warnings.length} product prices haven't been updated in a while: ${names.join(", ")}.`;
  },
};

function genericFormat(warnings: Warning[]): string {
  return `${warnings.length} issues: ${warnings.map((w) => w.message).join(" ")}`;
}

/**
 * Groups a flat warning list by `code`, in the order each code first
 * appears. A code with exactly one warning keeps that warning's own wording
 * untouched — a lone warning should read like a normal sentence, not like a
 * list of one — while a code with more than one collapses to a single
 * synthesized banner via the formatters above.
 */
export function groupWarnings(warnings: Warning[]): WarningGroup[] {
  const order: string[] = [];
  const byCode = new Map<string, Warning[]>();
  for (const w of warnings) {
    if (!byCode.has(w.code)) {
      byCode.set(w.code, []);
      order.push(w.code);
    }
    byCode.get(w.code)!.push(w);
  }

  return order.map((code) => {
    const items = byCode.get(code)!;
    const level = items[0]!.level;
    if (items.length === 1) {
      return {
        code,
        level,
        message: items[0]!.message,
        count: 1,
        warnings: items,
      };
    }
    const formatter = FORMATTERS[code] ?? genericFormat;
    return {
      code,
      level,
      message: formatter(items),
      count: items.length,
      warnings: items,
    };
  });
}

// However well grouping compresses repeats of one code, a house mid-entry
// can still raise several genuinely DISTINCT codes at once (an unpriced
// product, several empty rooms, a stale price). Past the first two, the
// rest collapse behind a "+N more" row so warnings can never again push
// every room below the fold — tapping it expands the remainder in place.
const VISIBLE_GROUPS = 2;

interface WarningListProps {
  warnings: Warning[];
  /** Extra class alongside "warnings", e.g. Estimate's "warnings-errors". */
  className?: string;
  testId?: string;
}

export function WarningList({ warnings, className, testId }: WarningListProps) {
  const [expanded, setExpanded] = useState(false);
  if (warnings.length === 0) return null;

  const groups = groupWarnings(warnings);
  const visible = expanded ? groups : groups.slice(0, VISIBLE_GROUPS);
  const hiddenCount = groups.length - visible.length;

  return (
    <ul
      className={className ? `warnings ${className}` : "warnings"}
      data-testid={testId}
    >
      {visible.map((g) => (
        <li key={g.code} className={`warning-${g.level}`}>
          {g.message}
        </li>
      ))}
      {hiddenCount > 0 && (
        <li className="warnings-more">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label={`show ${hiddenCount} more warning${hiddenCount === 1 ? "" : "s"}`}
          >
            +{hiddenCount} more
          </button>
        </li>
      )}
    </ul>
  );
}
