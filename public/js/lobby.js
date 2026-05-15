"use strict";
(() => {
  // src/client/lobby.ts
  var list = document.querySelector("#games-list");
  var statusMessage = document.querySelector("#status-message");
  var gameTemplate = document.querySelector("#game-row-template");
  var emptyTemplate = document.querySelector("#empty-games-template");
  var gamesState = [];
  function setStatus(message) {
    if (statusMessage) {
      statusMessage.textContent = message;
    }
  }
  function cloneTemplate(template) {
    return template.content.cloneNode(true);
  }
  function renderEmptyState() {
    if (!list || !emptyTemplate) {
      return;
    }
    list.appendChild(cloneTemplate(emptyTemplate));
  }
  function renderGameRow(game) {
    if (!list || !gameTemplate) {
      return;
    }
    const fragment = cloneTemplate(gameTemplate);
    const row = fragment.querySelector("li");
    const title = fragment.querySelector(".game-title");
    const creator = fragment.querySelector(".game-creator");
    const playerCount = fragment.querySelector(".game-player-count");
    const link = fragment.querySelector(".game-link");
    if (row) {
      row.dataset.gameId = String(game.id);
    }
    if (title) {
      title.textContent = `Game #${String(game.id)} \u2014 `;
    }
    if (creator) {
      creator.textContent = `created by ${game.created_by_email ?? "unknown"} \u2014 `;
    }
    if (playerCount) {
      playerCount.textContent = `${String(game.player_count)}/4 players \u2014 `;
    }
    if (link) {
      link.href = `/games/${String(game.id)}`;
    }
    list.appendChild(fragment);
  }
  function renderGames() {
    if (!list) {
      return;
    }
    list.replaceChildren();
    if (gamesState.length === 0) {
      renderEmptyState();
      return;
    }
    for (const game of gamesState) {
      renderGameRow(game);
    }
  }
  async function loadGames() {
    const response = await fetch("/lobby/games");
    if (!response.ok) {
      setStatus("Failed to load games.");
      return;
    }
    const data = await response.json();
    gamesState = data.games;
    renderGames();
    setStatus("Games loaded.");
  }
  function connectSse() {
    const source = new EventSource("/api/sse?room=lobby");
    source.addEventListener("open", () => {
      setStatus("Live updates connected.");
    });
    source.addEventListener("lobby:game-created", (event) => {
      const message = event;
      const data = JSON.parse(message.data);
      const newGame = {
        id: data.id,
        status: data.status,
        created_at: data.created_at,
        created_by_email: data.created_by_email,
        player_count: 1
      };
      if (!gamesState.some((game) => game.id === newGame.id)) {
        gamesState = [newGame, ...gamesState];
        renderGames();
        setStatus(`New game appeared: #${String(newGame.id)}`);
      }
    });
    source.onerror = () => {
      setStatus("SSE disconnected. Browser will retry...");
    };
    window.addEventListener("beforeunload", () => {
      source.close();
    });
  }
  async function init() {
    await loadGames();
    connectSse();
  }
  void init();
})();
//# sourceMappingURL=lobby.js.map
