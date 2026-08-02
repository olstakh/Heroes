const CASUAL_STORAGE_KEY = "heroes3-casual-game-log-v1";
const towns = window.HEROES_TOWNS;
const validTownNames = new Set(towns.map((town) => town.name));

let casualGames = loadCasualGames();

const gameForm = document.querySelector("#casualGameForm");
const gameIdInput = document.querySelector("#casualGameId");
const dateInput = document.querySelector("#casualDate");
const opponentInput = document.querySelector("#casualOpponent");
const playerTownInput = document.querySelector("#casualPlayerTown");
const opponentTownInput = document.querySelector("#casualOpponentTown");
const resultInput = document.querySelector("#casualResult");
const notesInput = document.querySelector("#casualNotes");
const cancelEditButton = document.querySelector("#cancelCasualEdit");
const importFileInput = document.querySelector("#importCasualFile");

initializeTownSelects();
resetGameForm();
renderCasualPage();

gameForm.addEventListener("submit", saveCasualGame);
cancelEditButton.addEventListener("click", resetGameForm);
document.querySelector("#casualHistory").addEventListener("click", handleHistoryAction);
document.querySelector("#exportCasualButton").addEventListener("click", exportCasualGames);
document.querySelector("#importCasualButton").addEventListener("click", () => importFileInput.click());
document.querySelector("#resetCasualButton").addEventListener("click", resetCasualGames);
importFileInput.addEventListener("change", importCasualGames);

function initializeTownSelects() {
  const options = [
    '<option value="">Choose town</option>',
    ...towns.map((town) => `<option value="${town.name}">${town.name}</option>`)
  ].join("");
  playerTownInput.innerHTML = options;
  opponentTownInput.innerHTML = options;
}

function loadCasualGames() {
  try {
    const saved = JSON.parse(localStorage.getItem(CASUAL_STORAGE_KEY));
    if (Array.isArray(saved)) return validateCasualGames(saved);
  } catch (error) {
    console.warn("Could not load casual game data.", error);
  }
  return [];
}

function saveCasualState() {
  localStorage.setItem(CASUAL_STORAGE_KEY, JSON.stringify(casualGames));
}

function saveCasualGame(event) {
  event.preventDefault();
  const game = {
    id: gameIdInput.value || createGameId(),
    playedAt: dateInput.value,
    opponent: opponentInput.value.trim(),
    playerTown: playerTownInput.value,
    opponentTown: opponentTownInput.value,
    result: resultInput.value,
    notes: notesInput.value.trim(),
    createdAt: new Date().toISOString()
  };

  if (gameIdInput.value) {
    const existingIndex = casualGames.findIndex((item) => item.id === gameIdInput.value);
    if (existingIndex === -1) {
      window.alert("This game no longer exists.");
      resetGameForm();
      return;
    }
    game.createdAt = casualGames[existingIndex].createdAt;
    casualGames[existingIndex] = game;
  } else {
    casualGames.push(game);
  }

  saveCasualState();
  resetGameForm();
  renderCasualPage();
}

function createGameId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resetGameForm() {
  gameForm.reset();
  gameIdInput.value = "";
  dateInput.value = new Date().toISOString().slice(0, 10);
  document.querySelector("#casualFormTitle").textContent = "Add casual game";
  cancelEditButton.hidden = true;
}

