import { useMemo, useState } from "react";
import type { PaintProduct, Project, RateProfile, Room } from "../engine/types";
import { computeEstimate } from "../engine/estimate";
import { DEFAULT_RATE_PROFILE } from "../data/defaults";
import { RoomEditor } from "./RoomEditor";
import { RoomList } from "./RoomList";
import { HousePlanScreen } from "./HousePlanScreen";
import { CustomSurfacesEditor } from "./CustomSurfacesEditor";
import { QuickEstimateScreen } from "./QuickEstimateScreen";
import { Disclosure } from "./Disclosure";
import { WarningList } from "./warningGroups";
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

const FIRST_ROOM_HEIGHT = 8;

/**
 * A new room inherits the ceiling height of the one before it. Height is
 * 8 ft in nearly every room of nearly every house, and in the rare house
 * where it isn't, it is consistently not-8 — so the previous room is a far
 * better guess than a constant, and re-typing "8" fourteen times is pure
 * friction. Walls start at 0, which the editor renders as an empty field
 * rather than a literal zero.
 */
function blankRoom(id: string, previous: Room | undefined): Room {
  return {
    id,
    name: "New room",
    floor: previous?.floor ?? 1,
    quantity: 1,
    walls: [0, 0],
    ceilingHeight: previous?.ceilingHeight ?? FIRST_ROOM_HEIGHT,
    scope: { walls: true, ceiling: true, trim: true, primer: "full" },
    wallProductId: previous?.wallProductId ?? "549",
    ceilingProductId: previous?.ceilingProductId ?? "K508",
    trimProductId: previous?.trimProductId ?? "550",
    openings: [],
  };
}

interface StarterProps {
  hasRooms: boolean;
  rates: RateProfile;
  priceBook: PaintProduct[];
}

/**
 * The old "Quick estimate" tab, folded in here. It is a way to START a job
 * — square footage off the listing before he has measured anything — not a
 * separate destination, so it leads the screen while the takeoff is empty
 * and collapses to one line once there are rooms to look at.
 */
function SquareFootageStarter({ hasRooms, rates, priceBook }: StarterProps) {
  const panel = <QuickEstimateScreen rates={rates} priceBook={priceBook} />;
  if (!hasRooms) {
    return <div className="starter starter-open">{panel}</div>;
  }
  return (
    <Disclosure className="starter" label="Start from square footage">
      {panel}
    </Disclosure>
  );
}

export function TakeoffScreen({ project, onChange }: Props) {
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "plan">("list");

  const estimate = useMemo(
    () => computeEstimate(project, Date.now()),
    [project],
  );
  const geoById = new Map(estimate.geometry.map((g) => [g.roomId, g]));

  // `editingRoomId` can point at a room that no longer exists: it was just
  // removed, a different project was imported, or the caller passed a
  // vi.fn() that never feeds the new room back as a prop. Deriving the open
  // room from the CURRENT room list (rather than trusting the id) makes
  // every one of those cases fall back to the list instead of crashing.
  const editingRoom = project.rooms.find((r) => r.id === editingRoomId);

  const updateRoom = (room: Room) =>
    onChange({
      ...project,
      rooms: project.rooms.map((r) => (r.id === room.id ? room : r)),
    });

  const addRoom = () => {
    const id = nextRoomId();
    onChange({
      ...project,
      rooms: [...project.rooms, blankRoom(id, project.rooms.at(-1))],
      rateProfile: project.rateProfile ?? DEFAULT_RATE_PROFILE,
    });
    // Land him in the editor with the cursor's worth of chrome already out
    // of the way: he tapped "Add room" because he is standing in one.
    setEditingRoomId(id);
  };

  // While a room is open he is mid-measurement, and EMPTY_ROOM is a
  // statement about a state he is in the middle of leaving. Every other
  // warning for that room (an opening bigger than the wall, say) is a real
  // mistake and still shows. The deferred warning is not suppressed, only
  // moved: it is on the list view the moment he backs out, and on Estimate.
  const editorWarnings = editingRoom
    ? estimate.warnings.filter(
        (w) => w.roomId === editingRoom.id && w.code !== "EMPTY_ROOM",
      )
    : [];

  return (
    <div className="takeoff">
      {editingRoom ? (
        <RoomEditor
          key={editingRoom.id}
          room={editingRoom}
          geometry={geoById.get(editingRoom.id)}
          priceBook={project.priceBook}
          warnings={editorWarnings}
          onChange={updateRoom}
          onRemove={() => {
            onChange({
              ...project,
              rooms: project.rooms.filter((r) => r.id !== editingRoom.id),
            });
            setEditingRoomId(null);
          }}
          onBack={() => setEditingRoomId(null)}
        />
      ) : (
        <>
          <header className="screen-head">
            <h2>{project.name}</h2>
            <span className="screen-head-meta">
              {project.rooms.length}{" "}
              {project.rooms.length === 1 ? "room" : "rooms"}
            </span>
          </header>

          <WarningList warnings={estimate.warnings} />

          <div className="view-toggle" role="group" aria-label="View">
            <button
              type="button"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "plan"}
              onClick={() => setViewMode("plan")}
            >
              Plan
            </button>
          </div>

          {viewMode === "list" ? (
            <RoomList
              rooms={project.rooms}
              labor={estimate.labor}
              laborRate={project.rateProfile.laborRate}
              warnings={estimate.warnings}
              onOpen={setEditingRoomId}
            />
          ) : (
            <HousePlanScreen
              rooms={project.rooms}
              labor={estimate.labor}
              laborRate={project.rateProfile.laborRate}
              onOpen={setEditingRoomId}
            />
          )}

          <button type="button" className="add-room" onClick={addRoom}>
            Add room
          </button>

          <SquareFootageStarter
            hasRooms={project.rooms.length > 0}
            rates={project.rateProfile}
            priceBook={project.priceBook}
          />

          <Disclosure className="other-surfaces" label="Other surfaces">
            <CustomSurfacesEditor
              customSurfaces={project.customSurfaces}
              priceBook={project.priceBook}
              onChange={(customSurfaces) =>
                onChange({ ...project, customSurfaces })
              }
            />
          </Disclosure>
        </>
      )}

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
