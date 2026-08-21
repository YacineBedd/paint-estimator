import type { KeyboardEvent, MouseEvent } from "react";
import type { Opening } from "../../engine/types";
import type { Face } from "./projection";
import { OpeningMarker } from "./OpeningMarker";

interface Props {
  face: Face;
  openings: Opening[];
  scale: number;
  inScope: boolean;
  showTrim: boolean;
  annotation: string;
  selectedOpeningId?: string | null;
  onPlace: (offset: number) => void;
  onSelectOpening: (id: string) => void;
}

const faceLabel = (face: Face): string =>
  face.kind === "wall"
    ? `Wall ${(face.wallIndex ?? 0) + 1}`
    : face.kind === "floor"
      ? "Floor"
      : "Ceiling";

export function WallPlane({
  face,
  openings,
  scale,
  inScope,
  showTrim,
  annotation,
  selectedOpeningId,
  onPlace,
  onSelectOpening,
}: Props) {
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!inScope) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // jsdom and any zero-width face would divide by zero here; fall back to
    // the wall centre, which is also the sensible default for a real click
    // on a face we cannot measure.
    const offset = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
    onPlace(Math.min(1, Math.max(0, offset)));
  };

  // Enter/Space place an opening dead centre (offset 0.5). That's not a
  // compromise: you can't aim a click position with a keyboard, but
  // offset never reaches the estimate (see projection.ts's openingBox and
  // engine/geometry.ts — only width/height/quantity ever change the price),
  // so a keyboard user arrives at exactly the same number as a mouse user,
  // just without a say in exactly where the marker is drawn.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onPlace(0.5);
  };

  const a11yProps = inScope
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": `${faceLabel(face)}, ${annotation}`,
        onKeyDown: handleKeyDown,
      }
    : {};

  return (
    <div
      data-testid={`face-${face.id}`}
      className={`face face-${face.kind}${inScope ? "" : " hatched"}`}
      style={{
        width: `${face.widthPx}px`,
        height: `${face.heightPx}px`,
        marginLeft: `${-face.widthPx / 2}px`,
        marginTop: `${-face.heightPx / 2}px`,
        transform: face.transform,
      }}
      onClick={handleClick}
      {...a11yProps}
    >
      {face.kind === "wall" && showTrim && (
        <div className="baseboard" data-testid={`baseboard-${face.id}`} />
      )}

      {openings.map((o) => (
        <OpeningMarker
          key={o.id}
          opening={o}
          wallWidthFt={face.widthFt}
          scale={scale}
          showTrim={showTrim}
          selected={o.id === selectedOpeningId}
          onSelect={onSelectOpening}
        />
      ))}

      <span className="face-annotation">{annotation}</span>
    </div>
  );
}
