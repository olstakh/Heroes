import type { ReactNode } from "react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getAppBasePath } from "../utils/routing";

interface LayoutProps {
  activePage: "tournament" | "casual" | null;
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
  const { session, profile, loading, signOut } = useAuth();
  const [signOutBusy, setSignOutBusy] = useState(false);

  async function handleSignOut(): Promise<void> {
    setSignOutBusy(true);
    try {
      await signOut();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Could not sign out."
      );
    } finally {
      setSignOutBusy(false);
    }
  }

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
        <div className="hero-controls">
          <div className="account-control">
            {loading ? (
              <span className="account-name">Checking account…</span>
            ) : session ? (
              <>
                <span className="account-avatar" aria-hidden="true">
                  {(profile?.gameUsername ?? session.user.email ?? "?")
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
                <span className="account-name">
                  {profile?.gameUsername ?? session.user.email}
                </span>
                <button
                  className="button button-quiet account-button"
                  type="button"
                  disabled={signOutBusy}
                  onClick={() => void handleSignOut()}
                >
                  {signOutBusy ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : (
              <a
                className="button button-quiet account-button"
                href={`${appBasePath}#/sign-in`}
              >
                <span className="account-avatar" aria-hidden="true">?</span>
                Sign in
              </a>
            )}
          </div>
          {actions && <div className="hero-actions">{actions}</div>}
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
