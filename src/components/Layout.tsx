import type { ReactNode } from "react";
import { getAppBasePath } from "../utils/routing";

interface LayoutProps {
  activePage: "tournament" | "casual";
  title: string;
  subtitle: string;
  actions: ReactNode;
  children: ReactNode;
}

export function Layout({
  activePage,
  title,
  subtitle,
  actions,
  children
}: LayoutProps) {
  const appBasePath = getAppBasePath();
  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Heroes of Might and Magic III</p>
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
          <nav className="page-nav" aria-label="Game tracker sections">
            <a
              className={`nav-link ${activePage === "tournament" ? "active" : ""}`}
              href={appBasePath}
              aria-current={activePage === "tournament" ? "page" : undefined}
            >
              Tournament
            </a>
            <a
              className={`nav-link ${activePage === "casual" ? "active" : ""}`}
              href={`${appBasePath}#/casual`}
              aria-current={activePage === "casual" ? "page" : undefined}
            >
              Casual games
            </a>
          </nav>
        </div>
        <div className="hero-actions">{actions}</div>
      </header>
      <main>{children}</main>
    </>
  );
}
