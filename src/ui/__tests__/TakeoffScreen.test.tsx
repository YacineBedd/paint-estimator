import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TakeoffScreen } from "../TakeoffScreen";
import { newOpening } from "../OpeningsEditor";
import { goldenJob } from "../../engine/__fixtures__/goldenJob";
import { newProject } from "../../data/defaults";
import type { Project } from "../../engine/types";

describe("TakeoffScreen", () => {
  it("renders one row per room", () => {
    render(<TakeoffScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByDisplayValue("Salle de bains")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Kitchen/dining/kitchen"),
    ).toBeInTheDocument();
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

  it("removes a room", async () => {
    const onChange = vi.fn();
    render(<TakeoffScreen project={goldenJob} onChange={onChange} />);
    await userEvent.click(
      screen.getAllByRole("button", { name: /remove room/i })[0]!,
    );
    expect(onChange.mock.calls[0]![0].rooms).toHaveLength(
      goldenJob.rooms.length - 1,
    );
  });

  it("edits a wall dimension and reports it upward", async () => {
    const onChange = vi.fn();
    render(<TakeoffScreen project={goldenJob} onChange={onChange} />);
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

  it("adds a door to a room and deducts its area", async () => {
    const onChange = vi.fn();
    render(<TakeoffScreen project={goldenJob} onChange={onChange} />);
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
      await userEvent.selectOptions(
        screen.getAllByLabelText(/cased sides/i)[0]!,
        "1",
      );
      const last = onChange.mock.calls.at(-1)![0];
      expect(last.rooms[0].openings[0].casedSides).toBe(1);
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
    const geometryText = () =>
      container.querySelector(".room-geometry")?.textContent ?? "";

    // perimeter (10+10)*2=40 * height 8 = 320 sq ft gross, no openings yet.
    expect(geometryText()).toContain("320");

    await userEvent.click(screen.getByRole("button", { name: /add door/i }));

    // default door is 3x7=21 sq ft; net wall area should drop to 299.
    expect(geometryText()).toContain("299");
    expect(geometryText()).not.toContain("320 sq ft");
  });
});
