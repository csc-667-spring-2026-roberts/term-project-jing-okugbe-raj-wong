"use strict";
(() => {
  // src/client/lobby.ts
  var list = document.querySelector("#games-list");
  var statusMessage = document.querySelector("#status-message");
  var gamesState = [];
  function setStatus(msg) {
    if (statusMessage) statusMessage.textContent = msg;
  }
  function renderGames() {
    if (!list) return;
    list.replaceChildren();
    if (gamesState.length === 0) {
      const li = document.createElement("li");
      li.innerHTML = "<em>No open games. Create one above.</em>";
      list.appendChild(li);
      return;
    }
    for (const game of gamesState) {
      const li = document.createElement("li");
      li.dataset.gameId = String(game.id);
      const creator = game.created_by_email ?? "(unknown)";
      li.innerHTML = `
      Game #${String(game.id)} \u2014
      created by ${creator} \u2014
      ${String(game.player_count)} player(s) \u2014
      <a href="/games/${String(game.id)}">Open</a>
    `;
      list.appendChild(li);
    }
  }
  async function loadGames() {
    const res = await fetch("/lobby/games");
    if (!res.ok) {
      setStatus("Failed to load games.");
      return;
    }
    const data = await res.json();
    gamesState = data.games;
    renderGames();
    setStatus("Games loaded.");
  }
  function connectSse() {
    const source = new EventSource("/api/sse?room=lobby");
    source.addEventListener("open", () => setStatus("Live updates connected."));
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
      if (!gamesState.some((g) => g.id === newGame.id)) {
        gamesState = [newGame, ...gamesState];
        renderGames();
        setStatus(`New game appeared: #${String(newGame.id)}`);
      }
    });
    source.onerror = () => setStatus("SSE disconnected. Browser will retry...");
    window.addEventListener("beforeunload", () => source.close());
  }
  async function init() {
    await loadGames();
    connectSse();
  }
  void init();
})();
//# sourceMappingURL=lobby.js.map
