import type { Opening } from "../../engine/types";
import { openingBox } from "./projection";

interface Props {
  opening: Opening;
  wallWidthFt: number;
  scale: number;
  showTrim: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function OpeningMarker({
  opening,
  wallWidthFt,
  scale,
  showTrim,
  selected,
  onSelect,
}: Props) {
  const box = openingBox(opening, wallWidthFt, scale);
  // The engine zeroes casingLinFt when scope.trim is off (see
  // geometry.ts), so the picture has to match: showing a cased border while
  // trim is switched off tells him casing is being painted when nothing is
  // being charged for it.
  const cased = showTrim && opening.casedSides > 0 ? " cased" : "";
  const selectedClass = selected ? " selected" : "";

  return (
    <button
      type="button"
      data-testid={`opening-${opening.id}`}
      className={`opening opening-${opening.kind}${cased}${selectedClass}`}
      aria-label={`${opening.kind}, ${opening.width} by ${opening.height} feet`}
      style={{
        left: `${box.leftPx}px`,
        bottom: `${box.bottomPx}px`,
        width: `${box.widthPx}px`,
        height: `${box.heightPx}px`,
      }}
      onClick={(e) => {
        // Without this the click also lands on the wall behind and places a
        // second opening on top of the one being selected.
        e.stopPropagation();
        onSelect(opening.id);
      }}
    />
  );
}
