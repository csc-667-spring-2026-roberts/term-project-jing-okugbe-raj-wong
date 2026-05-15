"use strict";
(() => {
  // src/client/game.ts
  var BOARD_SIZE = 15;
  var main = document.querySelector("main[data-game-id]");
  var gameId = main?.dataset.gameId;
  var currentUserId = main?.dataset.currentUserId ? Number(main.dataset.currentUserId) : null;
  var statusMessage = document.querySelector("#status-message");
  var gameStatus = document.querySelector("#game-status");
  var tilesRemaining = document.querySelector("#tiles-remaining");
  var turnIndicator = document.querySelector("#turn-indicator");
  var playersList = document.querySelector("#players-list");
  var boardGrid = document.querySelector("#board-grid");
  var rackContainer = document.querySelector("#rack");
  var submitBtn = document.querySelector("#submit-word");
  var clearBtn = document.querySelector("#clear-placements");
  var passBtn = document.querySelector("#pass-turn");
  var selectedRackTileId = null;
  var pendingPlacements = [];
  var currentRack = [];
  var currentGame = null;
  function setStatus(message) {
    if (statusMessage) statusMessage.textContent = message;
  }
  function renderPlayers(players) {
    if (!playersList) return;
    playersList.replaceChildren();
    for (const player of players) {
      const li = document.createElement("li");
      li.dataset.userId = String(player.user_id);
      const isTurn = currentGame?.current_turn_user_id === player.user_id;
      li.textContent = `${isTurn ? "\u25B6 " : ""}${player.email} \u2014 ${String(player.score)} pts`;
      playersList.appendChild(li);
    }
  }
  function renderBoard(board) {
    if (!boardGrid) return;
    boardGrid.replaceChildren();
    const occupied = /* @__PURE__ */ new Map();
    for (const tile of board) {
      occupied.set(`${String(tile.row)},${String(tile.col)}`, tile);
    }
    const pending = /* @__PURE__ */ new Map();
    for (const p of pendingPlacements) {
      pending.set(`${String(p.row)},${String(p.col)}`, p);
    }
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = document.createElement("div");
        cell.className = "board-cell";
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        const key = `${String(row)},${String(col)}`;
        const existingTile = occupied.get(key);
        const pendingTile = pending.get(key);
        if (existingTile) {
          cell.classList.add("occupied");
          const letter = document.createElement("span");
          letter.className = "cell-letter";
          letter.textContent = existingTile.letter;
          const score = document.createElement("span");
          score.className = "cell-score";
          score.textContent = String(existingTile.score);
          cell.append(letter, score);
        } else if (pendingTile) {
          cell.classList.add("pending");
          const letter = document.createElement("span");
          letter.className = "cell-letter";
          letter.textContent = pendingTile.letter;
          const score = document.createElement("span");
          score.className = "cell-score";
          score.textContent = String(pendingTile.score);
          cell.append(letter, score);
          cell.addEventListener("click", () => {
            removePending(row, col);
          });
        } else {
          if (row === 7 && col === 7) cell.classList.add("center");
          cell.addEventListener("click", () => {
            handleBoardClick(row, col);
          });
        }
        boardGrid.appendChild(cell);
      }
    }
  }
  function renderRack(rack, game) {
    if (!rackContainer) return;
    rackContainer.replaceChildren();
    const isMyTurn = game.current_turn_user_id === currentUserId;
    const placedIds = new Set(pendingPlacements.map((p) => p.player_tile_id));
    for (const tile of rack) {
      if (placedIds.has(tile.id)) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rack-tile";
      if (selectedRackTileId === tile.id) button.classList.add("selected");
      button.dataset.playerTileId = String(tile.id);
      button.disabled = !isMyTurn;
      const letter = document.createElement("strong");
      letter.textContent = tile.letter;
      const score = document.createElement("small");
      score.textContent = ` (${String(tile.score)})`;
      button.append(letter, score);
      button.addEventListener("click", () => {
        selectedRackTileId = selectedRackTileId === tile.id ? null : tile.id;
        renderRack(currentRack, currentGame);
      });
      rackContainer.appendChild(button);
    }
  }
  function handleBoardClick(row, col) {
    if (selectedRackTileId === null) return;
    if (!currentGame || currentGame.current_turn_user_id !== currentUserId) return;
    const tile = currentRack.find((t) => t.id === selectedRackTileId);
    if (!tile) return;
    if (currentGame.board.some((t) => t.row === row && t.col === col)) return;
    if (pendingPlacements.some((p) => p.row === row && p.col === col)) return;
    pendingPlacements.push({
      player_tile_id: tile.id,
      letter: tile.letter,
      score: tile.score,
      row,
      col
    });
    selectedRackTileId = null;
    renderBoard(currentGame.board);
    renderRack(currentRack, currentGame);
    updateActionButtons();
  }
  function removePending(row, col) {
    pendingPlacements = pendingPlacements.filter((p) => !(p.row === row && p.col === col));
    if (currentGame) {
      renderBoard(currentGame.board);
      renderRack(currentRack, currentGame);
    }
    updateActionButtons();
  }
  function updateActionButtons() {
    const isMyTurn = currentGame?.current_turn_user_id === currentUserId;
    if (submitBtn) submitBtn.disabled = !isMyTurn || pendingPlacements.length === 0;
    if (clearBtn) clearBtn.disabled = pendingPlacements.length === 0;
    if (passBtn) passBtn.disabled = !isMyTurn;
  }
  function renderGame(game, rack) {
    currentGame = game;
    currentRack = rack;
    if (gameStatus) gameStatus.textContent = game.status;
    if (tilesRemaining) tilesRemaining.textContent = String(game.tiles_remaining);
    if (turnIndicator) {
      const turnPlayer = game.players.find((p) => p.user_id === game.current_turn_user_id);
      turnIndicator.textContent = turnPlayer ? turnPlayer.email : "\u2014";
    }
    renderPlayers(game.players);
    renderBoard(game.board);
    renderRack(rack, game);
    updateActionButtons();
    setStatus(game.current_turn_user_id === currentUserId ? "Your turn!" : "Waiting for opponent...");
  }
  async function loadGameState() {
    if (!gameId) return;
    const response = await fetch(`/games/${gameId}/state`);
    const data = await response.json();
    if (!response.ok || !data.ok || !data.game) {
      setStatus(data.error ?? "Failed to load game state.");
      return;
    }
    renderGame(data.game, data.rack ?? []);
  }
  async function submitWord() {
    if (!gameId || pendingPlacements.length === 0) return;
    setStatus("Submitting word...");
    const placements = pendingPlacements.map((p) => ({
      player_tile_id: p.player_tile_id,
      row: p.row,
      col: p.col
    }));
    const response = await fetch(`/games/${gameId}/play`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placements })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setStatus(data.error ?? "Failed to play word.");
      return;
    }
    pendingPlacements = [];
    selectedRackTileId = null;
    await loadGameState();
  }
  async function doPassTurn() {
    if (!gameId) return;
    setStatus("Passing turn...");
    const response = await fetch(`/games/${gameId}/pass`, { method: "POST" });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setStatus(data.error ?? "Failed to pass turn.");
      return;
    }
    pendingPlacements = [];
    selectedRackTileId = null;
    await loadGameState();
  }
  function clearPlacements() {
    pendingPlacements = [];
    selectedRackTileId = null;
    if (currentGame) {
      renderBoard(currentGame.board);
      renderRack(currentRack, currentGame);
    }
    updateActionButtons();
  }
  function connectToSse() {
    if (!gameId) return;
    const source = new EventSource(`/api/sse?room=${encodeURIComponent(`game-${gameId}`)}`);
    source.addEventListener("open", () => {
      setStatus("Connected. Waiting for updates...");
    });
    source.addEventListener("game:updated", () => {
      pendingPlacements = [];
      selectedRackTileId = null;
      void loadGameState();
    });
    source.onerror = () => {
      setStatus("Connection lost. Reconnecting...");
    };
    window.addEventListener("beforeunload", () => {
      source.close();
    });
  }
  function setupControls() {
    submitBtn?.addEventListener("click", () => void submitWord());
    clearBtn?.addEventListener("click", clearPlacements);
    passBtn?.addEventListener("click", () => void doPassTurn());
  }
  async function init() {
    setupControls();
    await loadGameState();
    connectToSse();
  }
  void init();
})();
//# sourceMappingURL=game.js.map
