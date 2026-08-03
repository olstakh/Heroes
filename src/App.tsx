import { useEffect, useState } from "react";
import { CasualGamesPage } from "./pages/CasualGamesPage";
import { TournamentPage } from "./pages/TournamentPage";
import { getAppRoute, type AppRoute } from "./utils/routing";

export function App() {
  const [route, setRoute] = useState<AppRoute>(getAppRoute);

  useEffect(() => {
    const handleLocationChange = () => setRoute(getAppRoute());
    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  return route.page === "casual"
    ? <CasualGamesPage />
    : <TournamentPage tournamentId={route.tournamentId} />;
}
