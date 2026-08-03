import type { TournamentState } from "../domain/types";
import { parseTournamentState } from "../domain/validators";
import { getSupabaseClient } from "./supabase";

const CLOUD_CONNECTION_KEY = "heroes3-cloud-tournament-connection-v1";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CloudTournament {
  id: string;
  name: string;
  status: "active" | "completed";
  state: TournamentState;
  updatedAt: string;
}

export interface CloudTournamentConnection {
  tournamentId: string;
  editKey: string;
}

export class CloudTournamentNotFoundError extends Error {
  constructor() {
    super("Tournament not found.");
    this.name = "CloudTournamentNotFoundError";
  }
}

export async function createCloudTournament(
  name: string,
  masterKey: string,
  state: TournamentState
): Promise<CloudTournamentConnection> {
  if (masterKey.length < 32) {
    throw new Error("Enter the tournament master creation key.");
  }
  const editKey = generateEditKey();
  const { data, error } = await getSupabaseClient().rpc(
    "create_cloud_tournament",
    {
      p_name: name,
      p_master_key: masterKey,
      p_edit_key: editKey,
      p_state: state
    }
  );

  if (error) throw new Error(error.message);
  if (typeof data !== "string" || !UUID_PATTERN.test(data)) {
    throw new Error("Supabase returned an invalid tournament ID.");
  }

  const connection = { tournamentId: data, editKey };
  return connection;
}

export async function saveCloudTournament(
  connection: CloudTournamentConnection,
  state: TournamentState
): Promise<string> {
  validateTournamentId(connection.tournamentId);
  if (connection.editKey.length < 32) {
    throw new Error("The tournament edit key is missing or invalid.");
  }

  const { data, error } = await getSupabaseClient().rpc(
    "save_cloud_tournament",
    {
      p_tournament_id: connection.tournamentId,
      p_edit_key: connection.editKey,
      p_state: state
    }
  );

  if (error) throw new Error(error.message);
  if (typeof data !== "string") {
    throw new Error("Supabase did not return the save time.");
  }

  return data;
}

export async function loadCloudTournament(
  tournamentId: string
): Promise<CloudTournament> {
  validateTournamentId(tournamentId);
  const { data, error } = await getSupabaseClient()
    .from("tournaments")
    .select("id,name,status,state,updated_at")
    .eq("id", tournamentId)
    .single();

  if (error?.code === "PGRST116") {
    throw new CloudTournamentNotFoundError();
  }
  if (error) throw new Error(error.message);
  if (!isCloudTournamentRow(data)) {
    throw new Error("Supabase returned invalid tournament data.");
  }

  return {
    id: data.id,
    name: data.name,
    status: data.status,
    state: parseTournamentState(data.state),
    updatedAt: data.updated_at
  };
}

export function loadCloudConnection(): CloudTournamentConnection | null {
  try {
    const saved = localStorage.getItem(CLOUD_CONNECTION_KEY);
    if (!saved) return null;
    const value = JSON.parse(saved) as unknown;
    if (
      typeof value === "object" &&
      value !== null &&
      "tournamentId" in value &&
      "editKey" in value &&
      typeof value.tournamentId === "string" &&
      typeof value.editKey === "string" &&
      UUID_PATTERN.test(value.tournamentId) &&
      value.editKey.length >= 32
    ) {
      return {
        tournamentId: value.tournamentId,
        editKey: value.editKey
      };
    }
  } catch (error) {
    console.warn("Could not load saved cloud tournament credentials.", error);
  }

  return null;
}

export function saveCloudConnection(
  connection: CloudTournamentConnection
): void {
  localStorage.setItem(CLOUD_CONNECTION_KEY, JSON.stringify(connection));
}

export function clearCloudConnection(): void {
  localStorage.removeItem(CLOUD_CONNECTION_KEY);
}

export function validateTournamentId(tournamentId: string): void {
  if (!UUID_PATTERN.test(tournamentId.trim())) {
    throw new Error("Enter a valid cloud tournament ID.");
  }
}

function generateEditKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function isCloudTournamentRow(value: unknown): value is {
  id: string;
  name: string;
  status: "active" | "completed";
  state: unknown;
  updated_at: string;
} {
  if (typeof value !== "object" || value === null) return false;
  return (
    "id" in value &&
    "name" in value &&
    "status" in value &&
    "state" in value &&
    "updated_at" in value &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.status === "active" || value.status === "completed") &&
    typeof value.updated_at === "string"
  );
}
