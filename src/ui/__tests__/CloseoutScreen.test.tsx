import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CloseoutScreen } from "../CloseoutScreen";
import { goldenJob } from "../../engine/__fixtures__/goldenJob";

describe("CloseoutScreen", () => {
  it("shows an actuals input per product", () => {
    render(<CloseoutScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByLabelText(/Regal Select gallons/i)).toHaveValue(4);
    expect(screen.getByLabelText(/Waterborne Ceiling gallons/i)).toHaveValue(4);
  });

  it("reports real finish coverage, excluding primer", () => {
    render(<CloseoutScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByTestId("finish-coverage")).toHaveTextContent("41");
  });

  it("flags products bought over estimate", () => {
    render(<CloseoutScreen project={goldenJob} onChange={() => {}} />);
    const ceiling = screen.getByTestId("drift-K508");
    expect(ceiling).toHaveTextContent("3");
    expect(ceiling).toHaveTextContent("4");
  });

  it("records an edited gallon count", async () => {
    const onChange = vi.fn();
    render(<CloseoutScreen project={goldenJob} onChange={onChange} />);
    const input = screen.getByLabelText(/Regal Select gallons/i);
    await userEvent.clear(input);
    await userEvent.type(input, "6");
    const updated = onChange.mock.calls.at(-1)![0];
    expect(updated.actuals.gallonsPurchased["549"]).toBe(6);
  });

  // The single-digit test above ("6") can pass even when a purely
  // prop-controlled input reverts mid-typing, because there's only one
  // keystroke to revert after. This test types a MULTI-digit value with a
  // bare vi.fn() onChange (no wrapper/useState feeding the project back) —
  // exactly the setup that empirically fails on a non-mirrored input (see
  // SettingsScreen.test.tsx's "edits the labor rate" for the same pattern
  // and its rationale). React's controlled-<input> reconciliation resets
  // the DOM to the last *rendered* prop value after every native input
  // event, so a field with no local state mirror snaps back to the stale
  // prop after the first keystroke and mangles the rest. Asserting both
  // the displayed value and the propagated onChange payload is what makes
  // this a real regression test.
  it("accepts a multi-digit gallon count without reverting mid-type", async () => {
    const onChange = vi.fn();
    render(<CloseoutScreen project={goldenJob} onChange={onChange} />);
    const input = screen.getByLabelText(/Regal Select gallons/i);
    await userEvent.clear(input);
    await userEvent.type(input, "12");
    expect(input).toHaveValue(12);
    const updated = onChange.mock.calls.at(-1)![0];
    expect(updated.actuals.gallonsPurchased["549"]).toBe(12);
  });

  it("prompts before any actuals are entered", () => {
    const { actuals, ...withoutActuals } = goldenJob;
    render(
      <CloseoutScreen
        project={withoutActuals as typeof goldenJob}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByText(/enter what you actually used/i),
    ).toBeInTheDocument();
  });
});
