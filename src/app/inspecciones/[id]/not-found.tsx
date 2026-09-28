import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell content-section" aria-labelledby="not-found-title">
      <h1 id="not-found-title">Inspección no encontrada</h1>
      <p>La inspección solicitada no existe.</p>
      <Link className="button" href="/inspecciones">← Volver a inspecciones</Link>
    </main>
  );
}
