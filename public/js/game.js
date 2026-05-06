"use strict";
(() => {
  // src/client/game.ts
  var main = document.querySelector("main[data-game-id]");
  var gameId = main?.dataset.gameId;
  var currentUserId = main?.dataset.currentUserId ? Number(main.dataset.currentUserId) : null;
  var statusMessage = document.querySelector("#status-message");
  var gameStatus = document.querySelector("#game-status");
  var tilesRemaining = document.querySelector("#tiles-remaining");
  var turnIndicator = document.querySelector("#turn-indicator");
  var playersList = document.querySelector("#players-list");
  var boardList = document.querySelector("#board-list");
  var rackContainer = document.querySelector("#rack");
  function setStatus(message) {
    if (statusMessage) {
      statusMessage.textContent = message;
    }
  }
  function renderPlayers(players) {
    if (!playersList) {
      return;
    }
    playersList.replaceChildren();
    for (const player of players) {
      const li = document.createElement("li");
      li.dataset.userId = String(player.user_id);
      li.textContent = `${player.email} \u2014 score: ${String(player.score)}`;
      playersList.appendChild(li);
    }
  }
  function renderBoard(board) {
    if (!boardList) {
      return;
    }
    boardList.replaceChildren();
    if (board.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No tiles played yet.";
      boardList.appendChild(li);
      return;
    }
    for (const tile of board) {
      const li = document.createElement("li");
      li.textContent = `(${String(tile.row)}, ${String(tile.col)}) ${tile.letter} (${String(tile.score)})`;
      boardList.appendChild(li);
    }
  }
  function renderRack(rack, game) {
    if (!rackContainer) {
      return;
    }
    rackContainer.replaceChildren();
    if (rack.length === 0) {
      const message = document.createElement("p");
      message.textContent = "No tiles in your rack yet.";
      rackContainer.appendChild(message);
      return;
    }
    const isMyTurn = game.current_turn_user_id === currentUserId;
    for (const tile of rack) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rack-tile";
      button.dataset.playerTileId = String(tile.id);
      button.disabled = !isMyTurn;
      const letter = document.createElement("strong");
      letter.textContent = tile.letter;
      const score = document.createElement("small");
      score.textContent = ` (${String(tile.score)})`;
      button.append(letter, score);
      rackContainer.appendChild(button);
    }
  }
  function renderGame(game, rack) {
    if (gameStatus) {
      gameStatus.textContent = game.status;
    }
    if (tilesRemaining) {
      tilesRemaining.textContent = String(game.tiles_remaining);
    }
    if (turnIndicator) {
      turnIndicator.textContent = game.current_turn_user_id === null ? "\u2014" : String(game.current_turn_user_id);
    }
    renderPlayers(game.players);
    renderBoard(game.board);
    renderRack(rack, game);
    setStatus("Live game state updated.");
  }
  async function loadGameState() {
    if (!gameId) {
      return;
    }
    const response = await fetch(`/games/${gameId}/state`);
    const data = await response.json();
    if (!response.ok || !data.ok || !data.game) {
      setStatus(data.error ?? "Failed to load game state.");
      return;
    }
    renderGame(data.game, data.rack ?? []);
  }
  async function playTile(playerTileId) {
    if (!gameId) {
      return;
    }
    setStatus("Playing tile...");
    const body = new URLSearchParams();
    body.set("player_tile_id", playerTileId);
    const response = await fetch(`/games/${gameId}/play`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setStatus(data.error ?? "Failed to play tile.");
      return;
    }
    await loadGameState();
  }
  function connectToSse() {
    if (!gameId) {
      return;
    }
    const source = new EventSource(`/api/sse?room=${encodeURIComponent(`game-${gameId}`)}`);
    source.addEventListener("open", () => {
      setStatus("SSE connected. Waiting for game updates...");
    });
    source.addEventListener("game:updated", () => {
      void loadGameState();
    });
    source.onerror = () => {
      setStatus("SSE disconnected. Browser will retry automatically.");
    };
    window.addEventListener("beforeunload", () => {
      source.close();
    });
  }
  function setupRackClickHandler() {
    if (!rackContainer) {
      return;
    }
    rackContainer.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const button = target.closest(".rack-tile");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const playerTileId = button.dataset.playerTileId;
      if (!playerTileId || button.disabled) {
        return;
      }
      void playTile(playerTileId);
    });
  }
  async function init() {
    setupRackClickHandler();
    await loadGameState();
    connectToSse();
  }
  void init();
})();
//# sourceMappingURL=game.js.map
