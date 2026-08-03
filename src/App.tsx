import { useEffect, useState } from "react";
import { CasualGamesPage } from "./pages/CasualGamesPage";
import { TournamentPage } from "./pages/TournamentPage";

type Page = "tournament" | "casual";

function getPage(): Page {
  return window.location.hash === "#/casual" ? "casual" : "tournament";
}

export function App() {
  const [page, setPage] = useState<Page>(getPage);

  useEffect(() => {
    const handleHashChange = () => setPage(getPage());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return page === "casual" ? <CasualGamesPage /> : <TournamentPage />;
}
