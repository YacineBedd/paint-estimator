import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickEstimateScreen } from "../QuickEstimateScreen";
import { goldenJob } from "../../engine/__fixtures__/goldenJob";

describe("QuickEstimateScreen", () => {
  it("shows a total once a floor area is entered", async () => {
    render(
      <QuickEstimateScreen
        rates={goldenJob.rateProfile}
        priceBook={goldenJob.priceBook}
      />,
    );
    const input = screen.getByLabelText(/square feet/i);
    await userEvent.clear(input);
    await userEvent.type(input, "2000");
    expect(screen.getByTestId("quick-total")).not.toHaveTextContent("$0.00");
  });

  it("states that the estimate is a ballpark", () => {
    render(
      <QuickEstimateScreen
        rates={goldenJob.rateProfile}
        priceBook={goldenJob.priceBook}
      />,
    );
    expect(screen.getByText(/ballpark/i)).toBeInTheDocument();
  });
});
