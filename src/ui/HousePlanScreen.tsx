import type { LaborResult, Room } from "../engine/types";
import { formatHours, formatMoney, formatRoomSize } from "./format";

interface Props {
  rooms: Room[];
  labor: LaborResult;
  laborRate: number;
  onOpen: (roomId: string) => void;
}

export function HousePlanScreen({ rooms, labor, laborRate, onOpen }: Props) {
  if (rooms.length === 0) {
    return (
      <div className="plan-empty" data-testid="plan-empty">
        <p>No rooms yet. Add one from the list view.</p>
      </div>
    );
  }

  const hoursFor = (roomId: string) =>
    labor.rooms.find((r) => r.roomId === roomId)?.billedHours ?? 0;

  // A room with floor 0 or an unexpected value still has to appear somewhere.
  const floorOf = (room: Room) => (room.floor > 0 ? room.floor : 1);

  const floors = [...new Set(rooms.map(floorOf))].sort((a, b) => a - b);

  return (
    <div className="house-plan">
      {floors.map((floor) => {
        const onThisFloor = rooms.filter((r) => floorOf(r) === floor);
        const floorHours = onThisFloor.reduce(
          (sum, r) => sum + hoursFor(r.id),
          0,
        );
        return (
          <section key={floor} className="plan-floor">
            <header className="plan-floor-head">
              <h3 data-testid={`floor-heading-${floor}`}>Floor {floor}</h3>
              <span data-testid={`floor-total-${floor}`}>
                {formatMoney(floorHours * laborRate)}
              </span>
            </header>
            <ul className="plan-rooms">
              {onThisFloor.map((room) => (
                <li key={room.id}>
                  <button
                    type="button"
                    data-testid={`plan-room-${room.id}`}
                    className="plan-room"
                    onClick={() => onOpen(room.id)}
                  >
                    <span className="plan-room-name">{room.name}</span>
                    <span className="plan-room-dims">
                      {formatRoomSize(room.walls, room.ceilingHeight) ??
                        "not measured yet"}
                    </span>
                    <span className="plan-room-hours">
                      {formatHours(hoursFor(room.id))} h
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
