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

  // --- Mirroring correction (Task 2 geometry fact) ------------------------
  //
  // projection.ts documents that, because the room's faces have inward
  // normals (so backface-visibility:hidden culls the near walls and you
  // see into an open box), a wall's local offset=0 end renders on the
  // FAR side from where a person standing inside facing that wall would
  // put it — an inherent, verified property of viewing the box from
  // outside it, consistent across all four walls. WallPlane's click
  // handler, however, reports a raw, uncorrected DOM-fraction of the
  // clicked element's own on-screen bounding box (0 = its screen-left
  // edge, 1 = its screen-right edge) — it knows nothing about that
  // geometry. Left uncorrected, a click near the wall's visual left
  // would be stored as offset≈0, which then renders back out at the
  // *opposite* end (openingBox positions local x=0 at the same edge the
  // click measured, but that edge is the far one once the wall's own
  // rotateY is composed with the click's real screen measurement).
  // Room3DEditor's placement handler is the one uniform place to correct
  // this: offset -> 1 - offset. This test stubs a real bounding rect (as
  // WallPlane's own offset-formula test does) so it exercises the actual
  // formula, not jsdom's zero-width fallback, and pins the corrected
  // value so a regression to the raw, uncorrected offset fails loudly.
  it("corrects the raw click offset to a mirrored offset before storing it", async () => {
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
      // raw WallPlane offset of 0.25 (near the wall's visual left).
      fireEvent.click(el, { clientX: 150 });

      expect(onChange).toHaveBeenCalledTimes(1);
      const stored = onChange.mock.calls.at(-1)![0].openings[0].offset;
      // Corrected: 1 - 0.25 = 0.75, NOT the raw 0.25.
      expect(stored).toBeCloseTo(0.75);
    } finally {
      spy.mockRestore();
    }
  });
});
