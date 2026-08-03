import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Layout } from "../components/Layout";
import { SectionHeading } from "../components/SectionHeading";
import { TownCards } from "../components/TownCards";
import { TownMatchupTable } from "../components/TownMatchupTable";
import { TOWNS, type TownName } from "../domain/towns";
import type {
  CasualGame,
  CasualResult,
  ResolvedGame
} from "../domain/types";
import {
  getValidationMessage,
  parseCasualGames
} from "../domain/validators";
import {
  loadCasualGames,
  saveCasualGames
} from "../services/storage";
import { downloadJson, readJsonFile } from "../utils/files";
import { createGameId } from "../utils/ids";
import {
  calculateTownMatchups,
  calculateTownStats,
  createTownStats
} from "../utils/stats";

interface CasualDraft {
  id: string;
  playedAt: string;
  opponent: string;
  playerTown: TownName | "";
  opponentTown: TownName | "";
  result: CasualResult | "";
  notes: string;
  createdAt: string;
}

function createEmptyDraft(): CasualDraft {
  return {
    id: "",
    playedAt: new Date().toISOString().slice(0, 10),
    opponent: "",
    playerTown: "",
    opponentTown: "",
    result: "",
    notes: "",
    createdAt: ""
  };
}

function toResolvedGames(games: readonly CasualGame[]): ResolvedGame[] {
  return games.map((game) => ({
    townA: game.playerTown,
    townB: game.opponentTown,
    winner: game.result === "win" ? "A" : "B"
  }));
}

export function CasualGamesPage() {
  const [games, setGames] = useState<CasualGame[]>(loadCasualGames);
  const [draft, setDraft] = useState<CasualDraft>(createEmptyDraft);
  const importInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const resolvedGames = useMemo(() => toResolvedGames(games), [games]);
  const combinedStats = useMemo(
    () => calculateTownStats(resolvedGames),
    [resolvedGames]
  );
  const townMatchups = useMemo(
    () => calculateTownMatchups(resolvedGames),
    [resolvedGames]
  );
  const personalStats = useMemo(() => {
    const stats = createTownStats();
    for (const game of games) {
      const record = stats[game.playerTown];
      record.games += 1;
      record[game.result === "win" ? "wins" : "losses"] += 1;
    }
    return stats;
  }, [games]);

  const wins = games.filter((game) => game.result === "win").length;
  const losses = games.length - wins;
  const favoriteTown = TOWNS
    .map((town) => ({ name: town.name, games: personalStats[town.name].games }))
    .sort((left, right) => right.games - left.games)[0];

  function commitGames(nextGames: CasualGame[]): void {
    setGames(nextGames);
    saveCasualGames(nextGames);
  }

  function resetDraft(): void {
    setDraft(createEmptyDraft());
  }

  function saveGame(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!draft.playerTown || !draft.opponentTown || !draft.result) return;

    const candidate: CasualGame = {
      id: draft.id || createGameId(),
      playedAt: draft.playedAt,
      opponent: draft.opponent.trim(),
      playerTown: draft.playerTown,
      opponentTown: draft.opponentTown,
      result: draft.result,
      notes: draft.notes.trim(),
      createdAt: draft.createdAt || new Date().toISOString()
    };

    try {
      const validated = parseCasualGames([candidate])[0];
      if (!validated) throw new Error("The game could not be validated.");
      const existingIndex = games.findIndex((game) => game.id === validated.id);
      const nextGames =
        existingIndex === -1
          ? [...games, validated]
          : games.map((game) => game.id === validated.id ? validated : game);
      commitGames(nextGames);
      resetDraft();
    } catch (error) {
      window.alert(`Could not save this game: ${getValidationMessage(error)}`);
    }
  }

  function editGame(game: CasualGame): void {
    setDraft({ ...game });
    window.setTimeout(
      () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      0
    );
  }

  function deleteGame(game: CasualGame): void {
    if (
      !window.confirm(
        `Remove the game against ${game.opponent || "Public lobby player"}?`
      )
    ) {
      return;
    }
    commitGames(games.filter((item) => item.id !== game.id));
    if (draft.id === game.id) resetDraft();
  }

  function exportGames(): void {
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`heroes3-casual-games-${date}.json`, {
      version: 2,
      exportedAt: new Date().toISOString(),
      casualGames: games
    });
  }

  async function importGames(
    event: ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const parsed = await readJsonFile(file);
      const candidate =
        isRecord(parsed) && "casualGames" in parsed
          ? parsed.casualGames
          : parsed;
      const imported = parseCasualGames(candidate);
      if (
        !window.confirm(
          `Replace the current history with ${imported.length} imported games?`
        )
      ) {
        return;
      }
      commitGames(imported);
      resetDraft();
      window.alert("Casual game history imported successfully.");
    } catch (error) {
      window.alert(`Could not import this file: ${getValidationMessage(error)}`);
    }
  }

  function resetGames(): void {
    if (!games.length || !window.confirm("Clear every recorded casual game?")) {
      return;
    }
    commitGames([]);
    resetDraft();
  }

  return (
    <Layout
      activePage="casual"
      title="Casual Game Log"
      subtitle="Build your personal record one battle at a time."
      actions={
        <>
          <button className="button" type="button" onClick={exportGames}>
            Export JSON
          </button>
          <button
            className="button"
            type="button"
            onClick={() => importInputRef.current?.click()}
          >
            Import JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(event) => void importGames(event)}
            hidden
          />
          <button
            className="button button-danger"
            type="button"
            onClick={resetGames}
          >
            Reset games
          </button>
        </>
      }
    >
      <section className="casual-summary" aria-label="Personal game summary">
        <Metric label="Games recorded" value={String(games.length)} />
        <Metric label="Personal record" value={`${wins}–${losses}`} />
        <Metric
          label="Win rate"
          value={games.length ? `${Math.round((wins / games.length) * 100)}%` : "0%"}
        />
        <Metric
          label="Most played town"
          value={
            favoriteTown?.games
              ? `${favoriteTown.name} (${favoriteTown.games})`
              : "No games yet"
          }
        />
      </section>

      <section className="panel">
        <SectionHeading
          eyebrow="Record a battle"
          title={draft.id ? "Edit casual game" : "Add casual game"}
          description="Opponent and notes are optional; towns and result are required."
        />
        <form ref={formRef} className="casual-form" onSubmit={saveGame}>
          <label className="form-field">
            <span>Date</span>
            <input
              type="date"
              value={draft.playedAt}
              required
              onChange={(event) =>
                setDraft({ ...draft, playedAt: event.target.value })
              }
            />
          </label>
          <label className="form-field">
            <span>Opponent</span>
            <input
              type="text"
              value={draft.opponent}
              maxLength={60}
              placeholder="Public lobby player"
              onChange={(event) =>
                setDraft({ ...draft, opponent: event.target.value })
              }
            />
          </label>
          <TownSelect
            label="My town"
            value={draft.playerTown}
            onChange={(playerTown) => setDraft({ ...draft, playerTown })}
          />
          <TownSelect
            label="Opponent town"
            value={draft.opponentTown}
            onChange={(opponentTown) => setDraft({ ...draft, opponentTown })}
          />
          <label className="form-field">
            <span>Result</span>
            <select
              value={draft.result}
              required
              onChange={(event) =>
                setDraft({
                  ...draft,
                  result: event.target.value as CasualResult | ""
                })
              }
            >
              <option value="">Choose result</option>
              <option value="win">I won</option>
              <option value="loss">I lost</option>
            </select>
          </label>
          <label className="form-field form-field-wide">
            <span>Notes</span>
            <input
              type="text"
              value={draft.notes}
              maxLength={500}
              placeholder="Map, rules, memorable moments…"
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
            />
          </label>
          <div className="form-actions">
            {draft.id && (
              <button className="button button-quiet" type="button" onClick={resetDraft}>
                Cancel edit
              </button>
            )}
            <button className="button button-primary" type="submit">
              Save game
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <SectionHeading
          eyebrow="Personal performance"
          title="My statistics by town"
          description="Only the towns you played are counted here."
        />
        <TownCards stats={personalStats} />
      </section>

      <section className="panel">
        <SectionHeading
          eyebrow="All recorded armies"
          title="Combined town statistics"
          description="Includes both your town and your opponent’s town in every game."
        />
        <TownCards stats={combinedStats} />
      </section>

      <section className="panel">
        <SectionHeading
          eyebrow="Faction matchups"
          title="Casual town vs town"
          description="Each cell shows the row town’s wins–losses against the column town."
        />
        <TownMatchupTable stats={townMatchups} totals={combinedStats} />
      </section>

      <section className="panel">
        <SectionHeading
          eyebrow="Battle archive"
          title="Game history"
          description="Edit mistakes or remove games that should not be counted."
        />
        <CasualHistory games={games} onEdit={editGame} onDelete={deleteGame} />
      </section>
    </Layout>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <article className="metric-card">
      <span className="summary-label">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

