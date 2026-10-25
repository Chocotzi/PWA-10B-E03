"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Inspection, InspectionStatus } from "../lib/data/inspections";
import { describeEvidence, normalizeEvidence, type InspectionEvidence } from "../lib/device/evidence";
import {
  inAppText,
  notifyChange,
  savedNotice,
  syncNotice,
  type ChangeNotice,
  type NotificationEnvironment,
} from "../lib/notifications/client";
import { openMutationStorage, type PendingMutation } from "../lib/storage/schema";
import { createSyncQueue, type SyncTransport } from "../lib/sync/queue";
import { EvidenceCapture, type DeviceAdapters } from "./evidence-capture";
import { NotificationPreferences } from "./notification-preferences";

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

function makeInspection(form: HTMLFormElement, evidence: InspectionEvidence): Inspection {
  const fields = new FormData(form);
  const status = fields.get("status") as InspectionStatus;
  const attached = normalizeEvidence(evidence);
  return {
    id: `synthetic-${crypto.randomUUID()}`, location: String(fields.get("location")),
    date: new Date().toISOString().slice(0, 10), inspector: String(fields.get("inspector")), status,
    statusLabel: status === "ok" ? "Sin incidencias" : "Requiere atención",
    findings: Number(fields.get("findings")), summary: String(fields.get("summary")),
    ...(attached ? { evidence: attached } : {}),
  };
}

type InspectionCaptureClientProps = {
  /** Solo para pruebas: sustituye las APIs de cámara, ubicación y permisos. */
  devices?: Partial<DeviceAdapters>;
  /** Solo para pruebas: sustituye la API de notificaciones. */
  notifications?: NotificationEnvironment;
};

export function InspectionCaptureClient({ devices, notifications }: InspectionCaptureClientProps = {}) {
  const queueRef = useRef<ReturnType<typeof createSyncQueue>>();
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;
  const [items, setItems] = useState<PendingMutation[]>([]);
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState("Preparando captura sin conexión…");
  const [evidence, setEvidence] = useState<InspectionEvidence>({});
  const [evidenceKey, setEvidenceKey] = useState(0);

  // Aviso de cambio: siempre en la página (aria-live); además en el sistema si hay permiso.
  const announce = useCallback((change: ChangeNotice) => {
    setNotice(inAppText(change));
    void notifyChange(change, notificationsRef.current);
  }, []);

  const refresh = useCallback(async () => setItems(await queueRef.current?.list() ?? []), []);
  const flush = useCallback(async () => {
    if (!queueRef.current || !navigator.onLine) return;
    try {
      const result = await queueRef.current.flush();
      const change = syncNotice(result);
      if (change) announce(change);
      else setNotice(result.deferred > 0 ? "No se pudo sincronizar; la copia local sigue guardada." : "Sincronización terminada.");
    } catch { setNotice("No se pudo sincronizar; la copia local sigue guardada."); }
    await refresh();
  }, [announce, refresh]);

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
    // React limpia `event.currentTarget` al terminar el despacho; se conserva antes del primer await.
    const form = event.currentTarget;
    if (!queueRef.current) return;
    const inspection = makeInspection(form, evidence);
    await queueRef.current.enqueue(inspection, null);
    form.reset();
    setEvidence({});
    setEvidenceKey((key) => key + 1); // reinicia los mensajes del bloque de evidencia
    announce(savedNotice(inspection, navigator.onLine));
    await refresh();
    void flush();
  }

  const pending = items.filter((item) => item.status === "pending");
  const conflicts = items.filter((item) => item.status === "conflict");
  return <section className="capture-panel" aria-labelledby="capture-title">
    <div className="capture-heading">
      <div><p className="eyebrow">Captura offline</p><h2 id="capture-title">Nueva inspección sintética</h2></div>
      <NotificationPreferences env={notifications} />
    </div>
    <p className="sync-summary" role="status">{online ? "Con conexión" : "Sin conexión"} · {pending.length} pendientes · {conflicts.length} conflictos</p>
    <form className="capture-form" onSubmit={save}>
      <label>Laboratorio sintético<input name="location" required defaultValue="Laboratorio de Redes" /></label>
      <label>Responsable sintético<input name="inspector" required defaultValue="Técnica de prueba" /></label>
      <label>Estado<select name="status" defaultValue="ok"><option value="ok">Sin incidencias</option><option value="attention">Requiere atención</option></select></label>
      <label>Hallazgos<input name="findings" type="number" min="0" defaultValue="0" required /></label>
      <label className="form-wide">Resumen sintético<textarea name="summary" required defaultValue="Registro sintético para comprobar la captura sin conexión." /></label>
      <EvidenceCapture key={evidenceKey} value={evidence} onChange={setEvidence} devices={devices} />
      <button className="button" type="submit">Guardar sin conexión</button>
      <button className="secondary-button" type="button" onClick={() => void flush()} disabled={!online}>Reintentar sincronización</button>
    </form>
    <p aria-live="polite" data-testid="capture-notice">{notice}</p>
    {items.length > 0 && <ul className="sync-list" aria-label="Inspecciones locales pendientes y en conflicto">{items.map((item) => <li key={item.id}><strong>{item.inspection.location}</strong> — {item.status === "conflict" ? "Conflicto conservado localmente" : "Pendiente de sincronizar"} · {describeEvidence(item.inspection.evidence)}</li>)}</ul>}
  </section>;
}
