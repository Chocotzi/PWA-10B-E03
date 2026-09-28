type ErrorStateProps = {
  title: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <section className="error-state" role="alert" data-testid="error-state">
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Reintentar
        </button>
      ) : null}
    </section>
  );
}
