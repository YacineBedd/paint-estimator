import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TakeoffScreen } from "../TakeoffScreen";
import { newOpening } from "../OpeningsEditor";
import { goldenJob } from "../../engine/__fixtures__/goldenJob";
import { newProject } from "../../data/defaults";
import { computeEstimate } from "../../engine/estimate";
import type { Project } from "../../engine/types";

// ---------------------------------------------------------------------
// Query helpers for the redesigned takeoff.
//
// The screen now opens on a compact room LIST — one row per room, name,
// size and its labour value — and a room's own fields live in a focused
// editor one tap away. Nothing about what these tests ASSERT has changed;
// what changed is that a test touching a field inside a room has to open
// that room first, exactly as the painter does. Product selects and the
// paint-scope checkboxes moved one level further in, behind the "More"
// disclosure, so tests that drive them open that too.
// ---------------------------------------------------------------------

/** Tap a room's row in the list to open its editor. */
const openRoom = (roomId: string) =>
  userEvent.click(screen.getByTestId(`room-card-${roomId}`));

/** Open the "More" panel inside an already-open room editor. */
const openMore = () =>
  userEvent.click(screen.getByRole("button", { name: /^more/i }));

/** Open a labelled disclosure on the list view, e.g. "Other surfaces". */
const openPanel = (name: RegExp) =>
  userEvent.click(screen.getByRole("button", { name }));

