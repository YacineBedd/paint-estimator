import { useMemo } from "react";
import type { Project, Room } from "../engine/types";
import { computeEstimate } from "../engine/estimate";
import { DEFAULT_RATE_PROFILE } from "../data/defaults";
import { RoomRow } from "./RoomRow";
import { formatHours, formatMoney } from "./format";

interface Props {
  project: Project;
  onChange: (project: Project) => void;
}

// Monotonically increasing counter, module-scoped, mirroring the fix in
// OpeningsEditor.tsx: Date.now() alone can collide when a room is added more
// than once within the same millisecond (fast clicks, synthetic test
// events), which breaks React's key uniqueness. A counter is deterministic.
let roomIdSeq = 0;
function nextRoomId(): string {
  roomIdSeq += 1;
  return `room-${roomIdSeq}`;
}

function blankRoom(id: string): Room {
  return {
    id,
    name: "New room",
    floor: 1,
    quantity: 1,
    walls: [0, 0],
    ceilingHeight: 8,
    scope: { walls: true, ceiling: true, trim: true, primer: "full" },
    wallProductId: "549",
    ceilingProductId: "K508",
    trimProductId: "550",
    openings: [],
  };
}

export function TakeoffScreen({ project, onChange }: Props) {
  const estimate = useMemo(() => computeEstimate(project), [project]);
  const geoById = new Map(estimate.geometry.map((g) => [g.roomId, g]));

  const updateRoom = (room: Room) =>
    onChange({
      ...project,
      rooms: project.rooms.map((r) => (r.id === room.id ? room : r)),
    });

  return (
    <div className="takeoff">
      <h2>{project.name}</h2>

      {estimate.warnings.length > 0 && (
        <ul className="warnings">
          {estimate.warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} className={`warning-${w.level}`}>
              {w.message}
            </li>
          ))}
        </ul>
      )}

      {project.rooms.map((room) => (
        <RoomRow
          key={room.id}
          room={room}
          geometry={geoById.get(room.id)}
          onChange={updateRoom}
          onRemove={() =>
            onChange({
              ...project,
              rooms: project.rooms.filter((r) => r.id !== room.id),
            })
          }
        />
      ))}

      <button
        type="button"
        onClick={() =>
          onChange({
            ...project,
            rooms: [...project.rooms, blankRoom(nextRoomId())],
            rateProfile: project.rateProfile ?? DEFAULT_RATE_PROFILE,
          })
        }
      >
        Add room
      </button>

      <footer className="totals">
        <span data-testid="total-hours">
          {formatHours(estimate.labor.hoursWorked)} hrs worked
        </span>
        <span data-testid="total-billed">
          {estimate.labor.totalBilledHours} billed
        </span>
        <span data-testid="total-price">
          {formatMoney(estimate.pricing.total)}
        </span>
      </footer>
    </div>
  );
}