interface TownSelectProps {
  label: string;
  value: TownName | "";
  onChange: (town: TownName | "") => void;
}

function TownSelect({ label, value, onChange }: TownSelectProps) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select
        value={value}
        required
        onChange={(event) => onChange(event.target.value as TownName | "")}
      >
        <option value="">Choose town</option>
        {TOWNS.map((town) => (
          <option value={town.name} key={town.name}>{town.name}</option>
        ))}
      </select>
    </label>
  );
}

interface CasualHistoryProps {
  games: CasualGame[];
  onEdit: (game: CasualGame) => void;
  onDelete: (game: CasualGame) => void;
}

function CasualHistory({ games, onEdit, onDelete }: CasualHistoryProps) {
  const sortedGames = [...games].sort(
    (left, right) =>
      right.playedAt.localeCompare(left.playedAt) ||
      right.createdAt.localeCompare(left.createdAt)
  );

  return (
    <div className="table-scroll">
      <table className="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Opponent</th>
            <th>Matchup</th>
            <th>Result</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {!sortedGames.length ? (
            <tr>
              <td className="empty-state" colSpan={6}>
                No casual games recorded yet.
              </td>
            </tr>
          ) : (
            sortedGames.map((game) => {
              const playerTown = TOWNS.find(
                (town) => town.name === game.playerTown
              );
              const opponentTown = TOWNS.find(
                (town) => town.name === game.opponentTown
              );
              if (!playerTown || !opponentTown) return null;
              return (
                <tr key={game.id}>
                  <td>{formatDate(game.playedAt)}</td>
                  <td>{game.opponent || "Public lobby player"}</td>
                  <td>
                    <span className="history-matchup">
                      <img src={playerTown.image} alt="" />
                      {playerTown.name}
                      <span>vs</span>
                      <img src={opponentTown.image} alt="" />
                      {opponentTown.name}
                    </span>
                  </td>
                  <td>
                    <span className={`result-pill ${game.result}`}>
                      {game.result === "win" ? "Win" : "Loss"}
                    </span>
                  </td>
                  <td className="history-notes">{game.notes || "—"}</td>
                  <td>
                    <span className="history-actions">
                      <button
                        className="button button-quiet"
                        type="button"
                        onClick={() => onEdit(game)}
                      >
                        Edit
                      </button>
                      <button
                        className="button button-quiet history-delete"
                        type="button"
                        onClick={() => onDelete(game)}
                      >
                        Delete
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00Z`));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
