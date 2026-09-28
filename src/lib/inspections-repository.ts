import { inspections, type Inspection } from "./data/inspections";

export type SimulateMode = "slow" | "error";

export type RepositoryOptions = {
  simulate?: SimulateMode;
  delayMs?: number;
};

export function isValidInspectionId(id: string): boolean {
  return /^inspection-\d{3}$/.test(id);
}

export function parseSimulate(value: string | null | undefined): SimulateMode | undefined {
  return value === "slow" || value === "error" ? value : undefined;
}

async function applySimulation(options: RepositoryOptions = {}): Promise<void> {
  if (options.simulate === "error") {
    throw new Error("Fallo simulado del origen de datos");
  }

  if (options.simulate === "slow") {
    const delayMs = Math.max(0, options.delayMs ?? 1500);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

export async function listInspections(options: RepositoryOptions = {}): Promise<Inspection[]> {
  await applySimulation(options);
  return [...inspections].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getInspectionById(
  id: string,
  options: RepositoryOptions = {},
): Promise<Inspection | null> {
  if (!isValidInspectionId(id)) {
    return null;
  }

  await applySimulation(options);
  return inspections.find((inspection) => inspection.id === id) ?? null;
}
