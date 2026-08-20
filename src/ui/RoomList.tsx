import type { LaborResult, Room, Warning } from "../engine/types";
import { formatHours, formatMoney, formatRoomSize } from "./format";

interface Props {
  rooms: Room[];
  labor: LaborResult;
  laborRate: number;
  warnings: Warning[];
  onOpen: (roomId: string) => void;
}

/**
 * The scannable default view of a takeoff: one row per room, nothing else.
 *
 * The figure on the right is that room's LABOUR value — its billed hours at
 * his labour rate. It is deliberately not a full room subtotal including
 * materials: gallons are rounded up per product across the whole job (see
 * computeMaterials), so any per-room material figure would be an allocation
 * invented by this file, and fourteen of them would not add up to the total
 * in the footer. Billed room hours DO sum exactly to `billedRoomHours`, so
 * every number he can see on this screen reconciles with the one he quotes.
 * The column caption says "labour" so it can't be read as the whole job.
 */
export function RoomList({ rooms, labor, laborRate, warnings, onOpen }: Props) {
  const hoursById = new Map(labor.rooms.map((r) => [r.roomId, r.billedHours]));
  const flaggedRoomIds = new Set(
    warnings.filter((w) => w.roomId !== undefined).map((w) => w.roomId),
  );

  if (rooms.length === 0) {
    return (
      <p className="room-list-empty" data-testid="room-list-empty">
        No rooms yet. Add the first one, or start from the listing's square
        footage below.
      </p>
    );
  }

  return (
    <>
      <div className="room-list-head" aria-hidden="true">
        <span>Room</span>
        <span>Labour</span>
      </div>
      <ul className="room-list" data-testid="room-list">
        {rooms.map((room) => {
          const size = formatRoomSize(room.walls, room.ceilingHeight);
          const billed = hoursById.get(room.id) ?? 0;
          return (
            <li key={room.id}>
              <button
                type="button"
                className="room-card"
                data-testid={`room-card-${room.id}`}
                onClick={() => onOpen(room.id)}
              >
                <span className="room-card-name">
                  {room.name}
                  {flaggedRoomIds.has(room.id) && (
                    <span
                      className="room-card-flag"
                      aria-label="needs attention"
                    >
                      !
                    </span>
                  )}
                </span>
                <span className="room-card-money">
                  {formatMoney(billed * laborRate)}
                </span>
                <span className="room-card-size">
                  {size ?? "not measured yet"}
                </span>
                <span className="room-card-hours">{formatHours(billed)} h</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
