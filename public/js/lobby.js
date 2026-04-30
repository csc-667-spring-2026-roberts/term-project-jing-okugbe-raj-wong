"use strict";
(() => {
  // src/client/lobby.ts
  var ROOM_NAME = "lobby";
  var form = document.querySelector("#player-form");
  var input = document.querySelector("#display-name");
  var list = document.querySelector("#player-list");
  var template = document.querySelector("#player-template");
  var statusMessage = document.querySelector("#status-message");
  var playersState = [];
  var eventSource = null;
  function clearPlayerList() {
    if (!list) {
      return;
    }
    list.replaceChildren();
  }
  function renderPlayer(player) {
    if (!list || !template) {
      return;
    }
    const clone = template.content.cloneNode(true);
    const item = clone.querySelector(".player-item");
    const name = clone.querySelector(".player-name");
    const createdAt = clone.querySelector(".player-created-at");
    if (!item || !name || !createdAt) {
      return;
    }
    item.dataset.playerId = String(player.id);
    name.textContent = player.display_name;
    createdAt.textContent = new Date(player.created_at).toLocaleString();
    list.appendChild(clone);
  }
  function renderPlayers(players) {
    clearPlayerList();
    players.forEach(renderPlayer);
  }
  function setPlayers(players) {
    playersState = players;
    renderPlayers(playersState);
  }
  function prependPlayer(player) {
    const exists = playersState.some((existingPlayer) => existingPlayer.id === player.id);
    if (exists) {
      return;
    }
    playersState = [player, ...playersState];
    renderPlayers(playersState);
  }
  async function loadPlayers() {
    const response = await fetch("/players");
    if (!response.ok) {
      throw new Error("Failed to load players.");
    }
    const data = await response.json();
    setPlayers(data.players);
  }
  async function createPlayer(displayName) {
    const response = await fetch("/players", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        display_name: displayName,
        room: ROOM_NAME
      })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error ?? "Failed to create player.");
    }
    return data.player;
  }
  function connectToSse() {
    eventSource = new EventSource(`/api/sse?room=${encodeURIComponent(ROOM_NAME)}`);
    eventSource.addEventListener("open", () => {
      if (statusMessage) {
        statusMessage.textContent = "Live updates connected.";
      }
    });
    eventSource.addEventListener("players:init", (event) => {
      const messageEvent = event;
      const data = JSON.parse(messageEvent.data);
      setPlayers(data.players);
      if (statusMessage) {
        statusMessage.textContent = "Initial player list loaded from SSE.";
      }
    });
    eventSource.addEventListener("player:created", (event) => {
      const messageEvent = event;
      const data = JSON.parse(messageEvent.data);
      prependPlayer(data.player);
      if (statusMessage) {
        statusMessage.textContent = `New player received: ${data.player.display_name}`;
      }
    });
    eventSource.onerror = () => {
      if (statusMessage) {
        statusMessage.textContent = "SSE connection lost. Browser will retry automatically.";
      }
    };
  }
  async function handleSubmit(event) {
    event.preventDefault();
    if (!input || !statusMessage) {
      return;
    }
    const displayName = input.value.trim();
    if (!displayName) {
      statusMessage.textContent = "Please enter a player name.";
      return;
    }
    statusMessage.textContent = "Sending player to server...";
    try {
      await createPlayer(displayName);
      input.value = "";
      statusMessage.textContent = "Player created. Waiting for SSE update...";
    } catch (error) {
      statusMessage.textContent = error instanceof Error ? error.message : "Something went wrong.";
    }
  }
  async function init() {
    if (!form) {
      return;
    }
    form.addEventListener("submit", (event) => {
      void handleSubmit(event);
    });
    try {
      await loadPlayers();
    } catch (error) {
      if (statusMessage) {
        statusMessage.textContent = error instanceof Error ? error.message : "Could not load players.";
      }
    }
    connectToSse();
    window.addEventListener("beforeunload", () => {
      eventSource?.close();
    });
  }
  void init();
})();
//# sourceMappingURL=lobby.js.map
