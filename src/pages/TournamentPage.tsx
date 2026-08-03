import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from "react";
import { Layout } from "../components/Layout";
import { SectionHeading } from "../components/SectionHeading";
import { TownCards } from "../components/TownCards";
import { TownMatchupTable } from "../components/TownMatchupTable";
import { TOWNS, type TownName } from "../domain/towns";
import {
  GAMES_PER_MATCH,
  MIN_PLAYER_COUNT,
  type ResolvedGame,
  type TournamentGame,
  type TournamentState,
  type TournamentWinner
} from "../domain/types";
import {
  getValidationMessage,
  parseTournamentState
} from "../domain/validators";
import {
  createEmptyMatch,
  loadTournament,
  saveTournament
} from "../services/storage";
import { downloadJson, readJsonFile } from "../utils/files";
import {
  calculateTownMatchups,
  calculateTownStats,
  emptyWinLossByTown
} from "../utils/stats";

interface ActiveMatch {
  playerA: number;
  playerB: number;
}

interface RosterEntry {
  id: string;
  originalIndex: number | null;
  name: string;
}

function matchKey(playerA: number, playerB: number): string {
  return `${Math.min(playerA, playerB)}-${Math.max(playerA, playerB)}`;
}

function parseMatchKey(key: string): [number, number] {
  const [playerA = "-1", playerB = "-1"] = key.split("-");
  return [Number(playerA), Number(playerB)];
}

function getResolvedGames(state: TournamentState): ResolvedGame[] {
  return Object.values(state.matches).flatMap((games) =>
    games.flatMap((game) =>
      game.winner && game.townA && game.townB
        ? [{ townA: game.townA, townB: game.townB, winner: game.winner }]
        : []
    )
  );
}

