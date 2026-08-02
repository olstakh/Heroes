const DEFAULT_PLAYER_COUNT = 9;
const MIN_PLAYER_COUNT = 2;
const GAMES_PER_MATCH = 5;
const STORAGE_KEY = "heroes3-tournament-ledger-v1";

const towns = [
  "Bulwark",
  "Castle",
  "Conflux",
  "Cove",
  "Dungeon",
  "Factory",
  "Fortress",
  "Inferno",
  "Necropolis",
  "Rampart",
  "Stronghold",
  "Tower"
].map((name) => ({
  name,
  image: `Towns/Town_portrait_${name}_small.png`
}));

const defaultState = () => ({
  players: Array.from({ length: DEFAULT_PLAYER_COUNT }, (_, index) => `Player ${index + 1}`),
  matches: {}
});

let state = loadState();
let activeMatch = null;

const grid = document.querySelector("#tournamentGrid");
const townStatsContainer = document.querySelector("#townStats");
const playerTownStats = document.querySelector("#playerTownStats");
const recordedGames = document.querySelector("#recordedGames");
const progressBar = document.querySelector("#progressBar");
const leaderName = document.querySelector("#leaderName");
const matchDialog = document.querySelector("#matchDialog");
const matchForm = document.querySelector("#matchForm");
const matchTitle = document.querySelector("#matchTitle");
const gameEditors = document.querySelector("#gameEditors");
const playersDialog = document.querySelector("#playersDialog");
const playersForm = document.querySelector("#playersForm");
const playerInputs = document.querySelector("#playerInputs");
const importFileInput = document.querySelector("#importFileInput");

document.querySelector("#editPlayersButton").addEventListener("click", openPlayersDialog);
document.querySelector("#addPlayerButton").addEventListener("click", addPlayerInput);
playerInputs.addEventListener("click", removePlayerInput);
document.querySelector("#exportButton").addEventListener("click", exportTournament);
document.querySelector("#importButton").addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", importTournament);
document.querySelector("#resetButton").addEventListener("click", resetResults);
document.querySelector("#clearMatchButton").addEventListener("click", clearActiveMatch);
matchForm.addEventListener("submit", saveActiveMatch);
playersForm.addEventListener("submit", savePlayerNames);

render();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (
      saved &&
      Array.isArray(saved.players) &&
      saved.players.length >= MIN_PLAYER_COUNT &&
      saved.matches &&
      typeof saved.matches === "object" &&
      !Array.isArray(saved.matches)
    ) {
      return saved;
    }
  } catch (error) {
    console.warn("Could not load saved tournament data.", error);
  }

  return defaultState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  renderGrid();
  renderTownStats();
  renderPlayerTownStats();
  renderSummary();
}

function matchKey(playerA, playerB) {
  return [Math.min(playerA, playerB), Math.max(playerA, playerB)].join("-");
}

function emptyGames() {
  return Array.from({ length: GAMES_PER_MATCH }, () => ({
    townA: "",
    townB: "",
    winner: null
  }));
}

function getMatch(playerA, playerB) {
  return state.matches[matchKey(playerA, playerB)] || emptyGames();
}

function scoreForRow(rowIndex, columnIndex) {
  const games = getMatch(rowIndex, columnIndex);
  const lowerPlayer = Math.min(rowIndex, columnIndex);
  const rowIsA = rowIndex === lowerPlayer;
  let rowWins = 0;
  let opponentWins = 0;
  let completed = 0;

  games.forEach((game) => {
    if (!game.winner) return;
    completed += 1;
    const rowWon = (rowIsA && game.winner === "A") || (!rowIsA && game.winner === "B");
    if (rowWon) rowWins += 1;
    else opponentWins += 1;
  });

  return { rowWins, opponentWins, completed };
}

