import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HousePlanScreen } from "../HousePlanScreen";
import { computeEstimate } from "../../engine/estimate";
import { goldenJob } from "../../engine/__fixtures__/goldenJob";
import type { Project } from "../../engine/types";

const twoFloors: Project = {
  ...goldenJob,
  rooms: [
    { ...goldenJob.rooms[0]!, id: "a", name: "Salle de bains", floor: 1 },
    { ...goldenJob.rooms[1]!, id: "b", name: "bedroom 1", floor: 2 },
    { ...goldenJob.rooms[2]!, id: "c", name: "Bedroom 2", floor: 2 },
  ],
};

const renderPlan = (project = twoFloors, onOpen = vi.fn()) => {
  const estimate = computeEstimate(project, Date.parse("2026-08-19T00:00:00Z"));
  render(
    <HousePlanScreen
      rooms={project.rooms}
      labor={estimate.labor}
      laborRate={project.rateProfile.laborRate}
      onOpen={onOpen}
    />,
  );
  return onOpen;
};

describe("HousePlanScreen", () => {
  it("groups rooms under their floor", () => {
    renderPlan();
    expect(screen.getByText(/floor 1/i)).toBeInTheDocument();
    expect(screen.getByText(/floor 2/i)).toBeInTheDocument();
  });

  it("lists every room", () => {
    renderPlan();
    expect(screen.getByText("Salle de bains")).toBeInTheDocument();
    expect(screen.getByText("bedroom 1")).toBeInTheDocument();
    expect(screen.getByText("Bedroom 2")).toBeInTheDocument();
  });

  it("orders floors ascending", () => {
    renderPlan();
    const headings = screen.getAllByTestId(/^floor-heading-/);
    expect(headings.map((h) => h.getAttribute("data-testid"))).toEqual([
      "floor-heading-1",
      "floor-heading-2",
    ]);
  });

  it("shows a labour subtotal per floor", () => {
    renderPlan();
    expect(screen.getByTestId("floor-total-2")).toBeInTheDocument();
  });

  it("opens a room when tapped", async () => {
    const onOpen = renderPlan();
    await userEvent.click(screen.getByText("bedroom 1"));
    expect(onOpen).toHaveBeenCalledWith("b");
  });

  it("shows each room's dimensions", () => {
    renderPlan();
    expect(screen.getByTestId("plan-room-a")).toHaveTextContent("11.8");
  });

  it("renders an empty state when there are no rooms", () => {
    renderPlan({ ...twoFloors, rooms: [] });
    expect(screen.getByTestId("plan-empty")).toBeInTheDocument();
  });

  it("puts rooms with no floor set into floor 1 rather than dropping them", () => {
    const noFloor = {
      ...twoFloors,
      rooms: [{ ...twoFloors.rooms[0]!, id: "x", name: "Orphan", floor: 0 }],
    };
    renderPlan(noFloor);
    expect(screen.getByText("Orphan")).toBeInTheDocument();
  });
});
