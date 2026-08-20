import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HousePlanScreen } from "../HousePlanScreen";
import { RoomList } from "../RoomList";
import { formatMoney } from "../format";
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
    // Asserting the text exists anywhere on the page would still pass if the
    // floor-0 guard were removed, because the room would then render under
    // its own "Floor 0" section instead of vanishing. The guard's actual
    // promise is that it lands under FLOOR 1 specifically, and that no
    // separate floor-0 section exists at all.
    const floor1 = screen.getByTestId("floor-heading-1");
    expect(floor1.closest("section")).toHaveTextContent("Orphan");
    expect(screen.queryByTestId("floor-heading-0")).not.toBeInTheDocument();
  });

  // labor.rooms mixes real-room rows with custom-surface rows keyed by the
  // surface's own id (see src/engine/labor.ts), and goldenJob — which
  // twoFloors spreads — carries a real custom surface (cs1, 4 billed hours).
  // Asserting only that a floor-total node EXISTS would still pass if a
  // regression summed over the whole labor.rooms array instead of the
  // rooms actually on that floor; an exact expected value catches it.
  it("computes a floor's labour subtotal from that floor's rooms only, excluding custom surfaces", () => {
    renderPlan();
    // Floor 2 = bedroom 1 (id "b", billed 6h per GOLDEN_EXPECTED.perRoom.r2)
    // + bedroom 2 (id "c", billed 7h per GOLDEN_EXPECTED.perRoom.r3) = 13h,
    // at the golden job's $75/hr labour rate = $975.00. cs1's own 4 billed
    // hours must NOT be folded into this — it belongs to no floor.
    expect(screen.getByTestId("floor-total-2")).toHaveTextContent(
      formatMoney(13 * 75),
    );
  });

  // RoomList's convention for "nothing measured yet" is formatRoomSize
  // returning null, rendered as the string "not measured yet" — not a
  // literal "0 × 0". The plan has to say the same thing about the same
  // room, or the two screens disagree about a room neither of them has
  // actually seen.
  it("reads an unmeasured room's dimensions the same way RoomList does", () => {
    const unmeasured: Project = {
      ...twoFloors,
      rooms: [
        { ...twoFloors.rooms[0]!, id: "u", name: "Fresh room", walls: [0, 0] },
      ],
    };
    const estimate = computeEstimate(
      unmeasured,
      Date.parse("2026-08-19T00:00:00Z"),
    );
    const onOpen = vi.fn();

    const plan = render(
      <HousePlanScreen
        rooms={unmeasured.rooms}
        labor={estimate.labor}
        laborRate={unmeasured.rateProfile.laborRate}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByTestId("plan-room-u")).toHaveTextContent(
      "not measured yet",
    );
    plan.unmount();

    render(
      <RoomList
        rooms={unmeasured.rooms}
        labor={estimate.labor}
        laborRate={unmeasured.rateProfile.laborRate}
        warnings={estimate.warnings}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByTestId("room-card-u")).toHaveTextContent(
      "not measured yet",
    );
  });

  // F9: RoomList rendered a room's billed hours raw ({billed} h), which
  // with "round each room up to whole hours" off can be a long floating-
  // point value straight out of the engine. HousePlanScreen already routes
  // the same figure through formatHours; RoomList has to match, or the two
  // screens show two different-looking numbers for the identical room.
  it("formats a room's billed hours to one decimal, never a raw float (F9)", () => {
    const unrounded: Project = {
      ...twoFloors,
      rateProfile: { ...twoFloors.rateProfile, roundRoomHoursUp: false },
    };
    const estimate = computeEstimate(
      unrounded,
      Date.parse("2026-08-19T00:00:00Z"),
    );
    render(
      <RoomList
        rooms={unrounded.rooms}
        labor={estimate.labor}
        laborRate={unrounded.rateProfile.laborRate}
        warnings={estimate.warnings}
        onOpen={() => {}}
      />,
    );
    const text = screen.getByTestId("room-card-a").textContent ?? "";
    expect(text).toMatch(/\d+\.\d h(?!\d)/);
  });
});
