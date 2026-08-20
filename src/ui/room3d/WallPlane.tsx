import type { MouseEvent } from "react";
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
  onPlace: (offset: number) => void;
  onSelectOpening: (id: string) => void;
}

export function WallPlane({
  face,
  openings,
  scale,
  inScope,
  showTrim,
  annotation,
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
          onSelect={onSelectOpening}
        />
      ))}

      <span className="face-annotation">{annotation}</span>
    </div>
  );
}
