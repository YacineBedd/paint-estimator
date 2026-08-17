import { describe, it, expect, beforeEach } from "vitest";
import {
  saveProject,
  loadProject,
  listProjects,
  deleteProject,
  saveRateProfile,
  loadRateProfile,
  exportProject,
  importProject,
} from "../storage";
import { newProject, DEFAULT_RATE_PROFILE } from "../defaults";

beforeEach(() => localStorage.clear());

describe("project persistence", () => {
  it("round-trips a project", () => {
    const p = newProject("Smith house", "p1");
    saveProject(p);
    expect(loadProject("p1")).toEqual(p);
  });

  it("returns null for an unknown id", () => {
    expect(loadProject("nope")).toBeNull();
  });

  it("lists saved projects", () => {
    saveProject(newProject("A", "p1"));
    saveProject(newProject("B", "p2"));
    expect(listProjects()).toEqual([
      { id: "p1", name: "A" },
      { id: "p2", name: "B" },
    ]);
  });

  it("deletes a project and drops it from the index", () => {
    saveProject(newProject("A", "p1"));
    deleteProject("p1");
    expect(loadProject("p1")).toBeNull();
    expect(listProjects()).toEqual([]);
  });
});

describe("rate profile persistence", () => {
  it("falls back to defaults when nothing is stored", () => {
    expect(loadRateProfile()).toEqual(DEFAULT_RATE_PROFILE);
  });

  it("round-trips an edited profile", () => {
    saveRateProfile({ ...DEFAULT_RATE_PROFILE, laborRate: 85 });
    expect(loadRateProfile().laborRate).toBe(85);
  });

  it("falls back to defaults when stored JSON is corrupt", () => {
    localStorage.setItem("paint-estimator:rates", "{not json");
    expect(loadRateProfile()).toEqual(DEFAULT_RATE_PROFILE);
  });
});

describe("export and import", () => {
  it("round-trips through JSON", () => {
    const p = newProject("Smith house", "p1");
    expect(importProject(exportProject(p))).toEqual(p);
  });

  it("throws a clear error on malformed input", () => {
    expect(() => importProject("{not json")).toThrow(/not a valid/i);
  });

  it("throws when required fields are missing", () => {
    expect(() => importProject('{"id":"x"}')).toThrow(/not a valid/i);
  });
});
