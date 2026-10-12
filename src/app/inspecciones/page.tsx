import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "../../components/loading-state";
import { InspectionsListClient } from "../../components/inspections-list-client";
import { InspectionCaptureClient } from "../../components/inspection-capture-client";

export const metadata: Metadata = {
  title: "Inspecciones · CSR",
};

export default function InspeccionesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <InspectionCaptureClient />
      <InspectionsListClient />
    </Suspense>
  );
}