function renderGrid() {
  const headCells = state.players
    .map((name) => `<th scope="col">${escapeHtml(name)}</th>`)
    .join("");

  const rows = state.players.map((player, rowIndex) => {
    const matchCells = state.players.map((opponent, columnIndex) => {
      if (rowIndex === columnIndex) {
        return '<td class="diagonal" aria-label="Same player">—</td>';
      }

      const score = scoreForRow(rowIndex, columnIndex);
      const status = score.completed === GAMES_PER_MATCH
        ? "complete"
        : score.completed > 0
          ? "partial"
          : "empty";
      const label = `${player} versus ${opponent}: ${score.rowWins} to ${score.opponentWins}, ${score.completed} of ${GAMES_PER_MATCH} games recorded`;

      return `
        <td class="match-cell ${status}">
          <button type="button" data-player-a="${rowIndex}" data-player-b="${columnIndex}" aria-label="${escapeHtml(label)}">
            <span class="match-score">${score.rowWins}–${score.opponentWins}</span>
            <span class="match-progress">${score.completed}/${GAMES_PER_MATCH} games</span>
          </button>
        </td>`;
    }).join("");

    const total = getPlayerTotals(rowIndex);
    return `
      <tr>
        <th class="row-heading" scope="row">${escapeHtml(player)}</th>
        ${matchCells}
        <td class="total-cell">
          <strong>${total.wins} wins</strong>
          <span>${total.games} played</span>
        </td>
      </tr>`;
  }).join("");

  grid.innerHTML = `
    <thead>
      <tr>
        <th class="corner-cell" scope="col">Player</th>
        ${headCells}
        <th scope="col">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>`;

  grid.querySelectorAll("[data-player-a]").forEach((button) => {
    button.addEventListener("click", () => {
      openMatchDialog(
        Number(button.dataset.playerA),
        Number(button.dataset.playerB)
      );
    });
  });
}

function getPlayerTotals(playerIndex) {
  let wins = 0;
  let losses = 0;

  Object.entries(state.matches).forEach(([key, games]) => {
    const [playerA, playerB] = key.split("-").map(Number);
    if (playerIndex !== playerA && playerIndex !== playerB) return;

    games.forEach((game) => {
      if (!game.winner) return;
      const playerWon =
        (playerIndex === playerA && game.winner === "A") ||
        (playerIndex === playerB && game.winner === "B");
      if (playerWon) wins += 1;
      else losses += 1;
    });
  });

  return { wins, losses, games: wins + losses };
}

function openMatchDialog(playerOne, playerTwo) {
  const playerA = Math.min(playerOne, playerTwo);
  const playerB = Math.max(playerOne, playerTwo);
  activeMatch = { playerA, playerB };
  matchTitle.textContent = `${state.players[playerA]} vs ${state.players[playerB]}`;

  const games = getMatch(playerA, playerB);
  gameEditors.innerHTML = games.map((game, index) => gameEditorTemplate(game, index)).join("");
  gameEditors.querySelectorAll("select[data-town-select]").forEach((select) => {
    select.addEventListener("change", updateTownPreview);
  });

  matchDialog.showModal();
}

function gameEditorTemplate(game, index) {
  const townOptions = (selectedTown) => [
    '<option value="">Choose town</option>',
    ...towns.map((town) => `
      <option value="${town.name}" ${town.name === selectedTown ? "selected" : ""}>
        ${town.name}
      </option>`)
  ].join("");

  return `
    <div class="game-editor" data-game="${index}">
      <span class="game-number">Game ${index + 1}</span>
      <div class="town-picker">
        ${townPreview(game.townA)}
        <select name="townA-${index}" data-town-select data-preview="preview-a-${index}" aria-label="${escapeHtml(state.players[activeMatch.playerA])} town for game ${index + 1}">
          ${townOptions(game.townA)}
        </select>
      </div>
      <span class="versus">vs</span>
      <div class="town-picker">
        ${townPreview(game.townB, `preview-b-${index}`)}
        <select name="townB-${index}" data-town-select data-preview="preview-b-${index}" aria-label="${escapeHtml(state.players[activeMatch.playerB])} town for game ${index + 1}">
          ${townOptions(game.townB)}
        </select>
      </div>
      <div class="winner-picker">
        <label for="winner-${index}">Winner</label>
        <select id="winner-${index}" name="winner-${index}">
          <option value="" ${!game.winner ? "selected" : ""}>Not played</option>
          <option value="A" ${game.winner === "A" ? "selected" : ""}>${escapeHtml(state.players[activeMatch.playerA])}</option>
          <option value="B" ${game.winner === "B" ? "selected" : ""}>${escapeHtml(state.players[activeMatch.playerB])}</option>
        </select>
      </div>
    </div>`;
}

