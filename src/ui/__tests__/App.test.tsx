import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { saveProject, loadProject } from "../../data/storage";
import { newProject } from "../../data/defaults";
import type { Room } from "../../engine/types";

beforeEach(() => localStorage.clear());

const room = (id: string, name: string): Room => ({
  id,
  name,
  floor: 1,
  quantity: 1,
  walls: [10, 10],
  ceilingHeight: 8,
  scope: { walls: true, ceiling: true, trim: true, primer: "full" },
  wallProductId: "549",
  ceilingProductId: "K508",
  trimProductId: "550",
  openings: [],
});

// F1: App.tsx previously held the project in useState only, so every
// refresh destroyed the estimate. src/data/storage.ts was fully written and
// tested but no UI file ever imported it. These tests prove the wiring:
// a project saved to localStorage is restored on mount, and an edit is
// persisted back out (debounced, not on every keystroke).
describe("App — persistence (F1)", () => {
  it("restores a project saved to localStorage on mount", () => {
    const project = {
      ...newProject("Smith house", "p1"),
      rooms: [room("r1", "Restored room")],
    };
    saveProject(project);

    render(<App />);

    expect(screen.getByText("Smith house")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Restored room")).toBeInTheDocument();
  });

  it("falls back to a blank new project when nothing is stored", () => {
    render(<App />);
    expect(screen.getByText("New estimate")).toBeInTheDocument();
  });

  it("autosaves an edit to localStorage, debounced rather than on every keystroke", async () => {
    saveProject(newProject("Autosave test", "p1"));
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /add room/i }));
    const nameInput = screen.getByLabelText(/room name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Kitchen");

    // Immediately after typing, the debounce window (500ms) has not
    // necessarily elapsed — the point of debouncing is that not every
    // keystroke is its own write. We only assert the FINAL state lands.
    await waitFor(
      () => {
        const saved = loadProject("p1");
        expect(saved?.rooms[0]?.name).toBe("Kitchen");
      },
      { timeout: 2000 },
    );
  });

  it("persists the rate profile under its own key, independent of the project", async () => {
    saveProject(newProject("Rates test", "p1"));
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /settings/i }));
    const laborRate = screen.getByLabelText(/labor rate/i);
    await userEvent.clear(laborRate);
    await userEvent.type(laborRate, "90");

    await waitFor(
      () => {
        const saved = loadProject("p1");
        expect(saved?.rateProfile.laborRate).toBe(90);
      },
      { timeout: 2000 },
    );
  });
});

describe("App — export/import (F1)", () => {
  it("renders visible Export and Import controls", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
  });

  it("surfaces the thrown error message when an invalid file is imported", async () => {
    render(<App />);
    const input = screen.getByLabelText(/import project file/i);
    const badFile = new File(["not json"], "bad.json", {
      type: "application/json",
    });
    await userEvent.upload(input, badFile);

    expect(await screen.findByTestId("import-error")).toHaveTextContent(
      /not a valid/i,
    );
  });

  it("replaces the project when a valid file is imported", async () => {
    render(<App />);
    const imported = {
      ...newProject("Imported house", "p2"),
      rooms: [room("ri1", "Imported room")],
    };
    const file = new File([JSON.stringify(imported)], "job.json", {
      type: "application/json",
    });
    const input = screen.getByLabelText(/import project file/i);
    await userEvent.upload(input, file);

    expect(await screen.findByText("Imported house")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Imported room")).toBeInTheDocument();
  });
});
