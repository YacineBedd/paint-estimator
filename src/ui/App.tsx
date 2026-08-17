import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { Project } from "../engine/types";
import { newProject } from "../data/defaults";
import {
  loadProject,
  saveProject,
  loadRateProfile,
  saveRateProfile,
  loadPriceBook,
  savePriceBook,
  exportProject,
  importProject,
} from "../data/storage";
import { TakeoffScreen } from "./TakeoffScreen";
import { ResultsScreen } from "./ResultsScreen";
import { SettingsScreen } from "./SettingsScreen";
import { CloseoutScreen } from "./CloseoutScreen";

type Screen = "takeoff" | "estimate" | "closeout" | "settings";

const PROJECT_ID = "p1";
const AUTOSAVE_DEBOUNCE_MS = 500;

// Four tabs, fixed to the bottom of the viewport, sized as four equal
// fractions of the width — so the bar cannot overflow at 390px the way the
// old five-item scrolling nav did (the 4th label was clipped to "Clo…" and
// the 5th was off-screen entirely). Anything that isn't one of these four is
// not a destination: "Quick estimate" became a way to start a takeoff and
// now lives inside Takeoff, and Export/Import are once-a-month actions that
// belong in Settings.
const TABS: Array<{ id: Screen; label: string; icon: string }> = [
  // Icons are single <path d="…"> strings, stroked, drawn on a 24×24 grid.
  { id: "takeoff", label: "Takeoff", icon: "M4 6h16M4 12h16M4 18h10" },
  {
    id: "estimate",
    label: "Estimate",
    icon: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h3",
  },
  { id: "closeout", label: "Close-out", icon: "M4 12l5 5L20 6" },
  {
    id: "settings",
    label: "Settings",
    icon: "M4 8h16M4 16h16M9 5v6M16 13v6",
  },
];

// The rate profile and price book persist under their OWN localStorage keys
// (see src/data/storage.ts), separately from any one project, because a
// painter's labor rates and price book carry over from job to job — they
// aren't something he re-enters every time he starts a new estimate. So on
// load we always take the last-saved global rates/price book as the source
// of truth for `project.rateProfile`/`project.priceBook`, regardless of what
// happens to be embedded in the loaded (or newly created) project object.
function loadInitialProject(): Project {
  const loaded = loadProject(PROJECT_ID);
  const base = loaded ?? newProject("New estimate", PROJECT_ID);
  return {
    ...base,
    rateProfile: loadRateProfile(),
    priceBook: loadPriceBook(),
  };
}

export default function App() {
  const [project, setProject] = useState<Project>(loadInitialProject);
  const [screen, setScreen] = useState<Screen>("takeoff");
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autosave, debounced: a fresh save is scheduled on every project change,
  // but the previous pending save is cancelled first, so a burst of
  // keystrokes only ever writes once, ~500ms after the user stops typing —
  // not once per keystroke.
  //
  // R1: that debounce window is a data-loss hole — if the tab or window
  // closes before it elapses, the pending edit is never written. `flush`
  // below writes immediately, and is wired up (via the effect after this
  // one) to `beforeunload`, `visibilitychange` → "hidden", and unmount.
  //
  // `pendingRef` tracks whether there is an unsaved edit outstanding, so
  // `flush` is a no-op (and safe to call more than once) when nothing has
  // changed since the last write. `projectRef` mirrors the latest `project`
  // synchronously on every render (not inside an effect), so `flush` — which
  // must be callable from a unmount/unload cleanup that does not itself
  // depend on `project` — always writes the freshest value, not a value
  // captured by a stale closure.
  const pendingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  const flush = useCallback(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    saveProject(projectRef.current);
    saveRateProfile(projectRef.current.rateProfile);
    savePriceBook(projectRef.current.priceBook);
  }, []);

  useEffect(() => {
    pendingRef.current = true;
    timeoutRef.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
    // This cleanup fires on every project change (to reschedule the
    // debounce), not just on unmount — so it only cancels the pending
    // timer. It must NOT flush here, or every keystroke would write
    // synchronously and defeat the debounce. Unmount-time flushing is
    // handled by the separate, mount-once effect below instead.
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [project, flush]);

  // Mount-once: listens for the page going away and flushes any pending
  // autosave synchronously. `visibilitychange` → "hidden" is the documented,
  // reliable signal on mobile Safari (a job-site painter's likely device);
  // `beforeunload` is kept too for desktop/other browsers. Both funnel
  // through the same idempotent `flush`, so firing twice (or firing once
  // more on unmount) is harmless.
  useEffect(() => {
    const handleBeforeUnload = () => flush();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flush();
    };
  }, [flush]);

  const handleExport = () => {
    const json = exportProject(project);
    // A data: URI (rather than Blob + URL.createObjectURL) keeps this
    // dependency-free and works the same in real browsers and in jsdom
    // under test — no object-URL lifecycle to manage or leak.
    const href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    const filename = `${project.name || "estimate"}.json`;
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so selecting the SAME file twice in a row still fires
    // a change event.
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const imported = importProject(text);
      setProject(imported);
      setImportError(null);
      // Importing a job is a request to work on that job. Leaving him on
      // Settings, looking at a price book, after he has just loaded a house
      // full of rooms is a dead end.
      setScreen("takeoff");
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : "That file is not a valid estimate.",
      );
    }
  };

  return (
    <>
      <main>
        {screen === "takeoff" ? (
          <TakeoffScreen project={project} onChange={setProject} />
        ) : screen === "estimate" ? (
          <ResultsScreen project={project} />
        ) : screen === "closeout" ? (
          <CloseoutScreen project={project} onChange={setProject} />
        ) : (
          <>
            <SettingsScreen project={project} onChange={setProject} />

            <section className="project-io">
              <h2>This job's file</h2>
              <p className="note">
                Export writes the whole estimate to a file you can email
                yourself or keep as a backup. Import replaces what is on screen.
              </p>
              <div className="project-io-actions">
                <button type="button" onClick={handleExport}>
                  Export
                </button>
                <button type="button" onClick={handleImportClick}>
                  Import
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                aria-label="import project file"
                style={{ display: "none" }}
                onChange={handleImportFile}
              />
              {importError && (
                <p
                  role="alert"
                  data-testid="import-error"
                  className="import-error"
                >
                  {importError}
                </p>
              )}
            </section>
          </>
        )}
      </main>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="tab"
            aria-current={screen === tab.id ? "page" : undefined}
            onClick={() => setScreen(tab.id)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={tab.icon} />
            </svg>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
