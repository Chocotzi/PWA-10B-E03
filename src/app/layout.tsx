import type { Metadata, Viewport } from "next";
import { ServiceWorkerManager } from "../components/pwa/ServiceWorkerManager";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inspecciones de laboratorio",
  description: "Proyecto base de Aplicaciones Web Progresivas",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>
        {children}
        <ServiceWorkerManager />
      </body>
    </html>
  );
}
