"use strict";
(() => {
  // src/client/lobby.ts
  var form = document.querySelector("#player-form");
  var input = document.querySelector("#display-name");
  var list = document.querySelector("#player-list");
  var template = document.querySelector("#player-template");
  var statusMessage = document.querySelector("#status-message");
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
  async function loadPlayers() {
    const response = await fetch("/players");
    if (!response.ok) {
      throw new Error("Failed to load players.");
    }
    const data = await response.json();
    renderPlayers(data.players);
  }
  async function createPlayer(displayName) {
    const response = await fetch("/players", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ display_name: displayName })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error ?? "Failed to create player.");
    }
    return data.player;
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
    statusMessage.textContent = "Saving player...";
    try {
      await createPlayer(displayName);
      input.value = "";
      await loadPlayers();
      statusMessage.textContent = "Player added successfully.";
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
      if (statusMessage) {
        statusMessage.textContent = "Players loaded.";
      }
    } catch (error) {
      if (statusMessage) {
        statusMessage.textContent = error instanceof Error ? error.message : "Could not load players.";
      }
    }
  }
  void init();
})();
//# sourceMappingURL=lobby.js.map