function editCasualGame(gameId) {
  const game = casualGames.find((item) => item.id === gameId);
  if (!game) return;
  gameIdInput.value = game.id;
  dateInput.value = game.playedAt;
  opponentInput.value = game.opponent;
  playerTownInput.value = game.playerTown;
  opponentTownInput.value = game.opponentTown;
  resultInput.value = game.result;
  notesInput.value = game.notes;
  document.querySelector("#casualFormTitle").textContent = "Edit casual game";
  cancelEditButton.hidden = false;
  gameForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function handleHistoryAction(event) {
  const button = event.target.closest("[data-game-action]");
  if (!button) return;
  const { gameAction, gameId } = button.dataset;
  if (gameAction === "edit") {
    editCasualGame(gameId);
    return;
  }

  const game = casualGames.find((item) => item.id === gameId);
  if (!game || !window.confirm(`Remove the game against ${game.opponent || "Public lobby player"}?`)) {
    return;
  }
  casualGames = casualGames.filter((item) => item.id !== gameId);
  saveCasualState();
  if (gameIdInput.value === gameId) resetGameForm();
  renderCasualPage();
}

function renderCasualPage() {
  renderCasualSummary();
  renderTownCards("#personalTownStats", calculatePersonalTownStats());
  renderTownCards("#combinedTownStats", calculateCombinedTownStats());
  renderCasualTownMatchups();
  renderCasualHistory();
}

function emptyTownStats() {
  return Object.fromEntries(towns.map((town) => [
    town.name,
    { games: 0, wins: 0, losses: 0 }
  ]));
}

function calculatePersonalTownStats() {
  const stats = emptyTownStats();
  casualGames.forEach((game) => {
    const record = stats[game.playerTown];
    record.games += 1;
    record[game.result === "win" ? "wins" : "losses"] += 1;
  });
  return stats;
}

function calculateCombinedTownStats() {
  const stats = emptyTownStats();
  casualGames.forEach((game) => {
    const playerRecord = stats[game.playerTown];
    const opponentRecord = stats[game.opponentTown];
    playerRecord.games += 1;
    opponentRecord.games += 1;
    playerRecord[game.result === "win" ? "wins" : "losses"] += 1;
    opponentRecord[game.result === "win" ? "losses" : "wins"] += 1;
  });
  return stats;
}

function renderTownCards(selector, stats) {
  document.querySelector(selector).innerHTML = towns.map((town) => {
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

function calculateCasualTownMatchups() {
  const stats = Object.fromEntries(towns.map((rowTown) => [
    rowTown.name,
    Object.fromEntries(towns.map((columnTown) => [
      columnTown.name,
      { wins: 0, losses: 0 }
    ]))
  ]));

  casualGames.forEach((game) => {
    const playerWon = game.result === "win";
    stats[game.playerTown][game.opponentTown][playerWon ? "wins" : "losses"] += 1;
    stats[game.opponentTown][game.playerTown][playerWon ? "losses" : "wins"] += 1;
  });
  return stats;
}

function renderCasualTownMatchups() {
  const stats = calculateCasualTownMatchups();
  const totals = calculateCombinedTownStats();
  const headers = towns.map((town) => `
    <th class="stats-town-heading" scope="col">
      <img src="${town.image}" alt="">
      ${town.name}
    </th>`).join("");

  const rows = towns.map((rowTown) => {
    const cells = towns.map((columnTown) => {
      const record = stats[rowTown.name][columnTown.name];
      const mirrorClass = rowTown.name === columnTown.name ? "mirror-matchup" : "";
      return `
        <td class="${mirrorClass}">
          <span class="record-wins">${record.wins}</span>–<span class="record-losses">${record.losses}</span>
        </td>`;
    }).join("");
    const total = totals[rowTown.name];
    return `
      <tr>
        <th scope="row">
          <span class="town-row-label">
            <img src="${rowTown.image}" alt="">
            ${rowTown.name}
          </span>
        </th>
        ${cells}
        <td><span class="record-wins">${total.wins}</span>–<span class="record-losses">${total.losses}</span></td>
      </tr>`;
  }).join("");

  document.querySelector("#casualTownMatchups").innerHTML = `
    <thead>
      <tr>
        <th scope="col">Town</th>
        ${headers}
        <th scope="col">Overall</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>`;
}

function renderCasualSummary() {
  const wins = casualGames.filter((game) => game.result === "win").length;
  const losses = casualGames.length - wins;
  const personalStats = calculatePersonalTownStats();
  const mostPlayed = towns
    .map((town) => ({ name: town.name, games: personalStats[town.name].games }))
    .sort((left, right) => right.games - left.games)[0];

  document.querySelector("#casualGamesCount").textContent = casualGames.length;
  document.querySelector("#casualRecord").textContent = `${wins}–${losses}`;
  document.querySelector("#casualWinRate").textContent =
    casualGames.length ? `${Math.round((wins / casualGames.length) * 100)}%` : "0%";
  document.querySelector("#favoriteTown").textContent =
    mostPlayed?.games ? `${mostPlayed.name} (${mostPlayed.games})` : "No games yet";
}

function renderCasualHistory() {
  const history = document.querySelector("#casualHistory");
  if (!casualGames.length) {
    history.innerHTML = `
      <tr>
        <td class="empty-state" colspan="6">No casual games recorded yet.</td>
      </tr>`;
    return;
  }

  const sortedGames = [...casualGames].sort((left, right) =>
    right.playedAt.localeCompare(left.playedAt) || right.createdAt.localeCompare(left.createdAt)
  );
  history.innerHTML = sortedGames.map((game) => {
    const playerTown = towns.find((town) => town.name === game.playerTown);
    const opponentTown = towns.find((town) => town.name === game.opponentTown);
    return `
      <tr>
        <td>${formatDate(game.playedAt)}</td>
        <td>${escapeHtml(game.opponent || "Public lobby player")}</td>
        <td>
          <span class="history-matchup">
            <img src="${playerTown.image}" alt="">
            ${playerTown.name}
            <span>vs</span>
            <img src="${opponentTown.image}" alt="">
            ${opponentTown.name}
          </span>
        </td>
        <td><span class="result-pill ${game.result}">${game.result === "win" ? "Win" : "Loss"}</span></td>
        <td class="history-notes">${escapeHtml(game.notes || "—")}</td>
        <td>
          <span class="history-actions">
            <button class="button button-quiet" type="button" data-game-action="edit" data-game-id="${game.id}">Edit</button>
            <button class="button button-quiet history-delete" type="button" data-game-action="delete" data-game-id="${game.id}">Delete</button>
          </span>
        </td>
      </tr>`;
  }).join("");
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00Z`));
}

function exportCasualGames() {
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    casualGames
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `heroes3-casual-games-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
}

async function importCasualGames(event) {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    const importedGames = validateCasualGames(parsed?.casualGames ?? parsed);
    if (!window.confirm(`Replace the current history with ${importedGames.length} imported games?`)) {
      return;
    }
    casualGames = importedGames;
    saveCasualState();
    resetGameForm();
    renderCasualPage();
    window.alert("Casual game history imported successfully.");
  } catch (error) {
    window.alert(`Could not import this file: ${error.message}`);
  }
}

function validateCasualGames(games) {
  if (!Array.isArray(games)) {
    throw new Error("the file does not contain a casual game list.");
  }

  const seenIds = new Set();
  return games.map((game, index) => {
    if (!game || typeof game !== "object" || Array.isArray(game)) {
      throw new Error(`game ${index + 1} is invalid.`);
    }
    if (
      typeof game.playedAt !== "string" ||
      !isValidDateString(game.playedAt) ||
      !validTownNames.has(game.playerTown) ||
      !validTownNames.has(game.opponentTown) ||
      !["win", "loss"].includes(game.result)
    ) {
      throw new Error(`game ${index + 1} has invalid date, towns, or result.`);
    }

    const opponent = typeof game.opponent === "string" ? game.opponent.trim() : "";
    const notes = typeof game.notes === "string" ? game.notes.trim() : "";
    if (opponent.length > 60 || notes.length > 500) {
      throw new Error(`game ${index + 1} contains text that is too long.`);
    }

    let id = typeof game.id === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(game.id)
      ? game.id
      : createGameId();
    while (seenIds.has(id)) id = createGameId();
    seenIds.add(id);

    const createdAt = typeof game.createdAt === "string" && !Number.isNaN(Date.parse(game.createdAt))
      ? game.createdAt
      : new Date().toISOString();

    return {
      id,
      playedAt: game.playedAt,
      opponent,
      playerTown: game.playerTown,
      opponentTown: game.opponentTown,
      result: game.result,
      notes,
      createdAt
    };
  });
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function resetCasualGames() {
  if (!casualGames.length || !window.confirm("Clear every recorded casual game?")) return;
  casualGames = [];
  saveCasualState();
  resetGameForm();
  renderCasualPage();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
