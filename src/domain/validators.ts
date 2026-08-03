import { z } from "zod";
import {
  GAMES_PER_MATCH,
  MIN_PLAYER_COUNT,
  type CasualGame,
  type TournamentState
} from "./types";
import { TOWN_NAMES } from "./towns";

const townNameSchema = z.enum(TOWN_NAMES);
const dateSchema = z.string().refine(isValidDateString, "Invalid game date");

const tournamentGameSchema = z.object({
  townA: z.union([townNameSchema, z.literal("")]),
  townB: z.union([townNameSchema, z.literal("")]),
  winner: z.union([z.literal("A"), z.literal("B"), z.null()])
}).refine(
  (game) => !game.winner || Boolean(game.townA && game.townB),
  "Completed games require both towns"
);

const tournamentStateSchema = z.object({
  players: z.array(z.string().trim().min(1).max(30)).min(MIN_PLAYER_COUNT),
  matches: z.record(
    z.string(),
    z.array(tournamentGameSchema).length(GAMES_PER_MATCH)
  )
});

const casualGameSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{1,100}$/),
  playedAt: dateSchema,
  opponent: z.string().trim().max(60),
  playerTown: townNameSchema,
  opponentTown: townNameSchema,
  result: z.enum(["win", "loss"]),
  notes: z.string().trim().max(500),
  createdAt: z.string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid creation date")
    .transform((value) => new Date(value).toISOString())
});

export function parseTournamentState(input: unknown): TournamentState {
  const state = tournamentStateSchema.parse(input);

  for (const key of Object.keys(state.matches)) {
    const match = /^(\d+)-(\d+)$/.exec(key);
    const playerA = match ? Number(match[1]) : -1;
    const playerB = match ? Number(match[2]) : -1;
    if (!match || playerA >= playerB || playerA < 0 || playerB >= state.players.length) {
      throw new Error(`"${key}" is not a valid matchup.`);
    }
  }

  return state;
}

export function parseCasualGames(input: unknown): CasualGame[] {
  const games = z.array(casualGameSchema).parse(input);
  const seenIds = new Set<string>();
  return games.map((game) => {
    let id = game.id;
    while (seenIds.has(id)) id = crypto.randomUUID();
    seenIds.add(id);
    return id === game.id ? game : { ...game, id };
  });
}

export function getValidationMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "The data is invalid.";
  }
  return error instanceof Error ? error.message : "The data is invalid.";
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
