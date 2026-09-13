import type { ReactNode } from "react";

type AppShellProps = { children: ReactNode };

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <header className="site-header">
        <div className="site-header-content">
          <a className="brand" href="/" aria-label="Inicio: Inspecciones de laboratorio">Inspecciones</a>
          <nav aria-label="Navegación principal">
            <ul className="primary-nav">
              <li><a href="#inspecciones">Inspecciones</a></li>
              <li><a href="#ayuda">Ayuda</a></li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="footer" id="ayuda">
        <p>Aplicaciones Web Progresivas · Universidad Tecnológica de Tehuacán</p>
        <p><a href="mailto:soporte@inspecciones.example">Solicitar ayuda</a></p>
      </footer>
    </div>
  );
}
