import { useState } from "react";
import type { Project } from "../engine/types";
import { newProject } from "../data/defaults";
import { TakeoffScreen } from "./TakeoffScreen";

export default function App() {
  const [project, setProject] = useState<Project>(() =>
    newProject("New estimate", "p1"),
  );

  return (
    <main>
      <h1>Paint Estimator</h1>
      <TakeoffScreen project={project} onChange={setProject} />
    </main>
  );
}
