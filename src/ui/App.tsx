import { useState } from "react";
import type { Project } from "../engine/types";
import { newProject } from "../data/defaults";
import { TakeoffScreen } from "./TakeoffScreen";
import { ResultsScreen } from "./ResultsScreen";
import { SettingsScreen } from "./SettingsScreen";

type Screen = "takeoff" | "results" | "settings";

export default function App() {
  const [project, setProject] = useState<Project>(() =>
    newProject("New estimate", "p1"),
  );
  const [screen, setScreen] = useState<Screen>("takeoff");

  return (
    <main>
      <h1>Paint Estimator</h1>
      <nav>
        <button type="button" onClick={() => setScreen("takeoff")}>
          Takeoff
        </button>
        <button type="button" onClick={() => setScreen("results")}>
          Results
        </button>
        <button type="button" onClick={() => setScreen("settings")}>
          Settings
        </button>
      </nav>
      {screen === "takeoff" ? (
        <TakeoffScreen project={project} onChange={setProject} />
      ) : screen === "results" ? (
        <ResultsScreen project={project} />
      ) : (
        <SettingsScreen project={project} onChange={setProject} />
      )}
    </main>
  );
}
