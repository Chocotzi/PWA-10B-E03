import { AppShell } from "../components/app-shell";
import { inspections } from "../lib/data/inspections";

type PageProps = { searchParams: Promise<{ state?: string }> };
type ViewState = "loading" | "error" | "empty" | "default";

function getViewState(value?: string): ViewState {
  return value === "loading" || value === "error" || value === "empty" ? value : "default";
}

export default async function HomePage({ searchParams }: PageProps) {
  const { state } = await searchParams;
  const viewState = getViewState(state);

  return (
    <AppShell>
      <section className="hero" aria-labelledby="page-title">
        <div className="page-shell">
          <p className="eyebrow">Registro de mantenimiento</p>
          <h1 id="page-title">Inspecciones de laboratorio</h1>
          <p className="lead">Consulta y da seguimiento a las revisiones de los laboratorios. Los datos mostrados son sintéticos.</p>
        </div>
      </section>
      <section id="inspecciones" aria-labelledby="inspections-heading" className="page-shell content-section">
        <div className="section-heading">
          <div><p className="eyebrow">Registros</p><h2 id="inspections-heading">Inspecciones recientes</h2></div>
          {viewState === "default" && <span className="count">{inspections.length} registros</span>}
        </div>
        {viewState === "loading" && <div className="state-panel" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /><p>Cargando inspecciones…</p></div>}
        {viewState === "error" && <div className="state-panel state-error" role="alert"><h3>No se pudieron cargar las inspecciones</h3><p>Revisa tu conexión e inténtalo nuevamente.</p><a className="button" href="/">Reintentar</a></div>}
        {viewState === "empty" && <div className="state-panel"><h3>Aún no hay inspecciones</h3><p>Cuando se registren revisiones aparecerán en esta sección.</p><a className="button" href="/">Ver registros de ejemplo</a></div>}
        {viewState === "default" && <div className="inspection-grid">
          {inspections.map((inspection) => <article className="inspection-card" key={inspection.id}>
            <div className="card-topline"><span className={`badge badge-${inspection.status}`}>{inspection.statusLabel}</span><time className="muted" dateTime={inspection.date}>{inspection.date}</time></div>
            <h3>{inspection.location}</h3><p>{inspection.summary}</p>
            <dl><div><dt>Responsable</dt><dd>{inspection.inspector}</dd></div><div><dt>Hallazgos</dt><dd>{inspection.findings}</dd></div></dl>
          </article>)}
        </div>}
      </section>
    </AppShell>
  );
}