export function TournamentPage() {
  const [state, setState] = useState<TournamentState>(loadTournament);
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);
  const [matchDraft, setMatchDraft] = useState<TournamentGame[]>([]);
  const [rosterDraft, setRosterDraft] = useState<RosterEntry[] | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const resolvedGames = useMemo(() => getResolvedGames(state), [state]);
  const townStats = useMemo(
    () => calculateTownStats(resolvedGames),
    [resolvedGames]
  );
  const townMatchups = useMemo(
    () => calculateTownMatchups(resolvedGames),
    [resolvedGames]
  );
  const playerTotals = useMemo(
    () => state.players.map((_, index) => getPlayerTotals(state, index)),
    [state]
  );
  const playerTownStats = useMemo(() => {
    const stats = state.players.map(() => emptyWinLossByTown());
    for (const [key, games] of Object.entries(state.matches)) {
      const [playerA, playerB] = parseMatchKey(key);
      for (const game of games) {
        if (!game.winner || !game.townA || !game.townB) continue;
        const playerAStats = stats[playerA];
        const playerBStats = stats[playerB];
        if (!playerAStats || !playerBStats) continue;
        playerAStats[game.townA][game.winner === "A" ? "wins" : "losses"] += 1;
        playerBStats[game.townB][game.winner === "B" ? "wins" : "losses"] += 1;
      }
    }
    return stats;
  }, [state]);

  const completedGames = resolvedGames.length;
  const maximumGames =
    (state.players.length * (state.players.length - 1) / 2) * GAMES_PER_MATCH;
  const bestWins = Math.max(...playerTotals.map((total) => total.wins), 0);
  const leaders = bestWins
    ? state.players.filter((_, index) => playerTotals[index]?.wins === bestWins)
    : [];

  function commitState(nextState: TournamentState): void {
    setState(nextState);
    saveTournament(nextState);
  }

  function openMatch(playerOne: number, playerTwo: number): void {
    const playerA = Math.min(playerOne, playerTwo);
    const playerB = Math.max(playerOne, playerTwo);
    setActiveMatch({ playerA, playerB });
    setMatchDraft(
      (state.matches[matchKey(playerA, playerB)] ?? createEmptyMatch()).map(
        (game) => ({ ...game })
      )
    );
  }

  function updateMatchGame(
    gameIndex: number,
    field: keyof TournamentGame,
    value: TownName | "" | TournamentWinner
  ): void {
    setMatchDraft((current) =>
      current.map((game, index) =>
        index === gameIndex ? { ...game, [field]: value } : game
      )
    );
  }

  function saveMatch(): void {
    if (!activeMatch) return;
    const incompleteGame = matchDraft.findIndex(
      (game) => game.winner && (!game.townA || !game.townB)
    );
    if (incompleteGame !== -1) {
      window.alert(
        `Choose both towns before recording a winner for game ${incompleteGame + 1}.`
      );
      return;
    }
    commitState({
      ...state,
      matches: {
        ...state.matches,
        [matchKey(activeMatch.playerA, activeMatch.playerB)]: matchDraft
      }
    });
    setActiveMatch(null);
  }

  function clearMatch(): void {
    if (!activeMatch) return;
    const matches = { ...state.matches };
    delete matches[matchKey(activeMatch.playerA, activeMatch.playerB)];
    commitState({ ...state, matches });
    setActiveMatch(null);
  }

  function openRoster(): void {
    setRosterDraft(
      state.players.map((name, originalIndex) => ({
        id: `existing-${originalIndex}`,
        originalIndex,
        name
      }))
    );
  }

  function saveRoster(): void {
    if (!rosterDraft) return;
    const names = rosterDraft.map((entry) => entry.name.trim());
    const invalidIndex = names.findIndex((name) => !name);
    if (invalidIndex !== -1) {
      window.alert(`Enter a name for player ${invalidIndex + 1}.`);
      return;
    }

    const retained = new Set(
      rosterDraft.flatMap((entry) =>
        entry.originalIndex === null ? [] : [entry.originalIndex]
      )
    );
    const removed = state.players
      .map((_, index) => index)
      .filter((index) => !retained.has(index));
    const removedWithGames = removed.filter((index) =>
      playerHasRecordedGames(state, index)
    );

    if (removedWithGames.length) {
      const removedNames = removedWithGames
        .map((index) => state.players[index])
        .join(", ");
      if (
        !window.confirm(
          `Remove ${removedNames} and discard all of their recorded matchups?`
        )
      ) {
        openRoster();
        return;
      }
    }

    const oldToNew = new Map<number, number>();
    rosterDraft.forEach((entry, newIndex) => {
      if (entry.originalIndex !== null) {
        oldToNew.set(entry.originalIndex, newIndex);
      }
    });

    const matches: TournamentState["matches"] = {};
    for (const [key, games] of Object.entries(state.matches)) {
      const [oldPlayerA, oldPlayerB] = parseMatchKey(key);
      const newPlayerA = oldToNew.get(oldPlayerA);
      const newPlayerB = oldToNew.get(oldPlayerB);
      if (newPlayerA === undefined || newPlayerB === undefined) continue;
      matches[matchKey(newPlayerA, newPlayerB)] = games;
    }

    commitState({ players: names, matches });
    setRosterDraft(null);
  }

  function exportTournament(): void {
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`heroes3-tournament-${date}.json`, {
      version: 3,
      exportedAt: new Date().toISOString(),
      tournament: state
    });
  }

  async function importTournament(
    event: ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const parsed = await readJsonFile(file);
      const candidate =
        isRecord(parsed) && "tournament" in parsed
          ? parsed.tournament
          : parsed;
      const imported = parseTournamentState(candidate);
      if (
        !window.confirm(
          "Replace the current names and results with this imported tournament?"
        )
      ) {
        return;
      }
      commitState(imported);
      window.alert("Tournament imported successfully.");
    } catch (error) {
      window.alert(`Could not import this file: ${getValidationMessage(error)}`);
    }
  }

  function resetResults(): void {
    if (!window.confirm("Clear every recorded game? Player names will be kept.")) {
      return;
    }
    commitState({ ...state, matches: {} });
  }

  return (
    <Layout
      activePage="tournament"
      title="Tournament Ledger"
      subtitle="Every hero faces every rival in five battles."
      actions={
        <>
          <button className="button" type="button" onClick={openRoster}>
            Edit players
          </button>
          <button className="button" type="button" onClick={exportTournament}>
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
            onChange={(event) => void importTournament(event)}
            hidden
          />
          <button
            className="button button-danger"
            type="button"
            onClick={resetResults}
          >
            Reset results
          </button>
        </>
      }
    >
      <section className="summary-bar" aria-label="Tournament progress">
        <div>
          <span className="summary-label">Battles recorded</span>
          <strong>{completedGames} / {maximumGames}</strong>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span
            style={{
              width: `${maximumGames ? (completedGames / maximumGames) * 100 : 0}%`
            }}
          />
        </div>
        <div>
          <span className="summary-label">Current leader</span>
          <strong>
            {leaders.length ? `${leaders.join(", ")} (${bestWins})` : "No battles yet"}
          </strong>
        </div>
      </section>

      <section className="panel">
        <SectionHeading
          eyebrow="Head-to-head"
          title="Battle grid"
          description="Choose any matchup to record its five games."
        />
        <TournamentGrid
          state={state}
          playerTotals={playerTotals}
          onOpenMatch={openMatch}
        />
        <div className="legend">
          <span><i className="legend-dot complete" /> Complete</span>
          <span><i className="legend-dot partial" /> In progress</span>
          <span><i className="legend-dot empty" /> Not started</span>
        </div>
      </section>

      <section className="panel">
        <SectionHeading
          eyebrow="Faction performance"
          title="Town statistics"
          description="Every completed game counts once for each town used."
        />
        <TownCards stats={townStats} />
      </section>

      <section className="panel">
        <SectionHeading
          eyebrow="Faction matchups"
          title="Town vs town"
          description="Each cell shows the row town’s wins–losses against the column town."
        />
        <TownMatchupTable stats={townMatchups} totals={townStats} />
      </section>

      <section className="panel">
        <SectionHeading
          eyebrow="Hero mastery"
          title="Player records by town"
          description="Each town column displays wins–losses."
        />
        <PlayerTownTable
          players={state.players}
          stats={playerTownStats}
          totals={playerTotals}
        />
      </section>

      {activeMatch && (
        <MatchEditor
          activeMatch={activeMatch}
          players={state.players}
          games={matchDraft}
          onChange={updateMatchGame}
          onClear={clearMatch}
          onCancel={() => setActiveMatch(null)}
          onSave={saveMatch}
        />
      )}

      {rosterDraft && (
        <RosterEditor
          entries={rosterDraft}
          onChange={setRosterDraft}
          onCancel={() => setRosterDraft(null)}
          onSave={saveRoster}
        />
      )}
    </Layout>
  );
}

