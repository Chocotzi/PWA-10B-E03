/** The server must compare revisions atomically with its write. */
export function decideConflict(
  baseRevision: string | null,
  serverRevision: string | null,
): "apply" | "conflict" {
  return baseRevision === serverRevision ? "apply" : "conflict";
}
