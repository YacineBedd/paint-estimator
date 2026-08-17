import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { saveProject, loadProject } from "../../data/storage";
import * as storageModule from "../../data/storage";
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
    // The takeoff opens on the room LIST, where a room's name is the row's
    // label rather than an input; the room's own fields are one tap away in
    // its editor. Same room, same assertion that it was restored.
    expect(screen.getByText("Restored room")).toBeInTheDocument();
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

// R1: the 500ms autosave debounce is a data-loss window — if the tab or
// window closes before it elapses, the pending edit is lost. These tests
// prove the fix flushes synchronously on the signals that precede a real
// tab close (beforeunload, visibilitychange → "hidden") and on unmount,
// without writing again when there is nothing pending.
describe("App — autosave flush on unload/unmount (R1)", () => {
  const stubVisibilityHidden = (): (() => void) => {
    const original =
      Object.getOwnPropertyDescriptor(document, "visibilityState") ??
      Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    return () => {
      if (original) {
        Object.defineProperty(document, "visibilityState", original);
      } else {
        delete (document as { visibilityState?: string }).visibilityState;
      }
    };
  };

  it("flushes a pending edit on beforeunload before the debounce elapses", async () => {
    saveProject(newProject("Unload test", "p1"));
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /add room/i }));
    const nameInput = screen.getByLabelText(/room name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Kitchen");

    // Fired synchronously, well inside the 500ms debounce window.
    window.dispatchEvent(new Event("beforeunload"));

    const saved = loadProject("p1");
    expect(saved?.rooms[0]?.name).toBe("Kitchen");
  });

  it("flushes a pending edit on visibilitychange → hidden before the debounce elapses (the mobile Safari path)", async () => {
    saveProject(newProject("Visibility test", "p1"));
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /add room/i }));
    const nameInput = screen.getByLabelText(/room name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Bathroom");

    const restoreVisibility = stubVisibilityHidden();
    document.dispatchEvent(new Event("visibilitychange"));
    restoreVisibility();

    const saved = loadProject("p1");
    expect(saved?.rooms[0]?.name).toBe("Bathroom");
  });

  it("flushes a pending edit on unmount before the debounce elapses", async () => {
    saveProject(newProject("Unmount test", "p1"));
    const { unmount } = render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /add room/i }));
    const nameInput = screen.getByLabelText(/room name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Hallway");

    unmount();

    const saved = loadProject("p1");
    expect(saved?.rooms[0]?.name).toBe("Hallway");
  });

  it("does not write again on unload/visibilitychange once the pending autosave has already landed", async () => {
    saveProject(newProject("No redundant write test", "p1"));
    const saveSpy = vi.spyOn(storageModule, "saveProject");
    render(<App />);

    // Mounting always schedules one autosave (see the comment in App.tsx);
    // let that land first so pendingRef is false before we probe for
    // redundant writes.
    await waitFor(() => expect(saveSpy).toHaveBeenCalled(), { timeout: 2000 });
    const callsAfterInitialSave = saveSpy.mock.calls.length;

    window.dispatchEvent(new Event("beforeunload"));
    const restoreVisibility = stubVisibilityHidden();
    document.dispatchEvent(new Event("visibilitychange"));
    restoreVisibility();

    expect(saveSpy.mock.calls.length).toBe(callsAfterInitialSave);
    saveSpy.mockRestore();
  });
});

// Export and Import are once-a-month actions. They used to cost ~60px of
// chrome at the top of every screen, on every visit, including the takeoff
// screen he is standing in a house using. They now live in Settings, so
// these tests open Settings first. What they assert — that both controls
// are present, that a bad file surfaces its error, and that a good file
// replaces the project — is unchanged.
const goToSettings = () =>
  userEvent.click(screen.getByRole("button", { name: /settings/i }));

describe("App — export/import (F1)", () => {
  it("renders visible Export and Import controls", async () => {
    render(<App />);
    await goToSettings();
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
  });

  it("surfaces the thrown error message when an invalid file is imported", async () => {
    render(<App />);
    await goToSettings();
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
    await goToSettings();
    const imported = {
      ...newProject("Imported house", "p2"),
      rooms: [room("ri1", "Imported room")],
    };
    const file = new File([JSON.stringify(imported)], "job.json", {
      type: "application/json",
    });
    const input = screen.getByLabelText(/import project file/i);
    await userEvent.upload(input, file);

    // A successful import now lands on the takeoff — importing a job is a
    // request to work on that job, not to keep staring at the price book.
    expect(await screen.findByText("Imported house")).toBeInTheDocument();
    expect(screen.getByText("Imported room")).toBeInTheDocument();
  });
});
