"use strict";
(() => {
  // src/client/game.ts
  var main = document.querySelector("main[data-game-id]");
  var gameId = main?.dataset.gameId;
  var statusMessage = document.querySelector("#status-message");
  var gameStatus = document.querySelector("#game-status");
  var playersList = document.querySelector("#players-list");
  var playedTilesList = document.querySelector("#played-tiles-list");
  function setStatus(message) {
    if (statusMessage) {
      statusMessage.textContent = message;
    }
  }
  function renderList(list, items) {
    if (!list) {
      return;
    }
    list.replaceChildren();
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    }
  }
  function renderGame(game) {
    if (!game) {
      setStatus("Game state is not available yet.");
      return;
    }
    if (gameStatus) {
      gameStatus.textContent = game.status;
    }
    renderList(playersList, game.players);
    renderList(playedTilesList, game.playedTiles);
    setStatus("Live game state updated.");
  }
  async function loadGameState() {
    if (!gameId) {
      return;
    }
    const response = await fetch(`/games/${gameId}/state`);
    const data = await response.json();
    renderGame(data.game);
  }
  function connectToSse() {
    if (!gameId) {
      return;
    }
    const source = new EventSource(`/api/sse?room=${encodeURIComponent(`game-${gameId}`)}`);
    source.addEventListener("open", () => {
      setStatus("SSE connected. Waiting for game updates...");
    });
    source.addEventListener("game:updated", (event) => {
      const message = event;
      const game = JSON.parse(message.data);
      renderGame(game);
    });
    source.onerror = () => {
      setStatus("SSE disconnected. Browser will retry automatically.");
    };
    window.addEventListener("beforeunload", () => {
      source.close();
    });
  }
  async function init() {
    await loadGameState();
    connectToSse();
  }
  void init();
})();
//# sourceMappingURL=game.js.map
