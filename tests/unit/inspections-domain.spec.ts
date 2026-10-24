import { describe, it, expect } from "vitest";
import {
  isValidInspectionId,
  parseSimulate,
  listInspections,
  getInspectionById,
} from "../../src/lib/inspections-repository";
import { inspections, type Inspection } from "../../src/lib/data/inspections";

describe("Unit: Inspections Domain Logic & Repository", () => {
  describe("isValidInspectionId", () => {
    it("accepts valid 3-digit inspection IDs", () => {
      expect(isValidInspectionId("inspection-001")).toBe(true);
      expect(isValidInspectionId("inspection-999")).toBe(true);
    });

    it("rejects IDs with incorrect formatting or lengths", () => {
      expect(isValidInspectionId("inspection-1")).toBe(false);
      expect(isValidInspectionId("inspection-0001")).toBe(false);
      expect(isValidInspectionId("inspection-abc")).toBe(false);
      expect(isValidInspectionId("INSPECTION-001")).toBe(false);
      expect(isValidInspectionId("")).toBe(false);
      expect(isValidInspectionId("inspection-001 ")).toBe(false);
      expect(isValidInspectionId("'; DROP TABLE inspections; --")).toBe(false);
    });
  });

  describe("parseSimulate", () => {
    it("correctly parses valid simulation flags", () => {
      expect(parseSimulate("slow")).toBe("slow");
      expect(parseSimulate("error")).toBe("error");
    });

    it("returns undefined for null, undefined or unsupported simulation parameters", () => {
      expect(parseSimulate(null)).toBeUndefined();
      expect(parseSimulate(undefined)).toBeUndefined();
      expect(parseSimulate("fast")).toBeUndefined();
      expect(parseSimulate("")).toBeUndefined();
    });
  });

  describe("listInspections", () => {
    it("returns all synthetic inspections sorted descending by date", async () => {
      const result = await listInspections();
      expect(result.length).toBe(inspections.length);

      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].date >= result[i + 1].date).toBe(true);
      }
    });

    it("does not mutate the original inspections array", async () => {
      const originalFirst = inspections[0].id;
      const sorted = await listInspections();
      expect(Array.isArray(sorted)).toBe(true);
      expect(inspections[0].id).toBe(originalFirst);
    });

    it("throws a controlled error when simulate is set to 'error'", async () => {
      await expect(listInspections({ simulate: "error" })).rejects.toThrow(
        "Fallo simulado del origen de datos"
      );
    });

    it("resolves properly when simulate is 'slow'", async () => {
      const start = Date.now();
      const result = await listInspections({ simulate: "slow", delayMs: 15 });
      const elapsed = Date.now() - start;
      expect(result.length).toBeGreaterThan(0);
      expect(elapsed).toBeGreaterThanOrEqual(10);
    });
  });

  describe("getInspectionById", () => {
    it("retrieves the matching inspection for a valid existing ID", async () => {
      const inspection = await getInspectionById("inspection-001");
      expect(inspection).not.toBeNull();
      expect(inspection?.id).toBe("inspection-001");
      expect(inspection?.location).toBe("Laboratorio de Redes");
    });

    it("returns null for non-existing but valid format IDs", async () => {
      const inspection = await getInspectionById("inspection-999");
      expect(inspection).toBeNull();
    });

    it("returns null immediately for invalid ID formats without processing simulation", async () => {
      const inspection = await getInspectionById("invalid-id", { simulate: "error" });
      expect(inspection).toBeNull();
    });

    it("throws error when simulate is error on an existing ID", async () => {
      await expect(
        getInspectionById("inspection-001", { simulate: "error" })
      ).rejects.toThrow("Fallo simulado del origen de datos");
    });
  });

  describe("Synthetic data contracts", () => {
    it("ensures all mock inspections strictly adhere to schema requirements", () => {
      for (const item of inspections) {
        expect(item.id).toMatch(/^inspection-\d{3}$/);
        expect(item.location.trim().length).toBeGreaterThan(0);
        expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(["ok", "attention"]).toContain(item.status);
        expect(typeof item.findings).toBe("number");
        expect(item.findings).toBeGreaterThanOrEqual(0);
        expect(item.summary.length).toBeGreaterThan(0);
      }
    });
  });
});