function townPreview(townName, id = "") {
  const town = towns.find((item) => item.name === townName);
  const attributes = id ? ` id="${id}"` : "";
  if (!town) {
    return `<span class="town-icon"${attributes} aria-hidden="true"></span>`;
  }
  return `<img class="town-icon"${attributes} src="${town.image}" alt="${town.name}">`;
}

function updateTownPreview(event) {
  const select = event.currentTarget;
  let preview = document.querySelector(`#${select.dataset.preview}`);

  if (!preview) {
    preview = select.parentElement.querySelector(".town-icon");
  }

  const town = towns.find((item) => item.name === select.value);
  if (town) {
    const image = document.createElement("img");
    image.className = "town-icon";
    if (preview.id) image.id = preview.id;
    image.src = town.image;
    image.alt = town.name;
    preview.replaceWith(image);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "town-icon";
    if (preview.id) placeholder.id = preview.id;
    placeholder.setAttribute("aria-hidden", "true");
    preview.replaceWith(placeholder);
  }
}

function saveActiveMatch(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel" || !activeMatch) {
    matchDialog.close();
    return;
  }

  const formData = new FormData(matchForm);
  const games = [];

  for (let index = 0; index < GAMES_PER_MATCH; index += 1) {
    const townA = formData.get(`townA-${index}`);
    const townB = formData.get(`townB-${index}`);
    const winner = formData.get(`winner-${index}`) || null;

    if (winner && (!townA || !townB)) {
      window.alert(`Choose both towns before recording a winner for game ${index + 1}.`);
      return;
    }

    games.push({ townA, townB, winner });
  }

  state.matches[matchKey(activeMatch.playerA, activeMatch.playerB)] = games;
  saveState();
  render();
  matchDialog.close();
}

function clearActiveMatch() {
  if (!activeMatch) return;
  delete state.matches[matchKey(activeMatch.playerA, activeMatch.playerB)];
  saveState();
  render();
  matchDialog.close();
}

function calculateTownStats() {
  const stats = Object.fromEntries(towns.map((town) => [
    town.name,
    { games: 0, wins: 0, losses: 0 }
  ]));

  Object.values(state.matches).forEach((games) => {
    games.forEach((game) => {
      if (!game.winner || !game.townA || !game.townB) return;
      stats[game.townA].games += 1;
      stats[game.townB].games += 1;

      if (game.winner === "A") {
        stats[game.townA].wins += 1;
        stats[game.townB].losses += 1;
      } else {
        stats[game.townB].wins += 1;
        stats[game.townA].losses += 1;
      }
    });
  });

  return stats;
}

function renderTownStats() {
  const stats = calculateTownStats();
  townStatsContainer.innerHTML = towns.map((town) => {
    const record = stats[town.name];
    const winRate = record.games ? Math.round((record.wins / record.games) * 100) : 0;
    return `
      <article class="town-card">
        <img src="${town.image}" alt="${town.name}">
        <div>
          <div class="town-name">${town.name}</div>
          <div class="town-numbers">
            <span>Played<strong>${record.games}</strong></span>
            <span>Wins<strong>${record.wins}</strong></span>
            <span>Losses<strong>${record.losses}</strong></span>
            <span>Win %<strong>${winRate}%</strong></span>
          </div>
        </div>
      </article>`;
  }).join("");
}

function calculatePlayerTownStats() {
  return state.players.map(() => Object.fromEntries(towns.map((town) => [
    town.name,
    { wins: 0, losses: 0 }
  ]))).map((stats, playerIndex) => {
    Object.entries(state.matches).forEach(([key, games]) => {
      const [playerA, playerB] = key.split("-").map(Number);
      if (playerIndex !== playerA && playerIndex !== playerB) return;

      games.forEach((game) => {
        if (!game.winner) return;
        const playerIsA = playerIndex === playerA;
        const town = playerIsA ? game.townA : game.townB;
        if (!town || !stats[town]) return;
        const won = (playerIsA && game.winner === "A") || (!playerIsA && game.winner === "B");
        stats[town][won ? "wins" : "losses"] += 1;
      });
    });
    return stats;
  });
}

