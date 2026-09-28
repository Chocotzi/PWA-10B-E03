type LoadingStateProps = {
  label?: string;
  rows?: number;
};

export function LoadingState({
  label = "Cargando inspecciones…",
  rows = 3,
}: LoadingStateProps) {
  const skeletonRows = Math.max(0, Math.floor(rows));

  return (
    <section
      className="loading-state"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="loading-state"
    >
      <p className="loading-state-label">{label}</p>
      <div className="inspection-grid" aria-hidden="true">
        {Array.from({ length: skeletonRows }, (_, index) => (
          <article className="inspection-card loading-card" key={index}>
            <span className="skeleton skeleton-badge" />
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line skeleton-line-short" />
          </article>
        ))}
      </div>
    </section>
  );
}
