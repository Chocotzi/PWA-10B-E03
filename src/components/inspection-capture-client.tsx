"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Inspection, InspectionStatus } from "../lib/data/inspections";
import { openMutationStorage, type PendingMutation } from "../lib/storage/schema";
import { createSyncQueue, type SyncTransport } from "../lib/sync/queue";

const transport: SyncTransport = {
  async send(mutation) {
    const response = await fetch("/api/inspecciones", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mutation),
    });
    const payload = await response.json() as { kind?: string; revision?: string; serverRevision?: string | null };
    if (payload.kind === "applied" && payload.revision) return { kind: "applied" as const, revision: payload.revision };
    if (payload.kind === "conflict") return { kind: "conflict" as const, serverRevision: payload.serverRevision ?? null };
    throw new Error("No se pudo enviar la inspección");
  },
};

function makeInspection(form: HTMLFormElement): Inspection {
  const fields = new FormData(form);
  const status = fields.get("status") as InspectionStatus;
  return {
    id: `synthetic-${crypto.randomUUID()}`, location: String(fields.get("location")),
    date: new Date().toISOString().slice(0, 10), inspector: String(fields.get("inspector")), status,
    statusLabel: status === "ok" ? "Sin incidencias" : "Requiere atención",
    findings: Number(fields.get("findings")), summary: String(fields.get("summary")),
  };
}

export function InspectionCaptureClient() {
  const queueRef = useRef<ReturnType<typeof createSyncQueue>>();
  const [items, setItems] = useState<PendingMutation[]>([]);
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState("Preparando captura sin conexión…");

  const refresh = useCallback(async () => setItems(await queueRef.current?.list() ?? []), []);
  const flush = useCallback(async () => {
    if (!queueRef.current || !navigator.onLine) return;
    try { await queueRef.current.flush(); setNotice("Sincronización terminada."); }
    catch { setNotice("No se pudo sincronizar; la copia local sigue guardada."); }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    let alive = true;
    void openMutationStorage().then(async (storage) => {
      if (!alive) return;
      queueRef.current = createSyncQueue(storage, transport);
      await refresh();
      setNotice("Captura local lista.");
      void flush();
    }).catch(() => setNotice("No se pudo abrir el almacenamiento local."));
    const onOnline = () => { setOnline(true); void flush(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    return () => { alive = false; window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [flush, refresh]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!queueRef.current) return;
    await queueRef.current.enqueue(makeInspection(event.currentTarget), null);
    event.currentTarget.reset();
    setNotice("Inspección sintética guardada localmente.");
    await refresh();
    void flush();
  }

  const pending = items.filter((item) => item.status === "pending");
  const conflicts = items.filter((item) => item.status === "conflict");
  return <section className="capture-panel" aria-labelledby="capture-title">
    <div><p className="eyebrow">Captura offline</p><h2 id="capture-title">Nueva inspección sintética</h2></div>
    <p className="sync-summary" role="status">{online ? "Con conexión" : "Sin conexión"} · {pending.length} pendientes · {conflicts.length} conflictos</p>
    <form className="capture-form" onSubmit={save}>
      <label>Laboratorio sintético<input name="location" required defaultValue="Laboratorio de Redes" /></label>
      <label>Responsable sintético<input name="inspector" required defaultValue="Técnica de prueba" /></label>
      <label>Estado<select name="status" defaultValue="ok"><option value="ok">Sin incidencias</option><option value="attention">Requiere atención</option></select></label>
      <label>Hallazgos<input name="findings" type="number" min="0" defaultValue="0" required /></label>
      <label className="form-wide">Resumen sintético<textarea name="summary" required defaultValue="Registro sintético para comprobar la captura sin conexión." /></label>
      <button className="button" type="submit">Guardar sin conexión</button>
      <button className="secondary-button" type="button" onClick={() => void flush()} disabled={!online}>Reintentar sincronización</button>
    </form>
    <p aria-live="polite">{notice}</p>
    {items.length > 0 && <ul className="sync-list" aria-label="Inspecciones locales pendientes y en conflicto">{items.map((item) => <li key={item.id}><strong>{item.inspection.location}</strong> — {item.status === "conflict" ? "Conflicto conservado localmente" : "Pendiente de sincronizar"}</li>)}</ul>}
  </section>;
}
