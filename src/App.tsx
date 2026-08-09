import { useEffect, useState } from "react";
import { CasualGamesPage } from "./pages/CasualGamesPage";
import { AuthPage } from "./pages/AuthPage";
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

  if (route.page === "casual") return <CasualGamesPage />;
  if (route.page === "sign-in" || route.page === "sign-up") {
    return <AuthPage mode={route.page} />;
  }
  return <TournamentPage tournamentId={route.tournamentId} />;
}
