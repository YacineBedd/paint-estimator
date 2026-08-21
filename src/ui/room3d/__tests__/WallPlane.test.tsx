import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WallPlane } from "../WallPlane";
import { projectRoom } from "../projection";
import type { Opening } from "../../../engine/types";

const proj = projectRoom(10, 12, 8, 400);
const wall0 = proj.faces.find((f) => f.wallIndex === 0)!;

const win = (over: Partial<Opening> = {}): Opening => ({
  id: "w1",
  kind: "window",
  quantity: 1,
  width: 4,
  height: 3,
  paintSlab: false,
  casedSides: 1,
  ...over,
});

const base = {
  face: wall0,
  scale: proj.scale,
  inScope: true,
  showTrim: true,
  annotation: "10 × 8 = 80 sq ft",
  onPlace: () => {},
  onSelectOpening: () => {},
};

describe("WallPlane", () => {
  it("renders the face with its projected transform", () => {
    render(<WallPlane {...base} openings={[]} />);
    const el = screen.getByTestId("face-wall-0");
    expect(el).toBeInTheDocument();
    expect(el.style.transform).toBe(wall0.transform);
  });

  it("renders one marker per opening", () => {
    render(<WallPlane {...base} openings={[win(), win({ id: "w2" })]} />);
    expect(screen.getByTestId("opening-w1")).toBeInTheDocument();
    expect(screen.getByTestId("opening-w2")).toBeInTheDocument();
  });

  it("shows the annotation", () => {
    render(<WallPlane {...base} openings={[]} />);
    expect(screen.getByText("10 × 8 = 80 sq ft")).toBeInTheDocument();
  });

  it("draws baseboard when trim is on and omits it when off", () => {
    const { rerender } = render(<WallPlane {...base} openings={[]} />);
    expect(screen.getByTestId("baseboard-wall-0")).toBeInTheDocument();
    rerender(<WallPlane {...base} showTrim={false} openings={[]} />);
    expect(screen.queryByTestId("baseboard-wall-0")).not.toBeInTheDocument();
  });

  it("marks an out-of-scope face as hatched", () => {
    render(<WallPlane {...base} inScope={false} openings={[]} />);
    expect(screen.getByTestId("face-wall-0").className).toMatch(/hatched/);
  });

  it("reports a normalised offset when the wall is clicked", async () => {
    const onPlace = vi.fn();
    render(<WallPlane {...base} onPlace={onPlace} openings={[]} />);
    const el = screen.getByTestId("face-wall-0");
    // jsdom reports zero-size rects, so the component must fall back to 0.5
    // rather than dividing by zero.
    await userEvent.click(el);
    expect(onPlace).toHaveBeenCalledTimes(1);
    const offset = onPlace.mock.calls[0]![0];
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThanOrEqual(1);
  });

  it("computes the offset from clientX and the measured rect, not just the fallback range", () => {
    // jsdom's getBoundingClientRect() is always zero-size, so without
    // stubbing it every click test above falls into the ": 0.5" fallback
    // branch and never exercises (clientX - rect.left) / rect.width. Stub a
    // real box here so a mutation to that formula (wrong axis, swapped
    // operands, clientY instead of clientX) would fail these assertions.
    const rect: DOMRect = {
      left: 100,
      top: 0,
      width: 200,
      height: 100,
      right: 300,
      bottom: 100,
      x: 100,
      y: 0,
      toJSON() {
        return this;
      },
    };
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(rect);

    try {
      const cases: Array<[number, number]> = [
        [150, 0.25], // a quarter of the way across
        [100, 0], // left edge
        [300, 1], // right edge
        [50, 0], // left of the face, clamped
        [400, 1], // right of the face, clamped
      ];

      for (const [clientX, expected] of cases) {
        const onPlace = vi.fn();
        const { unmount } = render(
          <WallPlane {...base} onPlace={onPlace} openings={[]} />,
        );
        const el = screen.getByTestId("face-wall-0");
        fireEvent.click(el, { clientX });
        expect(onPlace).toHaveBeenCalledTimes(1);
        expect(onPlace.mock.calls[0]![0]).toBe(expected);
        unmount();
      }
    } finally {
      spy.mockRestore();
    }
  });

  it("does not report a placement when the face is out of scope", async () => {
    const onPlace = vi.fn();
    render(
      <WallPlane {...base} inScope={false} onPlace={onPlace} openings={[]} />,
    );
    await userEvent.click(screen.getByTestId("face-wall-0"));
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("selects an opening without also placing a new one", async () => {
    const onPlace = vi.fn();
    const onSelectOpening = vi.fn();
    render(
      <WallPlane
        {...base}
        onPlace={onPlace}
        onSelectOpening={onSelectOpening}
        openings={[win()]}
      />,
    );
    await userEvent.click(screen.getByTestId("opening-w1"));
    expect(onSelectOpening).toHaveBeenCalledWith("w1");
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("draws casing on an opening with cased sides and omits it at zero", () => {
    const { rerender } = render(<WallPlane {...base} openings={[win()]} />);
    expect(screen.getByTestId("opening-w1").className).toMatch(/cased/);
    rerender(<WallPlane {...base} openings={[win({ casedSides: 0 })]} />);
    expect(screen.getByTestId("opening-w1").className).not.toMatch(/cased/);
  });

  // F4: the engine zeroes casingLinFt whenever scope.trim is off (see
  // geometry.ts), so an opening with casedSides > 0 must NOT render as
  // cased while trim is switched off -- otherwise the picture claims
  // casing is being painted (border still drawn) while the estimate has
  // charged nothing for it. showTrim previously reached the baseboard but
  // was never forwarded past WallPlane to OpeningMarker at all.
  it("omits casing when trim scope is off, even with cased sides > 0", () => {
    render(
      <WallPlane
        {...base}
        showTrim={false}
        openings={[win({ casedSides: 2 })]}
      />,
    );
    expect(screen.getByTestId("opening-w1").className).not.toMatch(/cased/);
  });

  // --- G1: clicking an opening now selects it ------------------------------

  it("marks the opening matching selectedOpeningId as selected", () => {
    render(
      <WallPlane
        {...base}
        openings={[win(), win({ id: "w2" })]}
        selectedOpeningId="w2"
      />,
    );
    expect(screen.getByTestId("opening-w1").className).not.toMatch(
      /\bselected\b/,
    );
    expect(screen.getByTestId("opening-w2").className).toMatch(/\bselected\b/);
  });

  it("marks no opening as selected when selectedOpeningId is omitted", () => {
    render(<WallPlane {...base} openings={[win()]} />);
    expect(screen.getByTestId("opening-w1").className).not.toMatch(
      /\bselected\b/,
    );
  });

  it("marks no opening as selected when selectedOpeningId is null", () => {
    render(<WallPlane {...base} openings={[win()]} selectedOpeningId={null} />);
    expect(screen.getByTestId("opening-w1").className).not.toMatch(
      /\bselected\b/,
    );
  });

  // --- G2: an in-scope face is keyboard-operable ---------------------------

  it("gives an in-scope face a button role, tabIndex and an aria-label naming the wall and its area", () => {
    render(<WallPlane {...base} openings={[]} />);
    const el = screen.getByTestId("face-wall-0");
    expect(el.getAttribute("role")).toBe("button");
    expect(el.getAttribute("tabindex")).toBe("0");
    const label = el.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label).toMatch(/wall/i);
    expect(label).toMatch("10 × 8 = 80 sq ft");
  });

  it("gives an out-of-scope face no role, tabIndex or keyboard path", () => {
    render(<WallPlane {...base} inScope={false} openings={[]} />);
    const el = screen.getByTestId("face-wall-0");
    expect(el.getAttribute("role")).toBeNull();
    expect(el.getAttribute("tabindex")).toBeNull();
    expect(el.getAttribute("aria-label")).toBeNull();
  });

  it("places a centred opening on Enter", () => {
    const onPlace = vi.fn();
    render(<WallPlane {...base} onPlace={onPlace} openings={[]} />);
    const el = screen.getByTestId("face-wall-0");
    fireEvent.keyDown(el, { key: "Enter" });
    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace).toHaveBeenCalledWith(0.5);
  });

  it("places a centred opening on Space", () => {
    const onPlace = vi.fn();
    render(<WallPlane {...base} onPlace={onPlace} openings={[]} />);
    const el = screen.getByTestId("face-wall-0");
    fireEvent.keyDown(el, { key: " " });
    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace).toHaveBeenCalledWith(0.5);
  });

  it("ignores other keys", () => {
    const onPlace = vi.fn();
    render(<WallPlane {...base} onPlace={onPlace} openings={[]} />);
    const el = screen.getByTestId("face-wall-0");
    fireEvent.keyDown(el, { key: "Tab" });
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("does not respond to Enter on an out-of-scope face (no listener attached)", () => {
    const onPlace = vi.fn();
    render(
      <WallPlane {...base} inScope={false} onPlace={onPlace} openings={[]} />,
    );
    const el = screen.getByTestId("face-wall-0");
    fireEvent.keyDown(el, { key: "Enter" });
    expect(onPlace).not.toHaveBeenCalled();
  });
});
