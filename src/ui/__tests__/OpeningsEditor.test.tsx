import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { newOpening, OpeningsEditor } from "../OpeningsEditor";

describe("newOpening defaults", () => {
  // F1: a window is cased on its interior face only -- the exterior face is
  // siding/brick, not something this estimate touches. Defaulting a window
  // to casedSides: 2 (both sides, like an interior door) overstates its
  // casing linear footage enough that placing a 4x3 window RAISES the bid
  // instead of lowering it: 28 lin ft of casing (14 sq ft of trim at the
  // 0.5 ft girth) against only 12 sq ft of wall removed.
  //
  // Verified on a 10x12x8 room: no window $794.62; casedSides: 2 $796.49
  // (up); casedSides: 1 $789.93 (down, correctly).
  it("defaults a window to one cased side", () => {
    const o = newOpening("window", "w1");
    expect(o.casedSides).toBe(1);
  });

  // A door is genuinely cased both sides -- both faces of its frame are
  // interior. This must not regress alongside the window fix.
  it("defaults a door to two cased sides", () => {
    const o = newOpening("door", "d1");
    expect(o.casedSides).toBe(2);
  });

  // A passage (interior opening, no door slab) is likewise interior on
  // both faces.
  it("defaults a passage to two cased sides", () => {
    const o = newOpening("passage", "p1");
    expect(o.casedSides).toBe(2);
  });
});

// G1: the 3D view can now select an opening (clicking its marker), and the
// panel's own opening list needs to reflect and scroll to that selection so
// the two halves of the screen agree on what's selected.
describe("OpeningsEditor selection (G1)", () => {
  // jsdom does not implement scrollIntoView at all — calling the real thing
  // throws "not implemented" and fails every test that renders a selected
  // row, not just the ones that assert on it. Stub it for the whole block;
  // individual tests below replace it with their own vi.fn() when they need
  // to inspect the calls.
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gives every row a stable data-testid for the 3D-to-list link", () => {
    const openings = [newOpening("door", "d1"), newOpening("window", "w1")];
    render(<OpeningsEditor openings={openings} onChange={() => {}} />);
    expect(screen.getByTestId("opening-row-d1")).toBeInTheDocument();
    expect(screen.getByTestId("opening-row-w1")).toBeInTheDocument();
  });

  it("marks the row matching selectedId as selected and leaves the rest alone", () => {
    const openings = [newOpening("door", "d1"), newOpening("window", "w1")];
    render(
      <OpeningsEditor
        openings={openings}
        onChange={() => {}}
        selectedId="w1"
      />,
    );
    expect(screen.getByTestId("opening-row-w1").className).toMatch(
      /\bselected\b/,
    );
    expect(screen.getByTestId("opening-row-d1").className).not.toMatch(
      /\bselected\b/,
    );
  });

  it("omitting selectedId — the plain (non-3D) list path — selects nothing", () => {
    const openings = [newOpening("door", "d1")];
    render(<OpeningsEditor openings={openings} onChange={() => {}} />);
    expect(screen.getByTestId("opening-row-d1").className).not.toMatch(
      /\bselected\b/,
    );
  });

  it("null selectedId also selects nothing", () => {
    const openings = [newOpening("door", "d1")];
    render(
      <OpeningsEditor
        openings={openings}
        onChange={() => {}}
        selectedId={null}
      />,
    );
    expect(screen.getByTestId("opening-row-d1").className).not.toMatch(
      /\bselected\b/,
    );
  });

  // jsdom does not implement scrollIntoView at all (calling it throws
  // "not implemented"), so it must be stubbed before any row can become
  // selected under test.
  it("scrolls the row into view when it becomes selected", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const openings = [newOpening("door", "d1"), newOpening("window", "w1")];
    const { rerender } = render(
      <OpeningsEditor
        openings={openings}
        onChange={() => {}}
        selectedId={null}
      />,
    );
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(
      <OpeningsEditor
        openings={openings}
        onChange={() => {}}
        selectedId="w1"
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  // The effect must key off the id becoming selected, not fire on every
  // render of an already-selected row (e.g. while its own fields are being
  // typed into).
  it("does not scroll again on an unrelated re-render of an already-selected row", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const openings = [newOpening("door", "d1")];
    const onChange = vi.fn();
    const { rerender } = render(
      <OpeningsEditor
        openings={openings}
        onChange={onChange}
        selectedId="d1"
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    // Re-render with the same props (simulating an unrelated parent
    // re-render) — still selected, should not scroll a second time.
    rerender(
      <OpeningsEditor
        openings={openings}
        onChange={onChange}
        selectedId="d1"
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("moving selection to a different row scrolls that row instead", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const openings = [newOpening("door", "d1"), newOpening("window", "w1")];
    const { rerender } = render(
      <OpeningsEditor
        openings={openings}
        onChange={() => {}}
        selectedId="d1"
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(
      <OpeningsEditor
        openings={openings}
        onChange={() => {}}
        selectedId="w1"
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
