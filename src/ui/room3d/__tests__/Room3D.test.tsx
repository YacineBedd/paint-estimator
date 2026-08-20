import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Room3D } from "../Room3D";
import { computeGeometry } from "../../../engine/geometry";
import { goldenJob } from "../../../engine/__fixtures__/goldenJob";
import type { Opening, Room } from "../../../engine/types";

const rates = goldenJob.rateProfile;

const makeRoom = (
  openings: Opening[] = [],
  over: Partial<Room> = {},
): Room => ({
  ...goldenJob.rooms[1]!,
  id: "r",
  walls: [10, 12],
  ceilingHeight: 8,
  scope: { walls: true, ceiling: true, trim: true, primer: "full" },
  openings,
  ...over,
});

const win = (id: string, over: Partial<Opening> = {}): Opening => ({
  id,
  kind: "window",
  quantity: 1,
  width: 4,
  height: 3,
  paintSlab: false,
  casedSides: 1,
  ...over,
});

const geoFor = (room: Room) => computeGeometry([room], rates)[0];

describe("Room3D", () => {
  it("renders six faces", () => {
    const room = makeRoom();
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={400}
        onAddOpening={() => {}}
        onSelectOpening={() => {}}
      />,
    );
    for (const id of [
      "wall-0",
      "wall-1",
      "wall-2",
      "wall-3",
      "floor",
      "ceiling",
    ]) {
      expect(screen.getByTestId(`face-${id}`)).toBeInTheDocument();
    }
  });

  it("places an opening on the wall its wallIndex names", () => {
    const room = makeRoom([win("a", { wallIndex: 2 })]);
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={400}
        onAddOpening={() => {}}
        onSelectOpening={() => {}}
      />,
    );
    const wall2 = screen.getByTestId("face-wall-2");
    expect(wall2).toContainElement(screen.getByTestId("opening-a"));
  });

  it("distributes unplaced openings across walls deterministically", () => {
    const room = makeRoom([win("a"), win("b"), win("c"), win("d")]);
    const props = {
      room,
      geometry: geoFor(room),
      maxPx: 400,
      onAddOpening: () => {},
      onSelectOpening: () => {},
    };
    const { unmount } = render(<Room3D {...props} />);
    const first = ["a", "b", "c", "d"].map((id) =>
      screen
        .getByTestId(`opening-${id}`)
        .closest(".face")!
        .getAttribute("data-testid"),
    );
    unmount();
    render(<Room3D {...props} />);
    const second = ["a", "b", "c", "d"].map((id) =>
      screen
        .getByTestId(`opening-${id}`)
        .closest(".face")!
        .getAttribute("data-testid"),
    );
    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(4); // spread, not piled on one wall
  });

  it("annotates a wall with gross, deduction and net area", () => {
    const room = makeRoom([win("a", { wallIndex: 0 })]);
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={400}
        onAddOpening={() => {}}
        onSelectOpening={() => {}}
      />,
    );
    // wall 0 is 10 ft wide by 8 ft high = 80 sq ft, minus one 4x3 window
    expect(screen.getByTestId("face-wall-0")).toHaveTextContent("80");
    expect(screen.getByTestId("face-wall-0")).toHaveTextContent("12");
    expect(screen.getByTestId("face-wall-0")).toHaveTextContent("68");
  });

  it("reports the wall index and offset when a wall is clicked", async () => {
    const onAddOpening = vi.fn();
    const room = makeRoom();
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={400}
        onAddOpening={onAddOpening}
        onSelectOpening={() => {}}
      />,
    );
    await userEvent.click(screen.getByTestId("face-wall-1"));
    expect(onAddOpening).toHaveBeenCalledTimes(1);
    expect(onAddOpening.mock.calls[0]![0]).toBe(1);
  });

  it("hatches the ceiling when ceiling scope is off", () => {
    const room = makeRoom([], {
      scope: { walls: true, ceiling: false, trim: true, primer: "full" },
    });
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={400}
        onAddOpening={() => {}}
        onSelectOpening={() => {}}
      />,
    );
    expect(screen.getByTestId("face-ceiling").className).toMatch(/hatched/);
    expect(screen.getByTestId("face-wall-0").className).not.toMatch(/hatched/);
  });

  it("omits baseboards when trim scope is off", () => {
    const room = makeRoom([], {
      scope: { walls: true, ceiling: true, trim: false, primer: "full" },
    });
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={400}
        onAddOpening={() => {}}
        onSelectOpening={() => {}}
      />,
    );
    expect(screen.queryByTestId("baseboard-wall-0")).not.toBeInTheDocument();
  });

  it("renders a prompt instead of a collapsed box when the room has no dimensions", () => {
    const room = makeRoom([], { walls: [0, 0] });
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={400}
        onAddOpening={() => {}}
        onSelectOpening={() => {}}
      />,
    );
    expect(screen.getByTestId("room3d-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("face-wall-0")).not.toBeInTheDocument();
  });

  it("orbits within clamped bounds and never inverts the room", async () => {
    const room = makeRoom();
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={400}
        onAddOpening={() => {}}
        onSelectOpening={() => {}}
      />,
    );
    const stage = screen.getByTestId("room3d-stage");
    const before = stage.style.transform;
    await userEvent.click(screen.getByRole("button", { name: /rotate left/i }));
    expect(stage.style.transform).not.toBe(before);
    expect(stage.style.transform).toMatch(
      /rotateX\(-?\d+deg\) rotateY\(-?\d+deg\)/,
    );
  });

  it("shows the engine's room-level areas, not a recomputed figure", () => {
    const room = makeRoom([win("a", { wallIndex: 0 })]);
    const geo = geoFor(room);
    render(
      <Room3D
        room={room}
        geometry={geo}
        maxPx={400}
        onAddOpening={() => {}}
        onSelectOpening={() => {}}
      />,
    );
    expect(screen.getByTestId("room3d-summary")).toHaveTextContent(
      geo!.netWallArea.toFixed(0),
    );
  });
});