function renderPlayerTownStats() {
  const stats = calculatePlayerTownStats();
  const townHeaders = towns.map((town) => `
    <th class="stats-town-heading" scope="col">
      <img src="${town.image}" alt="">
      ${town.name}
    </th>`).join("");

  const rows = state.players.map((player, playerIndex) => {
    const townRecords = towns.map((town) => {
      const record = stats[playerIndex][town.name];
      return `
        <td>
          <span class="record-wins">${record.wins}</span>–<span class="record-losses">${record.losses}</span>
        </td>`;
    }).join("");
    const total = getPlayerTotals(playerIndex);
    return `
      <tr>
        <th scope="row">${escapeHtml(player)}</th>
        ${townRecords}
        <td><span class="record-wins">${total.wins}</span>–<span class="record-losses">${total.losses}</span></td>
      </tr>`;
  }).join("");

  playerTownStats.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Player</th>
        ${townHeaders}
        <th scope="col">Overall</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>`;
}

function renderSummary() {
  const playerCount = state.players.length;
  const maximumGames = (playerCount * (playerCount - 1) / 2) * GAMES_PER_MATCH;
  const completedGames = Object.values(state.matches)
    .flat()
    .filter((game) => game.winner).length;
  recordedGames.textContent = `${completedGames} / ${maximumGames}`;
  progressBar.style.width = `${(completedGames / maximumGames) * 100}%`;

  const totals = state.players.map((name, index) => ({
    name,
    ...getPlayerTotals(index)
  }));
  const bestWins = Math.max(...totals.map((total) => total.wins));
  if (bestWins === 0) {
    leaderName.textContent = "No battles yet";
    return;
  }

  const leaders = totals.filter((total) => total.wins === bestWins);
  leaderName.textContent = `${leaders.map((leader) => leader.name).join(", ")} (${bestWins})`;
}

function openPlayersDialog() {
  populatePlayerInputs();
  playersDialog.showModal();
}

function populatePlayerInputs() {
  playerInputs.innerHTML = state.players
    .map((player, index) => playerInputTemplate(player, index))
    .join("");
  refreshPlayerEditor();
}

function playerInputTemplate(player, originalIndex = "") {
  return `
    <div class="player-entry" data-original-index="${originalIndex}">
      <label>
        <span class="player-number"></span>
        <input value="${escapeHtml(player)}" maxlength="30" required>
      </label>
      <button class="button button-quiet remove-player-button" type="button" data-remove-player>
        Remove
      </button>
    </div>`;
}

function addPlayerInput() {
  const nextNumber = playerInputs.querySelectorAll(".player-entry").length + 1;
  playerInputs.insertAdjacentHTML("beforeend", playerInputTemplate(`Player ${nextNumber}`));
  refreshPlayerEditor();
  playerInputs.lastElementChild.querySelector("input").focus();
}

function removePlayerInput(event) {
  const button = event.target.closest("[data-remove-player]");
  if (!button) return;
  button.closest(".player-entry").remove();
  refreshPlayerEditor();
}

function refreshPlayerEditor() {
  const entries = [...playerInputs.querySelectorAll(".player-entry")];
  entries.forEach((entry, index) => {
    entry.querySelector(".player-number").textContent = `Player ${index + 1}`;
    entry.querySelector("[data-remove-player]").disabled = entries.length <= MIN_PLAYER_COUNT;
  });
}

function savePlayerNames(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    playersDialog.close();
    return;
  }

  const entries = [...playerInputs.querySelectorAll(".player-entry")];
  const players = entries.map((entry) => entry.querySelector("input").value.trim());
  const invalidPlayerIndex = players.findIndex((player) => !player);
  if (invalidPlayerIndex !== -1) {
    window.alert(`Enter a name for player ${invalidPlayerIndex + 1}.`);
    entries[invalidPlayerIndex].querySelector("input").focus();
    return;
  }

  const retainedOriginalIndexes = new Set(
    entries
      .map((entry) => entry.dataset.originalIndex)
      .filter((index) => index !== "")
      .map(Number)
  );
  const removedIndexes = state.players
    .map((_, index) => index)
    .filter((index) => !retainedOriginalIndexes.has(index));

  if (removedIndexes.length && removedPlayersHaveMatches(removedIndexes)) {
    const removedNames = removedIndexes.map((index) => state.players[index]).join(", ");
    if (!window.confirm(`Remove ${removedNames} and discard all of their recorded matchups?`)) {
      populatePlayerInputs();
      return;
    }
  }

  const oldToNewIndex = new Map();
  entries.forEach((entry, newIndex) => {
    if (entry.dataset.originalIndex !== "") {
      oldToNewIndex.set(Number(entry.dataset.originalIndex), newIndex);
    }
  });

  const matches = {};
  Object.entries(state.matches).forEach(([key, games]) => {
    const [oldPlayerA, oldPlayerB] = key.split("-").map(Number);
    if (!oldToNewIndex.has(oldPlayerA) || !oldToNewIndex.has(oldPlayerB)) return;
    const newPlayerA = oldToNewIndex.get(oldPlayerA);
    const newPlayerB = oldToNewIndex.get(oldPlayerB);
    matches[matchKey(newPlayerA, newPlayerB)] = games;
  });

  state = { players, matches };
  saveState();
  render();
  playersDialog.close();
}

function removedPlayersHaveMatches(removedIndexes) {
  const removed = new Set(removedIndexes);
  return Object.entries(state.matches).some(([key, games]) => {
    const [playerA, playerB] = key.split("-").map(Number);
    return (
      (removed.has(playerA) || removed.has(playerB)) &&
      games.some((game) => game.winner || game.townA || game.townB)
    );
  });
}

function resetResults() {
  if (!window.confirm("Clear every recorded game? Player names will be kept.")) return;
  state.matches = {};
  saveState();
  render();
}

function exportTournament() {
  const exportData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    tournament: state
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json"
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = downloadUrl;
  link.download = `heroes3-tournament-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
}

