import type { TownName } from "./towns";

export const DEFAULT_PLAYER_COUNT = 9;
export const MIN_PLAYER_COUNT = 2;
export const GAMES_PER_MATCH = 5;

export type TournamentWinner = "A" | "B" | null;
export type CasualResult = "win" | "loss";

export interface TournamentGame {
  townA: TownName | "";
  townB: TownName | "";
  winner: TournamentWinner;
}

export interface TournamentState {
  players: string[];
  matches: Record<string, TournamentGame[]>;
}

export interface CasualGame {
  id: string;
  playedAt: string;
  opponent: string;
  playerTown: TownName;
  opponentTown: TownName;
  result: CasualResult;
  notes: string;
  createdAt: string;
}

export interface ResolvedGame {
  townA: TownName;
  townB: TownName;
  winner: "A" | "B";
}

export interface WinLossRecord {
  wins: number;
  losses: number;
}

export interface TownRecord extends WinLossRecord {
  games: number;
}

export type TownStats = Record<TownName, TownRecord>;
export type TownMatchupStats = Record<TownName, Record<TownName, WinLossRecord>>;
