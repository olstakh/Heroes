const TOURNAMENT_PATH_SEGMENT = "/tournaments/";

export interface AppRoute {
  page: "tournament" | "casual" | "sign-in" | "sign-up";
  tournamentId?: string;
}

export function getAppRoute(): AppRoute {
  const tournamentMarker = window.location.pathname.lastIndexOf(
    TOURNAMENT_PATH_SEGMENT
  );
  if (tournamentMarker !== -1) {
    const tournamentId = window.location.pathname
      .slice(tournamentMarker + TOURNAMENT_PATH_SEGMENT.length)
      .replace(/\/+$/, "");
    if (tournamentId && !tournamentId.includes("/")) {
      return { page: "tournament", tournamentId };
    }
  }

  if (window.location.hash === "#/casual") return { page: "casual" };
  if (window.location.hash === "#/sign-in") return { page: "sign-in" };
  if (window.location.hash === "#/sign-up") return { page: "sign-up" };
  return { page: "tournament" };
}

export function getAppBasePath(): string {
  const pathname = window.location.pathname;
  const tournamentMarker = pathname.lastIndexOf(TOURNAMENT_PATH_SEGMENT);
  if (tournamentMarker !== -1) {
    return pathname.slice(0, tournamentMarker + 1);
  }
  return pathname.endsWith("/")
    ? pathname
    : pathname.slice(0, pathname.lastIndexOf("/") + 1);
}

export function getTournamentUrl(tournamentId: string): string {
  return `${window.location.origin}${getAppBasePath()}tournaments/${tournamentId}`;
}

export function navigateToTournament(tournamentId: string): void {
  window.history.pushState(
    null,
    "",
    `${getAppBasePath()}tournaments/${tournamentId}`
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
}