async function importTournament(event) {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    const importedState = parsed?.tournament ?? parsed;
    const validatedState = validateImportedState(importedState);

    if (!window.confirm("Replace the current names and results with this imported tournament?")) {
      return;
    }

    state = validatedState;
    saveState();
    render();
    window.alert("Tournament imported successfully.");
  } catch (error) {
    window.alert(`Could not import this file: ${error.message}`);
  }
}

function validateImportedState(importedState) {
  if (!importedState || typeof importedState !== "object" || Array.isArray(importedState)) {
    throw new Error("the file does not contain tournament data.");
  }

  if (
    !Array.isArray(importedState.players) ||
    importedState.players.length < MIN_PLAYER_COUNT ||
    importedState.players.some((player) =>
      typeof player !== "string" || !player.trim() || player.length > 30
    )
  ) {
    throw new Error(`at least ${MIN_PLAYER_COUNT} valid player names are required.`);
  }

  if (
    !importedState.matches ||
    typeof importedState.matches !== "object" ||
    Array.isArray(importedState.matches)
  ) {
    throw new Error("the matchup data is missing or invalid.");
  }

  const validTownNames = new Set(towns.map((town) => town.name));
  const matches = {};

  for (const [key, games] of Object.entries(importedState.matches)) {
    const match = /^(\d+)-(\d+)$/.exec(key);
    const playerA = match ? Number(match[1]) : -1;
    const playerB = match ? Number(match[2]) : -1;
    if (
      !match ||
      playerA >= playerB ||
      playerA < 0 ||
      playerB >= importedState.players.length
    ) {
      throw new Error(`"${key}" is not a valid matchup.`);
    }
    if (!Array.isArray(games) || games.length !== GAMES_PER_MATCH) {
      throw new Error(`matchup "${key}" must contain exactly ${GAMES_PER_MATCH} games.`);
    }

    matches[key] = games.map((game, index) => {
      if (!game || typeof game !== "object" || Array.isArray(game)) {
        throw new Error(`game ${index + 1} in matchup "${key}" is invalid.`);
      }

      const townA = game.townA || "";
      const townB = game.townB || "";
      const winner = game.winner || null;
      if (
        (townA && !validTownNames.has(townA)) ||
        (townB && !validTownNames.has(townB)) ||
        ![null, "A", "B"].includes(winner) ||
        (winner && (!townA || !townB))
      ) {
        throw new Error(`game ${index + 1} in matchup "${key}" has invalid results.`);
      }

      return { townA, townB, winner };
    });
  }

  return {
    players: importedState.players.map((player) => player.trim()),
    matches
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
