type Player = {
  id: number;
  display_name: string;
  created_at: string;
};

type PlayersResponse = {
  ok: boolean;
  players: Player[];
};

type CreatePlayerResponse = {
  ok: boolean;
  player: Player;
  error?: string;
};

type PlayersInitEvent = {
  room: string;
  players: Player[];
};

type PlayerCreatedEvent = {
  player: Player;
};

const ROOM_NAME = "lobby";

const form = document.querySelector<HTMLFormElement>("#player-form");
const input = document.querySelector<HTMLInputElement>("#display-name");
const list = document.querySelector<HTMLUListElement>("#player-list");
const template = document.querySelector<HTMLTemplateElement>("#player-template");
const statusMessage = document.querySelector<HTMLParagraphElement>("#status-message");

let playersState: Player[] = [];
let eventSource: EventSource | null = null;

function clearPlayerList(): void {
  if (!list) {
    return;
  }

  list.replaceChildren();
}

function renderPlayer(player: Player): void {
  if (!list || !template) {
    return;
  }

  const clone = template.content.cloneNode(true) as DocumentFragment;
  const item = clone.querySelector<HTMLLIElement>(".player-item");
  const name = clone.querySelector<HTMLElement>(".player-name");
  const createdAt = clone.querySelector<HTMLElement>(".player-created-at");

  if (!item || !name || !createdAt) {
    return;
  }

  item.dataset.playerId = String(player.id);
  name.textContent = player.display_name;
  createdAt.textContent = new Date(player.created_at).toLocaleString();

  list.appendChild(clone);
}

function renderPlayers(players: Player[]): void {
  clearPlayerList();
  players.forEach(renderPlayer);
}

function setPlayers(players: Player[]): void {
  playersState = players;
  renderPlayers(playersState);
}

function prependPlayer(player: Player): void {
  const exists = playersState.some((existingPlayer) => existingPlayer.id === player.id);

  if (exists) {
    return;
  }

  playersState = [player, ...playersState];
  renderPlayers(playersState);
}

async function loadPlayers(): Promise<void> {
  const response = await fetch("/players");

  if (!response.ok) {
    throw new Error("Failed to load players.");
  }

  const data = (await response.json()) as PlayersResponse;
  setPlayers(data.players);
}

async function createPlayer(displayName: string): Promise<Player> {
  const response = await fetch("/players", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      display_name: displayName,
      room: ROOM_NAME,
    }),
  });

  const data = (await response.json()) as CreatePlayerResponse;

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? "Failed to create player.");
  }

  return data.player;
}

function connectToSse(): void {
  eventSource = new EventSource(`/api/sse?room=${encodeURIComponent(ROOM_NAME)}`);

  eventSource.addEventListener("open", () => {
    if (statusMessage) {
      statusMessage.textContent = "Live updates connected.";
    }
  });

  eventSource.addEventListener("players:init", (event) => {
    const messageEvent = event as MessageEvent<string>;
    const data = JSON.parse(messageEvent.data) as PlayersInitEvent;
    setPlayers(data.players);

    if (statusMessage) {
      statusMessage.textContent = "Initial player list loaded from SSE.";
    }
  });

  eventSource.addEventListener("player:created", (event) => {
    const messageEvent = event as MessageEvent<string>;
    const data = JSON.parse(messageEvent.data) as PlayerCreatedEvent;
    prependPlayer(data.player);

    if (statusMessage) {
      statusMessage.textContent = `New player received: ${data.player.display_name}`;
    }
  });

  eventSource.onerror = (): void => {
    if (statusMessage) {
      statusMessage.textContent = "SSE connection lost. Browser will retry automatically.";
    }
  };
}

async function handleSubmit(event: SubmitEvent): Promise<void> {
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

async function init(): Promise<void> {
  if (!form) {
    return;
  }

  form.addEventListener("submit", (event: SubmitEvent): void => {
    void handleSubmit(event);
  });

  try {
    await loadPlayers();
  } catch (error) {
    if (statusMessage) {
      statusMessage.textContent =
        error instanceof Error ? error.message : "Could not load players.";
    }
  }

  connectToSse();

  window.addEventListener("beforeunload", (): void => {
    eventSource?.close();
  });
}

void init();
