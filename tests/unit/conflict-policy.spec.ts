import { describe, it, expect } from "vitest";
import { decideConflict } from "../../src/lib/sync/conflict-policy";

describe("Unit: Sync Conflict Policy (Optimistic Locking)", () => {
  it("allows applying a newly created resource when both revisions are null", () => {
    const decision = decideConflict(null, null);
    expect(decision).toBe("apply");
  });

  it("allows applying an update when client baseRevision matches serverRevision exactly", () => {
    const decision = decideConflict("rev-v1", "rev-v1");
    expect(decision).toBe("apply");
  });

  it("detects a conflict when client baseRevision is stale compared to serverRevision", () => {
    const decision = decideConflict("rev-v1", "rev-v2");
    expect(decision).toBe("conflict");
  });

  it("detects a conflict when client attempts to create a record that already exists on server", () => {
    const decision = decideConflict(null, "rev-existing");
    expect(decision).toBe("conflict");
  });

  it("detects a conflict when client bases edit on a revision but record does not exist on server", () => {
    const decision = decideConflict("rev-v1", null);
    expect(decision).toBe("conflict");
  });
});
