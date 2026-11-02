"use client";

import { useState } from "react";

type PrivacyPanelProps = {
  /** Borra la cola local y devuelve cuántas inspecciones se eliminaron. */
  onPurge: () => Promise<number>;
  /** Cantidad de inspecciones guardadas en este dispositivo, para informar antes de confirmar. */
  localCount: number;
};

/** Aviso de privacidad corto y borrado de datos locales con confirmación (T-12, T-13). */
export function PrivacyPanel({ onPurge, localCount }: PrivacyPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function purge() {
    setBusy(true);
    try {
      const removed = await onPurge();
      setStatus(removed === 1 ? "Se borró 1 inspección guardada en este dispositivo." : `Se borraron ${removed} inspecciones guardadas en este dispositivo.`);
    } catch {
      setStatus("No se pudieron borrar los datos locales. Inténtalo de nuevo.");
    } finally {
      setConfirming(false);
      setBusy(false);
    }
  }

  return <section className="privacy-panel" aria-labelledby="privacy-title">
    <h2 id="privacy-title">Aviso de privacidad (resumen)</h2>
    <p>
      Este prototipo académico del Equipo 03 (10B) de la UT Tehuacán usa solo datos sintéticos. Sirve para registrar
      inspecciones de laboratorio y sincronizarlas cuando hay red. Mientras no se envían, se guardan en este
      dispositivo. La foto y la ubicación son opcionales: la ubicación se redondea y a la foto se le quitan los
      metadatos. No se comparten con terceros. Evita escribir nombres u otros datos personales reales en el resumen.
      Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición con la Unidad de Transparencia de la
      institución; el inventario completo está en <code>docs/privacy-data-inventory.md</code>.
    </p>
    {!confirming && <button className="secondary-button" type="button" onClick={() => { setStatus(""); setConfirming(true); }}>Borrar datos locales</button>}
    {confirming && <div role="group" aria-label="Confirmar borrado de datos locales">
      <p>{localCount === 1 ? "Se borrará 1 inspección guardada en este dispositivo, incluso si aún no se envió." : `Se borrarán ${localCount} inspecciones guardadas en este dispositivo, incluso si aún no se enviaron.`}</p>
      <button className="button" type="button" onClick={() => void purge()} disabled={busy}>Sí, borrar</button>
      <button className="secondary-button" type="button" onClick={() => setConfirming(false)} disabled={busy}>Cancelar</button>
    </div>}
    <p aria-live="polite" data-testid="privacy-status">{status}</p>
  </section>;
}
