import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsScreen } from "../SettingsScreen";
import { goldenJob } from "../../engine/__fixtures__/goldenJob";

describe("SettingsScreen", () => {
  it("shows his seeded rates", () => {
    render(<SettingsScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByLabelText(/labor rate/i)).toHaveValue(75);
    expect(screen.getByLabelText(/wall rate/i)).toHaveValue(0.75);
    expect(screen.getByLabelText(/wall coverage/i)).toHaveValue(500);
    expect(screen.getByLabelText(/ceiling coverage/i)).toHaveValue(550);
  });

  // This is the test that actually catches the revert bug, and it does so
  // with nothing more than a bare vi.fn() onChange — no wrapper/useState
  // needed. Verified empirically: a version of RateField with no local
  // state mirror fails this exact test (typing "85" after clear() produces
  // stray values like 758/755, and the DOM reverts to "75") even though
  // `onChange` here never feeds state back into `project`. That's because
  // React's controlled-<input> reconciliation restores the DOM to the last
  // *rendered* value after every native input event regardless of whether
  // the owning component re-rendered for any other reason — so a
  // prop-only-controlled field snaps back to the stale prop after each
  // keystroke. The fix (RateField's local `useState`) works precisely
  // because its own setState commits the correct value synchronously,
  // independent of whatever the parent does with `onChange`. Asserting
  // both `toHaveValue` (what the painter sees) and the onChange payload
  // (what actually gets saved) is what makes this a real regression test
  // rather than one that would pass by accident.
  it("edits the labor rate", async () => {
    const onChange = vi.fn();
    render(<SettingsScreen project={goldenJob} onChange={onChange} />);
    const input = screen.getByLabelText(/labor rate/i);
    await userEvent.clear(input);
    await userEvent.type(input, "85");
    expect(input).toHaveValue(85);
    expect(onChange.mock.calls.at(-1)![0].rateProfile.laborRate).toBe(85);
  });

  it("edits a product's price the same way, displaying and propagating it", async () => {
    const onChange = vi.fn();
    render(<SettingsScreen project={goldenJob} onChange={onChange} />);
    const input = screen.getByLabelText(/549 your price per gallon/i);
    await userEvent.clear(input);
    await userEvent.type(input, "72.5");
    expect(input).toHaveValue(72.5);
    const priceBook = onChange.mock.calls.at(-1)![0].priceBook as Array<{
      id: string;
      actualPrice: number;
    }>;
    expect(priceBook.find((p) => p.id === "549")?.actualPrice).toBe(72.5);
  });

  it("lists every product with per-gallon prices", () => {
    render(<SettingsScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByDisplayValue("Regal Select")).toBeInTheDocument();
    expect(screen.getByDisplayValue("71.25")).toBeInTheDocument();
  });

  it("labels prices as per gallon so pack size is never confused for a unit", () => {
    render(<SettingsScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getAllByText(/per gallon/i).length).toBeGreaterThan(0);
  });

  it("warns that trim rate equals wall rate", () => {
    render(<SettingsScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByTestId("trim-rate-note")).toBeInTheDocument();
  });
});
