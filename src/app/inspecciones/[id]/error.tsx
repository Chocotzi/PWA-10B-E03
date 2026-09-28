"use client";

import { ErrorState } from "../../../components/error-state";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No se pudo cargar la inspección"
      message="Revisa tu conexión e inténtalo nuevamente."
      onRetry={reset}
    />
  );
}
