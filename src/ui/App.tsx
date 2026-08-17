import { useState } from "react";
import type { Project } from "../engine/types";
import { newProject } from "../data/defaults";
import { TakeoffScreen } from "./TakeoffScreen";
import { ResultsScreen } from "./ResultsScreen";
import { SettingsScreen } from "./SettingsScreen";
import { CloseoutScreen } from "./CloseoutScreen";
import { QuickEstimateScreen } from "./QuickEstimateScreen";

type Screen = "takeoff" | "results" | "settings" | "closeout" | "quick";

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
        <button type="button" onClick={() => setScreen("closeout")}>
          Close-out
        </button>
        <button type="button" onClick={() => setScreen("quick")}>
          Quick estimate
        </button>
      </nav>
      {screen === "takeoff" ? (
        <TakeoffScreen project={project} onChange={setProject} />
      ) : screen === "results" ? (
        <ResultsScreen project={project} />
      ) : screen === "settings" ? (
        <SettingsScreen project={project} onChange={setProject} />
      ) : screen === "closeout" ? (
        <CloseoutScreen project={project} onChange={setProject} />
      ) : (
        <QuickEstimateScreen
          rates={project.rateProfile}
          priceBook={project.priceBook}
        />
      )}
    </main>
  );
}
