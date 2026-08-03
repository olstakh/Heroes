import type {
  ResolvedGame,
  TownMatchupStats,
  TownStats,
  WinLossRecord
} from "../domain/types";
import { TOWN_NAMES, type TownName } from "../domain/towns";

export function createTownStats(): TownStats {
  return Object.fromEntries(
    TOWN_NAMES.map((town) => [
      town,
      { games: 0, wins: 0, losses: 0 }
    ])
  ) as TownStats;
}

export function createTownMatchupStats(): TownMatchupStats {
  return Object.fromEntries(
    TOWN_NAMES.map((rowTown) => [
      rowTown,
      Object.fromEntries(
        TOWN_NAMES.map((columnTown) => [
          columnTown,
          { wins: 0, losses: 0 }
        ])
      )
    ])
  ) as TownMatchupStats;
}

export function calculateTownStats(games: readonly ResolvedGame[]): TownStats {
  const stats = createTownStats();
  for (const game of games) {
    const townA = stats[game.townA];
    const townB = stats[game.townB];
    townA.games += 1;
    townB.games += 1;
    townA[game.winner === "A" ? "wins" : "losses"] += 1;
    townB[game.winner === "A" ? "losses" : "wins"] += 1;
  }
  return stats;
}

export function calculateTownMatchups(
  games: readonly ResolvedGame[]
): TownMatchupStats {
  const stats = createTownMatchupStats();
  for (const game of games) {
    stats[game.townA][game.townB][game.winner === "A" ? "wins" : "losses"] += 1;
    stats[game.townB][game.townA][game.winner === "A" ? "losses" : "wins"] += 1;
  }
  return stats;
}

export function emptyWinLossByTown(): Record<TownName, WinLossRecord> {
  return Object.fromEntries(
    TOWN_NAMES.map((town) => [town, { wins: 0, losses: 0 }])
  ) as Record<TownName, WinLossRecord>;
}