describe("TakeoffScreen", () => {
  it("renders one row per room", () => {
    render(<TakeoffScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByText("Salle de bains")).toBeInTheDocument();
    expect(screen.getByText("Kitchen/dining/kitchen")).toBeInTheDocument();
  });

  it("shows live totals for the golden job", () => {
    render(<TakeoffScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByTestId("total-hours")).toHaveTextContent("39.9");
    expect(screen.getByTestId("total-billed")).toHaveTextContent("47");
    expect(screen.getByTestId("total-price")).toHaveTextContent("4,4");
  });

  it("adds a room", async () => {
    const onChange = vi.fn();
    render(<TakeoffScreen project={goldenJob} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /add room/i }));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0]![0].rooms).toHaveLength(
      goldenJob.rooms.length + 1,
    );
  });

  // A new room inherits the previous room's ceiling height (8 ft in nearly
  // every room of nearly every house) and starts with unmeasured walls,
  // which the editor renders as an empty field rather than a literal 0.
  it("carries the previous room's ceiling height into a new room", async () => {
    const onChange = vi.fn();
    const tallHouse: Project = {
      ...goldenJob,
      rooms: [{ ...goldenJob.rooms[0]!, ceilingHeight: 9.5 }],
    };
    render(<TakeoffScreen project={tallHouse} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /add room/i }));

    const added = onChange.mock.calls[0]![0].rooms.at(-1);
    expect(added.ceilingHeight).toBe(9.5);
    expect(added.walls).toEqual([0, 0]);
  });

  it("defaults a first room's ceiling height to 8", async () => {
    const onChange = vi.fn();
    const empty = newProject("empty house", "eh1");
    render(<TakeoffScreen project={empty} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /add room/i }));
    expect(onChange.mock.calls[0]![0].rooms[0].ceilingHeight).toBe(8);
  });

  // A wall length of 0 is what the engine reads as "no dimensions". Showing
  // a literal 0 in the field makes him delete it before he can type, so an
  // unmeasured wall renders as an empty field with a placeholder instead.
  it("shows an unmeasured wall as an empty field, not a zero", async () => {
    const unmeasured: Project = {
      ...newProject("fresh", "f1"),
      rooms: [{ ...goldenJob.rooms[0]!, id: "fresh-1", walls: [0, 0] }],
    };
    render(<TakeoffScreen project={unmeasured} onChange={() => {}} />);
    await openRoom("fresh-1");
    expect(screen.getByLabelText(/wall 1/i)).toHaveValue(null);
    expect(screen.getByLabelText(/wall 2/i)).toHaveValue(null);
  });

  // Removing a room now lives at the bottom of the editor (not opposite the
  // back button) and needs a second, explicit tap to confirm — a mis-tap
  // should never silently erase a measured room.
  it("removes a room", async () => {
    const onChange = vi.fn();
    render(<TakeoffScreen project={goldenJob} onChange={onChange} />);
    await openRoom("r1");
    await userEvent.click(
      screen.getAllByRole("button", { name: /^remove room$/i })[0]!,
    );
    // The first tap only arms the confirmation; it must not remove anything
    // by itself.
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: /confirm remove room/i }),
    );
    expect(onChange.mock.calls[0]![0].rooms).toHaveLength(
      goldenJob.rooms.length - 1,
    );
  });

  it("cancels a room removal without erasing the room", async () => {
    const onChange = vi.fn();
    render(<TakeoffScreen project={goldenJob} onChange={onChange} />);
    await openRoom("r1");
    await userEvent.click(
      screen.getAllByRole("button", { name: /^remove room$/i })[0]!,
    );
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/room name/i)).toBeInTheDocument();
  });

  it("edits a wall dimension and reports it upward", async () => {
    const onChange = vi.fn();
    render(<TakeoffScreen project={goldenJob} onChange={onChange} />);
    await openRoom("r1");
    const input = screen.getAllByLabelText(/wall 1/i)[0]!;
    await userEvent.clear(input);
    await userEvent.type(input, "20");
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)![0];
    expect(last.rooms[0].walls[0]).toBe(20);
  });

  it("surfaces engine warnings", () => {
    const withBlank = {
      ...goldenJob,
      rooms: [
        ...goldenJob.rooms,
        { ...goldenJob.rooms[1]!, id: "blank", name: "salon", walls: [0, 0] },
      ],
    };
    render(<TakeoffScreen project={withBlank} onChange={() => {}} />);
    expect(screen.getByText(/no dimensions/i)).toBeInTheDocument();
  });

  // The same EMPTY_ROOM warning, deferred: scolding him for a room with no
  // dimensions while he is standing in that room mid-measurement is noise.
  // It is not suppressed — the test above proves it is on the list view,
  // and ResultsScreen shows it too — only held back while that one room is
  // open. Other warnings for the open room still show.
  it("defers the no-dimensions warning while that room is open for editing", async () => {
    const withBlank: Project = {
      ...goldenJob,
      rooms: [
        ...goldenJob.rooms,
        { ...goldenJob.rooms[1]!, id: "blank", name: "salon", walls: [0, 0] },
      ],
    };
    render(<TakeoffScreen project={withBlank} onChange={() => {}} />);
    expect(screen.getByText(/no dimensions/i)).toBeInTheDocument();

    await openRoom("blank");
    expect(screen.queryByText(/no dimensions/i)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /back to rooms list/i }),
    );
    expect(screen.getByText(/no dimensions/i)).toBeInTheDocument();
  });

  it("adds a door to a room and deducts its area", async () => {
    const onChange = vi.fn();
    render(<TakeoffScreen project={goldenJob} onChange={onChange} />);
    await openRoom("r1");
    await userEvent.click(
      screen.getAllByRole("button", { name: /add door/i })[0]!,
    );
    const updated = onChange.mock.calls.at(-1)![0];
    expect(updated.rooms[0].openings).toHaveLength(1);
    expect(updated.rooms[0].openings[0].kind).toBe("door");
  });

  describe("opening fields", () => {
    // A room whose first room already has one door, so the opening's own
    // input fields (Qty/W/H/Cased sides) are on screen without needing an
    // "Add door" click first (which itself needs state feedback to render).
    const withDoor: Project = {
      ...goldenJob,
      rooms: [
        { ...goldenJob.rooms[0]!, openings: [newOpening("door", "test-door")] },
        ...goldenJob.rooms.slice(1),
      ],
    };

    it("typing a new opening width updates the field and reports it upward", async () => {
      const onChange = vi.fn();
      render(<TakeoffScreen project={withDoor} onChange={onChange} />);
      await openRoom("r1");
      const width = screen.getAllByLabelText(/^w$/i)[0]!;
      await userEvent.clear(width);
      await userEvent.type(width, "5");
      expect(width).toHaveValue(5);
      const last = onChange.mock.calls.at(-1)![0];
      expect(last.rooms[0].openings[0].width).toBe(5);
    });

    it("typing a new opening height updates the field and reports it upward", async () => {
      const onChange = vi.fn();
      render(<TakeoffScreen project={withDoor} onChange={onChange} />);
      await openRoom("r1");
      const height = screen.getAllByLabelText(/^h$/i)[0]!;
      await userEvent.clear(height);
      await userEvent.type(height, "8");
      expect(height).toHaveValue(8);
      const last = onChange.mock.calls.at(-1)![0];
      expect(last.rooms[0].openings[0].height).toBe(8);
    });

    it("typing a new opening quantity updates the field and reports it upward", async () => {
      const onChange = vi.fn();
      render(<TakeoffScreen project={withDoor} onChange={onChange} />);
      await openRoom("r1");
      const quantity = screen.getAllByLabelText(/qty/i)[0]!;
      await userEvent.clear(quantity);
      await userEvent.type(quantity, "2");
      expect(quantity).toHaveValue(2);
      const last = onChange.mock.calls.at(-1)![0];
      expect(last.rooms[0].openings[0].quantity).toBe(2);
    });

    it("changing cased sides on an opening reports the new value upward", async () => {
      const onChange = vi.fn();
      render(<TakeoffScreen project={withDoor} onChange={onChange} />);
      await openRoom("r1");
      await userEvent.selectOptions(
        screen.getAllByLabelText(/cased sides/i)[0]!,
        "1",
      );
      const last = onChange.mock.calls.at(-1)![0];
      expect(last.rooms[0].openings[0].casedSides).toBe(1);
    });
  });

  // F2: a bathroom is priced as a bedroom until its wall/ceiling/trim
  // products are reachable in the UI. Selecting a different wall product for
  // a room must be enough to move that room's area to the new product's
  // material requirement.
  //
  // The reachability half of this test used to be "there are as many wall
  // product selects on screen as there are rooms". That is no longer the
  // shape of the screen — three permanent selects per room were the single
  // biggest reason one room ran to ~1000px — so it is asserted the way the
  // redesign makes it true: every room has a row in the list, and opening
  // any one of them reaches that room's wall product. The behavioural
  // assertions below (K532 selected, and the estimate's allocation moving
  // from 549 to K532) are unchanged.
  it("selecting Aura for a room's walls moves the estimate's allocation to Aura (F2)", async () => {
    const onChange = vi.fn();
    render(<TakeoffScreen project={goldenJob} onChange={onChange} />);

    expect(screen.getAllByTestId(/^room-card-/)).toHaveLength(
      goldenJob.rooms.length,
    );

    // rooms order: bathroom(r1), bedroom1(r2), bedroom2(r3), kitchen(r4) —
    // bedroom 1 starts on Regal Select (549).
    await openRoom("r2");
    await openMore();
    const wallSelects = screen.getAllByLabelText(/wall product/i);
    expect(wallSelects).toHaveLength(1);
    await userEvent.selectOptions(wallSelects[0]!, "K532");

    const updated: Project = onChange.mock.calls.at(-1)![0];
    expect(updated.rooms[1]!.wallProductId).toBe("K532");

    const before = computeEstimate(goldenJob);
    const after = computeEstimate(updated);
    const auraArea = (est: ReturnType<typeof computeEstimate>) =>
      est.materials.requirements.find((r) => r.productId === "K532")
        ?.coatedArea ?? 0;
    const wallsArea = (est: ReturnType<typeof computeEstimate>) =>
      est.materials.requirements.find((r) => r.productId === "549")
        ?.coatedArea ?? 0;

    expect(auraArea(after)).toBeGreaterThan(auraArea(before));
    expect(wallsArea(after)).toBeLessThan(wallsArea(before));
  });

  // The other half of the disclosure's contract: closed by default, so the
  // three product selects and the scope checkboxes are genuinely not
  // occupying the editor until asked for.
  it("keeps products and paint scope closed behind 'More' by default", async () => {
    render(<TakeoffScreen project={goldenJob} onChange={() => {}} />);
    await openRoom("r1");

    expect(screen.queryByLabelText(/wall product/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ceiling product/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/trim product/i)).not.toBeInTheDocument();

    // Openings are core to the task and stay visible.
    expect(
      screen.getByRole("button", { name: /add door/i }),
    ).toBeInTheDocument();

    await openMore();
    expect(screen.getByLabelText(/wall product/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ceiling product/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/trim product/i)).toBeInTheDocument();
  });

  // F8: every door bills both faces by default with no way to turn it off.
  // Unchecking "Paint door faces" must drop that door's slab area to 0.
  it("unchecking 'Paint door faces' drops doorSlabArea to 0 (F8)", async () => {
    const withDoor: Project = {
      ...goldenJob,
      rooms: [
        { ...goldenJob.rooms[0]!, openings: [newOpening("door", "test-door")] },
        ...goldenJob.rooms.slice(1),
      ],
    };
    expect(withDoor.rooms[0]!.openings[0]!.paintSlab).toBe(true);

    const onChange = vi.fn();
    render(<TakeoffScreen project={withDoor} onChange={onChange} />);
    await openRoom("r1");

    const checkbox = screen.getByLabelText(/paint door faces/i);
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);

    const updated: Project = onChange.mock.calls.at(-1)![0];
    expect(updated.rooms[0]!.openings[0]!.paintSlab).toBe(false);

    const after = computeEstimate(updated);
    const room0Geometry = after.geometry.find(
      (g) => g.roomId === updated.rooms[0]!.id,
    )!;
    expect(room0Geometry.doorSlabArea).toBe(0);
  });

  describe("custom surfaces (F9)", () => {
    it("adds a custom surface and includes it in the estimate", async () => {
      const base = newProject("custom surface test", "cs-test");
      function Wrapper() {
        const [p, setP] = useState(base);
        return <TakeoffScreen project={p} onChange={setP} />;
      }
      render(<Wrapper />);

      await openPanel(/other surfaces/i);
      await userEvent.click(
        screen.getByRole("button", { name: /add custom surface/i }),
      );
      expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();

      const areaInput = screen.getByLabelText(/area/i);
      await userEvent.clear(areaInput);
      await userEvent.type(areaInput, "100");

      // Total hours should now reflect the custom surface's area at its
      // default rate (0.75 min/sq ft): 100 × 0.75 / 60 = 1.25 hrs.
      expect(screen.getByTestId("total-hours")).toHaveTextContent("1.3");
    });

    it("removes a custom surface", async () => {
      const base: Project = {
        ...newProject("custom surface test", "cs-test2"),
        customSurfaces: [
          {
            id: "cs-x",
            name: "Doors & trim",
            area: 280,
            rateMinPerSqFt: 0.75,
            productId: "550",
            coats: 1,
            includeInPrimer: true,
          },
        ],
      };
      const onChange = vi.fn();
      render(<TakeoffScreen project={base} onChange={onChange} />);

      await openPanel(/other surfaces/i);
      await userEvent.click(
        screen.getByRole("button", { name: /remove custom surface/i }),
      );
      const updated: Project = onChange.mock.calls.at(-1)![0];
      expect(updated.customSurfaces).toHaveLength(0);
    });
  });

  it("adding a door to a room reduces its rendered net wall area", async () => {
    const base = newProject("geometry test", "geo1");
    const project: Project = {
      ...base,
      rooms: [
        {
          id: "g1",
          name: "Test room",
          floor: 1,
          quantity: 1,
          walls: [10, 10],
          ceilingHeight: 8,
          scope: { walls: true, ceiling: true, trim: true, primer: "full" },
          wallProductId: "549",
          ceilingProductId: "K508",
          trimProductId: "550",
          openings: [],
        },
      ],
    };

    // computeEstimate isn't fed back into `project` unless the caller wires
    // onChange to state, so this test does that explicitly — it's checking
    // that a door added through the UI reaches the rendered geometry line,
    // not just that onChange fires with the right payload.
    function Wrapper() {
      const [p, setP] = useState(project);
      return <TakeoffScreen project={p} onChange={setP} />;
    }

    const { container } = render(<Wrapper />);
    await openRoom("g1");
    const geometryText = () =>
      container.querySelector(".room-geometry")?.textContent ?? "";

    // perimeter (10+10)*2=40 * height 8 = 320 sq ft gross, no openings yet.
    expect(geometryText()).toContain("320");

    await userEvent.click(screen.getByRole("button", { name: /add door/i }));

    // default door is 3x7=21 sq ft; net wall area should drop to 299.
    expect(geometryText()).toContain("299");
    expect(geometryText()).not.toContain("320 sq ft");
  });

  // The square-footage ballpark stopped being a fifth tab and became a way
  // to START a takeoff: front and centre while there are no rooms, tucked
  // behind a disclosure once there are rooms to look at instead.
  describe("square-footage starter", () => {
    it("is open on an empty takeoff", () => {
      render(
        <TakeoffScreen
          project={newProject("empty", "e1")}
          onChange={() => {}}
        />,
      );
      expect(screen.getByLabelText(/square feet/i)).toBeInTheDocument();
    });

    it("is tucked away once the takeoff has rooms", async () => {
      render(<TakeoffScreen project={goldenJob} onChange={() => {}} />);
      expect(screen.queryByLabelText(/square feet/i)).not.toBeInTheDocument();

      await openPanel(/start from square footage/i);
      expect(screen.getByLabelText(/square feet/i)).toBeInTheDocument();
    });
  });

  describe("List / Plan toggle", () => {
    it("shows the list by default", () => {
      render(<TakeoffScreen project={goldenJob} onChange={() => {}} />);
      expect(
        screen.getByRole("button", { name: /^list$/i }),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("floor-heading-1")).not.toBeInTheDocument();
    });

    it("switches to the plan and groups by floor", async () => {
      render(<TakeoffScreen project={goldenJob} onChange={() => {}} />);
      await userEvent.click(screen.getByRole("button", { name: /^plan$/i }));
      expect(screen.getByTestId("floor-heading-1")).toBeInTheDocument();
    });

    it("switches back to the list", async () => {
      render(<TakeoffScreen project={goldenJob} onChange={() => {}} />);
      await userEvent.click(screen.getByRole("button", { name: /^plan$/i }));
      await userEvent.click(screen.getByRole("button", { name: /^list$/i }));
      expect(screen.queryByTestId("floor-heading-1")).not.toBeInTheDocument();
    });

    // Room3DEditor renders RoomEditor internally (see Room3DEditor.tsx), so
    // an assertion on the room-name input alone passes whichever editor the
    // "plan" branch actually opens -- it would still pass even with the
    // ternary in TakeoffScreen deleted and Room3DEditor never rendered at
    // all. face-wall-0 only exists in the 3D view, so it's the one thing
    // that actually distinguishes "opened the 3D editor" from "opened the
    // plain field editor".
    it("opening a room from the plan opens the 3D editor", async () => {
      render(<TakeoffScreen project={goldenJob} onChange={() => {}} />);
      await userEvent.click(screen.getByRole("button", { name: /^plan$/i }));
      const first = goldenJob.rooms[0]!;
      await userEvent.click(screen.getByTestId(`plan-room-${first.id}`));
      expect(screen.getByDisplayValue(first.name)).toBeInTheDocument();
      expect(screen.getByTestId("face-wall-0")).toBeInTheDocument();
    });

    it("opening a room from the list does not open the 3D editor", async () => {
      render(<TakeoffScreen project={goldenJob} onChange={() => {}} />);
      const first = goldenJob.rooms[0]!;
      await openRoom(first.id);
      expect(screen.getByDisplayValue(first.name)).toBeInTheDocument();
      expect(screen.queryByTestId("face-wall-0")).not.toBeInTheDocument();
    });

    // The toggle belongs to the room-CHOOSING step, not the room-editing
    // step: once a room is open there is no "view" to switch between.
    it("hides the toggle while a room is open", async () => {
      render(<TakeoffScreen project={goldenJob} onChange={() => {}} />);
      await openRoom("r1");
      expect(
        screen.queryByRole("button", { name: /^list$/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^plan$/i }),
      ).not.toBeInTheDocument();
    });
  });
});