interface PlayerTotal {
  wins: number;
  losses: number;
  games: number;
}

function getPlayerTotals(
  state: TournamentState,
  playerIndex: number
): PlayerTotal {
  let wins = 0;
  let losses = 0;
  for (const [key, games] of Object.entries(state.matches)) {
    const [playerA, playerB] = parseMatchKey(key);
    if (playerIndex !== playerA && playerIndex !== playerB) continue;
    for (const game of games) {
      if (!game.winner) continue;
      const playerWon =
        (playerIndex === playerA && game.winner === "A") ||
        (playerIndex === playerB && game.winner === "B");
      if (playerWon) wins += 1;
      else losses += 1;
    }
  }
  return { wins, losses, games: wins + losses };
}

function playerHasRecordedGames(
  state: TournamentState,
  playerIndex: number
): boolean {
  return Object.entries(state.matches).some(([key, games]) => {
    const [playerA, playerB] = parseMatchKey(key);
    return (
      (playerIndex === playerA || playerIndex === playerB) &&
      games.some((game) => Boolean(game.winner || game.townA || game.townB))
    );
  });
}

interface TournamentGridProps {
  state: TournamentState;
  playerTotals: PlayerTotal[];
  onOpenMatch: (playerA: number, playerB: number) => void;
}

function TournamentGrid({
  state,
  playerTotals,
  onOpenMatch
}: TournamentGridProps) {
  return (
    <div className="table-scroll">
      <table className="tournament-grid">
        <thead>
          <tr>
            <th className="corner-cell" scope="col">Player</th>
            {state.players.map((player, index) => (
              <th scope="col" key={`${index}-${player}`}>{player}</th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {state.players.map((player, rowIndex) => (
            <tr key={`${rowIndex}-${player}`}>
              <th className="row-heading" scope="row">{player}</th>
              {state.players.map((opponent, columnIndex) => {
                if (rowIndex === columnIndex) {
                  return (
                    <td
                      className="diagonal"
                      aria-label="Same player"
                      key={columnIndex}
                    >
                      —
                    </td>
                  );
                }
                const score = scoreForRow(state, rowIndex, columnIndex);
                const status =
                  score.completed === GAMES_PER_MATCH
                    ? "complete"
                    : score.completed
                      ? "partial"
                      : "empty";
                return (
                  <td className={`match-cell ${status}`} key={columnIndex}>
                    <button
                      type="button"
                      onClick={() => onOpenMatch(rowIndex, columnIndex)}
                      aria-label={`${player} versus ${opponent}: ${score.rowWins} to ${score.opponentWins}, ${score.completed} of ${GAMES_PER_MATCH} games recorded`}
                    >
                      <span className="match-score">
                        {score.rowWins}–{score.opponentWins}
                      </span>
                      <span className="match-progress">
                        {score.completed}/{GAMES_PER_MATCH} games
                      </span>
                    </button>
                  </td>
                );
              })}
              <td className="total-cell">
                <strong>{playerTotals[rowIndex]?.wins ?? 0} wins</strong>
                <span>{playerTotals[rowIndex]?.games ?? 0} played</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function scoreForRow(
  state: TournamentState,
  rowIndex: number,
  columnIndex: number
) {
  const games =
    state.matches[matchKey(rowIndex, columnIndex)] ?? createEmptyMatch();
  const rowIsA = rowIndex === Math.min(rowIndex, columnIndex);
  let rowWins = 0;
  let opponentWins = 0;
  let completed = 0;
  for (const game of games) {
    if (!game.winner) continue;
    completed += 1;
    const rowWon =
      (rowIsA && game.winner === "A") ||
      (!rowIsA && game.winner === "B");
    if (rowWon) rowWins += 1;
    else opponentWins += 1;
  }
  return { rowWins, opponentWins, completed };
}

interface MatchEditorProps {
  activeMatch: ActiveMatch;
  players: string[];
  games: TournamentGame[];
  onChange: (
    index: number,
    field: keyof TournamentGame,
    value: TownName | "" | TournamentWinner
  ) => void;
  onClear: () => void;
  onCancel: () => void;
  onSave: () => void;
}

function MatchEditor({
  activeMatch,
  players,
  games,
  onChange,
  onClear,
  onCancel,
  onSave
}: MatchEditorProps) {
  useEscapeKey(onCancel);
  const playerAName = players[activeMatch.playerA] ?? "Player A";
  const playerBName = players[activeMatch.playerB] ?? "Player B";
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog match-dialog" role="dialog" aria-modal="true">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Five-game series</p>
            <h2>{playerAName} vs {playerBName}</h2>
          </div>
          <button className="icon-button" aria-label="Close" type="button" onClick={onCancel}>
            ×
          </button>
        </div>
        <div className="game-editors">
          {games.map((game, index) => (
            <div className="game-editor" key={index}>
              <span className="game-number">Game {index + 1}</span>
              <TownPicker
                label={`${playerAName} town for game ${index + 1}`}
                value={game.townA}
                onChange={(value) => onChange(index, "townA", value)}
              />
              <span className="versus">vs</span>
              <TownPicker
                label={`${playerBName} town for game ${index + 1}`}
                value={game.townB}
                onChange={(value) => onChange(index, "townB", value)}
              />
              <div className="winner-picker">
                <label htmlFor={`winner-${index}`}>Winner</label>
                <select
                  id={`winner-${index}`}
                  value={game.winner ?? ""}
                  onChange={(event) =>
                    onChange(
                      index,
                      "winner",
                      event.target.value
                        ? event.target.value as Exclude<TournamentWinner, null>
                        : null
                    )
                  }
                >
                  <option value="">Not played</option>
                  <option value="A">{playerAName}</option>
                  <option value="B">{playerBName}</option>
                </select>
              </div>
            </div>
          ))}
        </div>
        <div className="dialog-actions">
          <button className="button button-quiet" type="button" onClick={onClear}>
            Clear matchup
          </button>
          <button className="button button-quiet" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="button button-primary" type="button" onClick={onSave}>
            Save battles
          </button>
        </div>
      </div>
    </div>
  );
}

interface TownPickerProps {
  label: string;
  value: TownName | "";
  onChange: (town: TownName | "") => void;
}

function TownPicker({ label, value, onChange }: TownPickerProps) {
  const town = TOWNS.find((item) => item.name === value);
  return (
    <div className="town-picker">
      {town ? (
        <img className="town-icon" src={town.image} alt={town.name} />
      ) : (
        <span className="town-icon" aria-hidden="true" />
      )}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as TownName | "")}
      >
        <option value="">Choose town</option>
        {TOWNS.map((item) => (
          <option value={item.name} key={item.name}>{item.name}</option>
        ))}
      </select>
    </div>
  );
}

interface RosterEditorProps {
  entries: RosterEntry[];
  onChange: (entries: RosterEntry[]) => void;
  onCancel: () => void;
  onSave: () => void;
}

function RosterEditor({
  entries,
  onChange,
  onCancel,
  onSave
}: RosterEditorProps) {
  useEscapeKey(onCancel);
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog players-dialog" role="dialog" aria-modal="true">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Tournament roster</p>
            <h2>Edit players</h2>
          </div>
          <button className="icon-button" aria-label="Close" type="button" onClick={onCancel}>
            ×
          </button>
        </div>
        <div className="player-inputs">
          {entries.map((entry, index) => (
            <div className="player-entry" key={entry.id}>
              <label>
                <span>Player {index + 1}</span>
                <input
                  value={entry.name}
                  maxLength={30}
                  required
                  onChange={(event) =>
                    onChange(
                      entries.map((item) =>
                        item.id === entry.id
                          ? { ...item, name: event.target.value }
                          : item
                      )
                    )
                  }
                />
              </label>
              <button
                className="button button-quiet remove-player-button"
                type="button"
                disabled={entries.length <= MIN_PLAYER_COUNT}
                onClick={() =>
                  onChange(entries.filter((item) => item.id !== entry.id))
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="dialog-actions">
          <button
            className="button button-quiet"
            type="button"
            onClick={() =>
              onChange([
                ...entries,
                {
                  id: crypto.randomUUID(),
                  originalIndex: null,
                  name: `Player ${entries.length + 1}`
                }
              ])
            }
          >
            Add player
          </button>
          <button className="button button-quiet" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="button button-primary" type="button" onClick={onSave}>
            Save roster
          </button>
        </div>
      </div>
    </div>
  );
}

interface PlayerTownTableProps {
  players: string[];
  stats: ReturnType<typeof emptyWinLossByTown>[];
  totals: PlayerTotal[];
}

function PlayerTownTable({
  players,
  stats,
  totals
}: PlayerTownTableProps) {
  return (
    <div className="table-scroll">
      <table className="stats-table">
        <thead>
          <tr>
            <th scope="col">Player</th>
            {TOWNS.map((town) => (
              <th className="stats-town-heading" scope="col" key={town.name}>
                <img src={town.image} alt="" />
                {town.name}
              </th>
            ))}
            <th scope="col">Overall</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, playerIndex) => (
            <tr key={`${playerIndex}-${player}`}>
              <th scope="row">{player}</th>
              {TOWNS.map((town) => {
                const record = stats[playerIndex]?.[town.name] ?? {
                  wins: 0,
                  losses: 0
                };
                return (
                  <td key={town.name}>
                    <span className="record-wins">{record.wins}</span>
                    –
                    <span className="record-losses">{record.losses}</span>
                  </td>
                );
              })}
              <td>
                <span className="record-wins">{totals[playerIndex]?.wins ?? 0}</span>
                –
                <span className="record-losses">{totals[playerIndex]?.losses ?? 0}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onEscape]);
}
