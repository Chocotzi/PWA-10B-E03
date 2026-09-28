import { describe, expect, it, vi } from "vitest";
import {
  getInspectionById,
  isValidInspectionId,
  listInspections,
  parseSimulate,
} from "../src/lib/inspections-repository";

describe("repositorio de inspecciones", () => {
  it("valida identificadores y devuelve null para formatos inválidos", async () => {
    expect(isValidInspectionId("inspection-001")).toBe(true);
    expect(isValidInspectionId("hola")).toBe(false);
    await expect(getInspectionById("hola")).resolves.toBeNull();
  });

  it("devuelve seis registros ordenados por fecha descendente", async () => {
    const result = await listInspections();
    expect(result).toHaveLength(6);
    expect(result.map(({ id }) => id)).toEqual([
      "inspection-001",
      "inspection-002",
      "inspection-003",
      "inspection-004",
      "inspection-005",
      "inspection-006",
    ]);
  });

  it("acepta solo las simulaciones declaradas", () => {
    expect(parseSimulate("slow")).toBe("slow");
    expect(parseSimulate("error")).toBe("error");
    expect(parseSimulate("otro")).toBeUndefined();
  });

  it("permite controlar la espera lenta y propaga el error simulado", async () => {
    vi.useFakeTimers();
    const pending = listInspections({ simulate: "slow", delayMs: 25 });
    await vi.advanceTimersByTimeAsync(25);
    await expect(pending).resolves.toHaveLength(6);
    await expect(listInspections({ simulate: "error" })).rejects.toThrow(
      "Fallo simulado del origen de datos",
    );
    vi.useRealTimers();
  });
});
