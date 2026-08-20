import type { Opening } from "../../engine/types";
import { openingBox } from "./projection";

interface Props {
  opening: Opening;
  wallWidthFt: number;
  scale: number;
  onSelect: (id: string) => void;
}

export function OpeningMarker({
  opening,
  wallWidthFt,
  scale,
  onSelect,
}: Props) {
  const box = openingBox(opening, wallWidthFt, scale);
  const cased = opening.casedSides > 0 ? " cased" : "";

  return (
    <button
      type="button"
      data-testid={`opening-${opening.id}`}
      className={`opening opening-${opening.kind}${cased}`}
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
