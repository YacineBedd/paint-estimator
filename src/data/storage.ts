import type { PaintProduct, Project, RateProfile } from "../engine/types";
import { DEFAULT_PRICE_BOOK, DEFAULT_RATE_PROFILE } from "./defaults";

const PROJECT_PREFIX = "paint-estimator:project:";
const INDEX_KEY = "paint-estimator:index";
const RATES_KEY = "paint-estimator:rates";
const BOOK_KEY = "paint-estimator:pricebook";

type IndexEntry = { id: string; name: string };

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function listProjects(): IndexEntry[] {
  return readJson<IndexEntry[]>(INDEX_KEY, []);
}

export function saveProject(project: Project): void {
  localStorage.setItem(PROJECT_PREFIX + project.id, JSON.stringify(project));
  const index = listProjects().filter((e) => e.id !== project.id);
  index.push({ id: project.id, name: project.name });
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function loadProject(id: string): Project | null {
  const raw = localStorage.getItem(PROJECT_PREFIX + id);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

export function deleteProject(id: string): void {
  localStorage.removeItem(PROJECT_PREFIX + id);
  localStorage.setItem(
    INDEX_KEY,
    JSON.stringify(listProjects().filter((e) => e.id !== id)),
  );
}

export function saveRateProfile(rates: RateProfile): void {
  localStorage.setItem(RATES_KEY, JSON.stringify(rates));
}

export function loadRateProfile(): RateProfile {
  return readJson<RateProfile>(RATES_KEY, DEFAULT_RATE_PROFILE);
}

export function savePriceBook(book: PaintProduct[]): void {
  localStorage.setItem(BOOK_KEY, JSON.stringify(book));
}

export function loadPriceBook(): PaintProduct[] {
  return readJson<PaintProduct[]>(BOOK_KEY, DEFAULT_PRICE_BOOK);
}

export function exportProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function importProject(json: string): Project {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That file is not a valid estimate.");
  }
  const p = parsed as Partial<Project>;
  if (
    typeof p?.id !== "string" ||
    typeof p?.name !== "string" ||
    !Array.isArray(p?.rooms) ||
    !p?.rateProfile ||
    !Array.isArray(p?.priceBook)
  ) {
    throw new Error("That file is not a valid estimate.");
  }
  return {
    ...(p as Project),
    customSurfaces: p.customSurfaces ?? [],
  };
}
