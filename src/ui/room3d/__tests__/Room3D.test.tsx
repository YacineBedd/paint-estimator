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

  it("indexes unplaced openings against the full array, not a filtered one", () => {
    // Regression guard: if wallFor's index came from a pre-filtered
    // unplaced-only list instead of room.openings, "c" would land on wall 1
    // (its position among unplaced openings) instead of wall 2 (its real
    // array position). Do not "simplify" this by filtering first.
    const room = makeRoom([
      win("a"), // index 0, unplaced -> wall 0
      win("b", { wallIndex: 2 }), // explicit -> wall 2
      win("c"), // index 2, unplaced -> wall 2 (2 % 4)
    ]);
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={400}
        onAddOpening={() => {}}
        onSelectOpening={() => {}}
      />,
    );
    const wallOf = (id: string) =>
      screen
        .getByTestId(`opening-${id}`)
        .closest(".face")!
        .getAttribute("data-testid");

    expect(wallOf("a")).toBe("face-wall-0");
    expect(wallOf("b")).toBe("face-wall-2");
    expect(wallOf("c")).toBe("face-wall-2");
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

  // F6: rounding gross, deduction and net independently with .toFixed(0)
  // can render an annotation whose own arithmetic doesn't add up -- an
  // 11.8 ft wall at 8 ft with one 2.5x5 opening used to show "94 - 13 =
  // 82" (true: 94.4 - 12.5 = 81.9; 94 - 13 = 81). The annotation's whole
  // purpose is letting him check our arithmetic against his own head, so
  // one decimal has to make it actually check out.
  it("annotates with one decimal so the displayed arithmetic adds up (F6)", () => {
    const room = makeRoom([win("a", { wallIndex: 0, width: 2.5, height: 5 })], {
      walls: [11.8, 12],
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
    expect(screen.getByTestId("face-wall-0")).toHaveTextContent(
      "94.4 − 12.5 = 81.9",
    );
  });

  // F7: the engine clamps net wall area at zero -- an opening can never
  // remove more wall than exists. A wall carrying enough opening area
  // (e.g. a wide double window) used to render a negative net, like
  // "80 − 105 = −25 sq ft", which the estimate never actually charges.
  it("clamps the displayed net area at zero rather than going negative (F7)", () => {
    const room = makeRoom([
      win("a", { wallIndex: 0, width: 10, height: 10, quantity: 1 }),
    ]);
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={400}
        onAddOpening={() => {}}
        onSelectOpening={() => {}}
      />,
    );
    // wall 0 is 10x8=80 sq ft gross; the 10x10 opening deducts 100 sq ft,
    // more than the wall itself -- net must read 0.0, never negative.
    expect(screen.getByTestId("face-wall-0")).toHaveTextContent(
      "80.0 − 100.0 = 0.0",
    );
    expect(screen.getByTestId("face-wall-0")).not.toHaveTextContent("−25");
    // The only "−" in the annotation is the gross/deduction separator,
    // immediately followed by the (positive) deduction figure -- never a
    // negative net.
    expect(screen.getByTestId("face-wall-0").textContent).toMatch(
      /= 0\.0 sq ft/,
    );
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

  // --- G1: selection threads through to the marker -------------------------

  it("forwards selectedOpeningId to the matching opening marker only", () => {
    const room = makeRoom([
      win("a", { wallIndex: 0 }),
      win("b", { wallIndex: 1 }),
    ]);
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={400}
        onAddOpening={() => {}}
        onSelectOpening={() => {}}
        selectedOpeningId="b"
      />,
    );
    expect(screen.getByTestId("opening-a").className).not.toMatch(
      /\bselected\b/,
    );
    expect(screen.getByTestId("opening-b").className).toMatch(/\bselected\b/);
  });

  it("calls onSelectOpening with the clicked marker's id", async () => {
    const onSelectOpening = vi.fn();
    const room = makeRoom([win("a", { wallIndex: 0 })]);
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={400}
        onAddOpening={() => {}}
        onSelectOpening={onSelectOpening}
      />,
    );
    await userEvent.click(screen.getByTestId("opening-a"));
    expect(onSelectOpening).toHaveBeenCalledWith("a");
  });

  // --- G3: the viewport is sized to the box's actual on-screen extent ------

  it("sets an explicit viewport height derived from the box, not a fixed constant", () => {
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
    const viewport = screen.getByTestId("room3d-viewport");
    expect(viewport.style.height).toMatch(/^\d+px$/);
  });

  it("keeps a floor height so a tiny room's viewport doesn't collapse", () => {
    const room = makeRoom([], { walls: [2, 2], ceilingHeight: 2 });
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={400}
        onAddOpening={() => {}}
        onSelectOpening={() => {}}
      />,
    );
    const viewport = screen.getByTestId("room3d-viewport");
    expect(viewport.style.height).toBe("320px");
  });

  it("caps the viewport height for a large room tilted to a steep pitch", async () => {
    // A cube-ish room rendered at a generous maxPx and driven to the
    // steepest allowed tilt pushes the raw box math (see Room3D's
    // verticalExtentPx comment) well past any sensible viewport height —
    // this asserts the cap actually clamps it rather than growing without
    // bound.
    const room = makeRoom([], { walls: [50, 50], ceilingHeight: 50 });
    render(
      <Room3D
        room={room}
        geometry={geoFor(room)}
        maxPx={1000}
        onAddOpening={() => {}}
        onSelectOpening={() => {}}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /rotate right/i }),
    );
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole("button", { name: /tilt down/i }));
    }
    const viewport = screen.getByTestId("room3d-viewport");
    expect(viewport.style.height).toBe("640px");
  });

  it("changes the viewport height when the tilt changes", async () => {
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
    const viewport = screen.getByTestId("room3d-viewport");
    const before = viewport.style.height;
    await userEvent.click(screen.getByRole("button", { name: /tilt down/i }));
    expect(viewport.style.height).not.toBe(before);
  });
});
