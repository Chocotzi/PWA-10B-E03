"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ErrorState } from "./error-state";
import { LoadingState } from "./loading-state";
import type { Inspection, InspectionStatus } from "../lib/data/inspections";

type LoadState =
  | { kind: "loading" }
  | { kind: "success"; data: Inspection[] }
  | { kind: "empty"; data: Inspection[] }
  | { kind: "error" };

type Filter = "all" | InspectionStatus;

function simulationFromSearch(search: string): string {
  const value = new URLSearchParams(search).get("simular");
  return value === "lento" || value === "error" ? `?simular=${value}` : "";
}

export function InspectionsListClient() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [filter, setFilter] = useState<Filter>("all");

  const loadInspections = useCallback(async (suffix: string, signal?: AbortSignal) => {
    setState({ kind: "loading" });
    try {
      const response = await fetch(`/api/inspecciones${suffix}`, { signal });
      if (!response.ok) {
        throw new Error("No se pudieron cargar las inspecciones");
      }
      const payload = (await response.json()) as { data?: Inspection[] };
      const data = payload.data ?? [];
      setState(data.length > 0 ? { kind: "success", data } : { kind: "empty", data });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadInspections(simulationFromSearch(searchParams.toString()), controller.signal);
    return () => controller.abort();
  }, [loadInspections, searchParams]);

  if (state.kind === "loading") {
    return <LoadingState />;
  }

  if (state.kind === "error") {
    return (
      <ErrorState
        title="No se pudieron cargar las inspecciones"
        message="Revisa tu conexión e inténtalo nuevamente."
        onRetry={() => void loadInspections("")}
      />
    );
  }

  const filtered = filter === "all" ? state.data : state.data.filter((item) => item.status === filter);

  return (
    <section className="page-shell content-section" aria-labelledby="csr-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Renderizado cliente</p>
          <h1 id="csr-title">Inspecciones</h1>
        </div>
        <span className="count" aria-live="polite">{filtered.length} registros</span>
      </div>
      <label className="filter-label" htmlFor="inspection-filter">Filtrar inspecciones</label>
      <select id="inspection-filter" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
        <option value="all">Todas</option>
        <option value="attention">Requiere atención</option>
        <option value="ok">Sin incidencias</option>
      </select>
      {filtered.length === 0 ? (
        <div className="state-panel"><h2>No hay inspecciones con ese estado</h2></div>
      ) : (
        <div className="inspection-grid">
          {filtered.map((inspection) => (
            <article className="inspection-card" key={inspection.id}>
              <div className="card-topline">
                <span className={`badge badge-${inspection.status}`}>{inspection.statusLabel}</span>
                <time className="muted" dateTime={inspection.date}>{inspection.date}</time>
              </div>
              <h2>{inspection.location}</h2>
              <p>{inspection.summary}</p>
              <dl>
                <div><dt>Responsable</dt><dd>{inspection.inspector}</dd></div>
                <div><dt>Hallazgos</dt><dd>{inspection.findings}</dd></div>
              </dl>
              <Link className="button" href={`/inspecciones/${inspection.id}`}>Ver detalle</Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
