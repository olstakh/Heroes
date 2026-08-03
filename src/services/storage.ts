import {
  DEFAULT_PLAYER_COUNT,
  GAMES_PER_MATCH,
  type CasualGame,
  type TournamentGame,
  type TournamentState
} from "../domain/types";
import { parseCasualGames, parseTournamentState } from "../domain/validators";

const TOURNAMENT_STORAGE_KEY = "heroes3-tournament-ledger-v1";
const CASUAL_STORAGE_KEY = "heroes3-casual-game-log-v1";

export function createDefaultTournament(): TournamentState {
  return {
    players: Array.from(
      { length: DEFAULT_PLAYER_COUNT },
      (_, index) => `Player ${index + 1}`
    ),
    matches: {}
  };
}

export function createEmptyMatch(): TournamentGame[] {
  return Array.from({ length: GAMES_PER_MATCH }, () => ({
    townA: "",
    townB: "",
    winner: null
  }));
}

export function loadTournament(): TournamentState {
  return loadValidated(
    TOURNAMENT_STORAGE_KEY,
    parseTournamentState,
    createDefaultTournament()
  );
}

export function saveTournament(state: TournamentState): void {
  localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(state));
}

export function loadCasualGames(): CasualGame[] {
  return loadValidated(CASUAL_STORAGE_KEY, parseCasualGames, []);
}

export function saveCasualGames(games: CasualGame[]): void {
  localStorage.setItem(CASUAL_STORAGE_KEY, JSON.stringify(games));
}

function loadValidated<T>(
  key: string,
  parse: (input: unknown) => T,
  fallback: T
): T {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;

  try {
    return parse(JSON.parse(saved));
  } catch (error) {
    console.warn(`Could not load data from ${key}.`, error);
    return fallback;
  }
}
