import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "../../components/loading-state";
import { InspectionsListClient } from "../../components/inspections-list-client";

export const metadata: Metadata = {
  title: "Inspecciones · CSR",
};

export default function InspeccionesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <InspectionsListClient />
    </Suspense>
  );
}
