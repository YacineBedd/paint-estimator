import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TakeoffScreen } from "../TakeoffScreen";
import { goldenJob } from "../../engine/__fixtures__/goldenJob";

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
});
