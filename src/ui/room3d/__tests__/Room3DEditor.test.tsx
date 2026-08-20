import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Room3DEditor } from "../Room3DEditor";
import { computeGeometry } from "../../../engine/geometry";
import { goldenJob } from "../../../engine/__fixtures__/goldenJob";
import type { Room } from "../../../engine/types";

const room: Room = {
  ...goldenJob.rooms[1]!,
  id: "r",
  name: "bedroom 1",
  walls: [10, 12],
  ceilingHeight: 8,
  scope: { walls: true, ceiling: true, trim: true, primer: "full" },
  openings: [],
};

const props = {
  room,
  geometry: computeGeometry([room], goldenJob.rateProfile)[0],
  priceBook: goldenJob.priceBook,
  warnings: [],
  onChange: vi.fn(),
  onRemove: vi.fn(),
  onBack: vi.fn(),
};

describe("Room3DEditor", () => {
  it("renders the 3D room and the panel together", () => {
    render(<Room3DEditor {...props} />);
    expect(screen.getByTestId("face-wall-0")).toBeInTheDocument();
    expect(screen.getByDisplayValue("bedroom 1")).toBeInTheDocument();
  });

  it("adds an opening on the clicked wall with that wall's index", async () => {
    const onChange = vi.fn();
    render(<Room3DEditor {...props} onChange={onChange} />);
    await userEvent.click(
      screen.getByRole("button", { name: /place window/i }),
    );
    await userEvent.click(screen.getByTestId("face-wall-2"));

    const updated = onChange.mock.calls.at(-1)![0];
    expect(updated.openings).toHaveLength(1);
    expect(updated.openings[0].kind).toBe("window");
    expect(updated.openings[0].wallIndex).toBe(2);
    expect(updated.openings[0].offset).toBeGreaterThanOrEqual(0);
    expect(updated.openings[0].offset).toBeLessThanOrEqual(1);
  });

  it("uses the shared newOpening defaults — a door is 3 by 7 with both sides cased", async () => {
    const onChange = vi.fn();
    render(<Room3DEditor {...props} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /place door/i }));
    await userEvent.click(screen.getByTestId("face-wall-0"));

    const o = onChange.mock.calls.at(-1)![0].openings[0];
    expect(o.width).toBe(3);
    expect(o.height).toBe(7);
    expect(o.casedSides).toBe(2);
    expect(o.paintSlab).toBe(true);
  });

  it("does not place anything when no tool is armed", async () => {
    const onChange = vi.fn();
    render(<Room3DEditor {...props} onChange={onChange} />);
    await userEvent.click(screen.getByTestId("face-wall-0"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disarms the tool after placing, so one click places one opening", async () => {
    const onChange = vi.fn();
    render(<Room3DEditor {...props} onChange={onChange} />);
    await userEvent.click(
      screen.getByRole("button", { name: /place window/i }),
    );
    await userEvent.click(screen.getByTestId("face-wall-0"));
    await userEvent.click(screen.getByTestId("face-wall-1"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("hands back to the caller", async () => {
    const onBack = vi.fn();
    render(<Room3DEditor {...props} onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: /rooms/i }));
    expect(onBack).toHaveBeenCalled();
  });

  // --- Click-to-store round trip ------------------------------------------
  //
  // It's tempting to assume the room's inward-facing wall normals (see
  // projection.ts) mean a clicked offset needs mirroring before it's
  // stored. It doesn't: a wall is only ever visible/clickable because
  // backface-visibility:hidden let it through, and that visibility
  // condition and the wall's own rotateY cancel out exactly — swept across
  // every reachable orbit angle, a visible wall's local left is always its
  // screen-left. So WallPlane's raw click fraction (0 = the clicked wall's
  // own screen-left edge, 1 = its screen-right edge) is already the
  // correct `offset` value, and Room3DEditor stores it unmodified — no
  // correction applied. This test stubs a real bounding rect (as
  // WallPlane's own offset-formula test does, since jsdom's rect is always
  // zero-width otherwise) and pins the stored value to the clicked
  // fraction, so a reintroduced transform (e.g. `1 - offset`) fails it.
  it("stores the clicked offset unmodified — no mirroring correction", async () => {
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
      const onChange = vi.fn();
      render(<Room3DEditor {...props} onChange={onChange} />);
      await userEvent.click(
        screen.getByRole("button", { name: /place window/i }),
      );
      const el = screen.getByTestId("face-wall-0");
      // clientX=150 is a quarter of the way across the stubbed rect, i.e. a
      // raw WallPlane offset of 0.25.
      fireEvent.click(el, { clientX: 150 });

      expect(onChange).toHaveBeenCalledTimes(1);
      const stored = onChange.mock.calls.at(-1)![0].openings[0].offset;
      expect(stored).toBeCloseTo(0.25);
    } finally {
      spy.mockRestore();
    }
  });
});
