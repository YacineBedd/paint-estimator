import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultsScreen } from "../ResultsScreen";
import { goldenJob } from "../../engine/__fixtures__/goldenJob";

describe("ResultsScreen", () => {
  it("shows hours worked, billed, and travel separately", () => {
    render(<ResultsScreen project={goldenJob} />);
    expect(screen.getByTestId("hours-worked")).toHaveTextContent("39.9");
    expect(screen.getByTestId("hours-billed-rooms")).toHaveTextContent("42");
    expect(screen.getByTestId("hours-travel")).toHaveTextContent("5");
    expect(screen.getByTestId("hours-total")).toHaveTextContent("47");
  });

  it("shows what the roundup and travel are worth in dollars", () => {
    render(<ResultsScreen project={goldenJob} />);
    // (42 − 39.9145) × 75 = $156.41
    expect(screen.getByTestId("roundup-value")).toHaveTextContent("156");
    // 5 × 75 = $375.00
    expect(screen.getByTestId("travel-value")).toHaveTextContent("375");
  });

  it("shows 5 crew-days", () => {
    render(<ResultsScreen project={goldenJob} />);
    expect(screen.getByTestId("crew-days")).toHaveTextContent("5");
    // ...spelled with a hyphen, not an em-dash: "crew-day" is a compound
    // noun, and this line goes in front of a client.
    expect(screen.getByTestId("crew-days")).toHaveTextContent("5 crew-days");
  });

  // The unit used to be hard-coded plural with the wrong dash, so a
  // one-day job read "1 crew—days".
  it("says '1 crew-day', singular, on a one-day job", () => {
    const oneDay = {
      ...goldenJob,
      rooms: [goldenJob.rooms[0]!],
      customSurfaces: [],
    };
    render(<ResultsScreen project={oneDay} />);
    const crewDays = screen.getByTestId("crew-days");
    expect(crewDays).toHaveTextContent("1 crew-day");
    expect(crewDays.textContent).not.toMatch(/crew-days/);
    expect(crewDays.textContent).not.toMatch(/—/);
  });

  it("lists every product with its gallons", () => {
    render(<ResultsScreen project={goldenJob} />);
    expect(screen.getByText(/Regal Select/)).toBeInTheDocument();
    expect(screen.getByText(/Aura Bath & Spa/)).toBeInTheDocument();
    expect(screen.getByText(/Waterborne Ceiling/)).toBeInTheDocument();
  });

  it("shows labor $3,525.00", () => {
    render(<ResultsScreen project={goldenJob} />);
    expect(screen.getByTestId("labor-cost")).toHaveTextContent("3,525");
  });

  // F6: a hard OPENINGS_EXCEED_WALL validation error must be visible on the
  // results screen, not just on the takeoff screen — a painter looking only
  // at the printed total should not miss it.
  it("surfaces a hard error (OPENINGS_EXCEED_WALL) that TakeoffScreen already catches", () => {
    const overfilled = {
      ...goldenJob,
      rooms: [
        {
          ...goldenJob.rooms[1]!,
          id: "tiny",
          walls: [2, 2],
          ceilingHeight: 8,
          scope: {
            walls: true,
            ceiling: true,
            trim: true,
            primer: "full" as const,
          },
          openings: [
            {
              id: "o1",
              kind: "window" as const,
              quantity: 20,
              width: 4,
              height: 3,
              paintSlab: false,
              casedSides: 1 as const,
            },
          ],
        },
      ],
    };
    render(<ResultsScreen project={overfilled} />);
    const errors = screen.getByTestId("results-errors");
    expect(errors).toBeInTheDocument();
    expect(errors.textContent).toMatch(/doors and windows/i);
  });

  it("renders no error list on a clean job", () => {
    render(<ResultsScreen project={goldenJob} />);
    expect(screen.queryByTestId("results-errors")).not.toBeInTheDocument();
  });
});
