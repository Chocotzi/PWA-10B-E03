import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getInspectionById, parseSimulate } from "../../../lib/inspections-repository";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ simular?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const inspection = await getInspectionById(id);

  return {
    title: inspection ? `${inspection.location} · Inspección` : "Inspección no encontrada",
  };
}

export default async function InspeccionDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { simular } = await searchParams;
  const inspection = await getInspectionById(id, { simulate: parseSimulate(simular) });

  if (!inspection) {
    notFound();
  }

  return (
    <main className="page-shell content-section" aria-labelledby="inspection-title">
      <Link className="back-link" href="/inspecciones">← Volver a inspecciones</Link>
      <p className="eyebrow">Detalle SSR</p>
      <h1 id="inspection-title">{inspection.location}</h1>
      <p>{inspection.summary}</p>
      <dl className="inspection-detail">
        <div><dt>Ubicación</dt><dd>{inspection.location}</dd></div>
        <div><dt>Fecha</dt><dd><time dateTime={inspection.date}>{inspection.date}</time></dd></div>
        <div><dt>Responsable</dt><dd>{inspection.inspector}</dd></div>
        <div><dt>Estado</dt><dd><span className={`badge badge-${inspection.status}`}>{inspection.statusLabel}</span></dd></div>
        <div><dt>Hallazgos</dt><dd>{inspection.findings}</dd></div>
        <div><dt>Resumen</dt><dd>{inspection.summary}</dd></div>
      </dl>
    </main>
  );
}
