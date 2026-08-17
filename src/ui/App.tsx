import { useState } from "react";
import type { Project } from "../engine/types";
import { newProject } from "../data/defaults";
import { TakeoffScreen } from "./TakeoffScreen";
import { ResultsScreen } from "./ResultsScreen";

type Screen = "takeoff" | "results";

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
      </nav>
      {screen === "takeoff" ? (
        <TakeoffScreen project={project} onChange={setProject} />
      ) : (
        <ResultsScreen project={project} />
      )}
    </main>
  );
}
