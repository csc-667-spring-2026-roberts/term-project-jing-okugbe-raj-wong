type DemoGame = {
  id: number;
  status: string;
  players: string[];
  playedTiles: string[];
};

type GameStateResponse = {
  ok: boolean;
  game?: DemoGame;
};

const main = document.querySelector<HTMLElement>("main[data-game-id]");
const gameId = main?.dataset.gameId;

const statusMessage = document.querySelector<HTMLElement>("#status-message");
const gameStatus = document.querySelector<HTMLElement>("#game-status");
const playersList = document.querySelector<HTMLUListElement>("#players-list");
const playedTilesList = document.querySelector<HTMLUListElement>("#played-tiles-list");

function setStatus(message: string): void {
  if (statusMessage) {
    statusMessage.textContent = message;
  }
}

function renderList(list: HTMLUListElement | null, items: string[]): void {
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

function renderGame(game?: DemoGame): void {
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

async function loadGameState(): Promise<void> {
  if (!gameId) {
    return;
  }

  const response = await fetch(`/games/${gameId}/state`);
  const data = (await response.json()) as GameStateResponse;

  renderGame(data.game);
}

function connectToSse(): void {
  if (!gameId) {
    return;
  }

  const source = new EventSource(`/api/sse?room=${encodeURIComponent(`game-${gameId}`)}`);

  source.addEventListener("open", (): void => {
    setStatus("SSE connected. Waiting for game updates...");
  });

  source.addEventListener("game:updated", (event): void => {
    const message = event as MessageEvent<string>;
    const game = JSON.parse(message.data) as DemoGame;
    renderGame(game);
  });

  source.onerror = (): void => {
    setStatus("SSE disconnected. Browser will retry automatically.");
  };

  window.addEventListener("beforeunload", (): void => {
    source.close();
  });
}

async function init(): Promise<void> {
  await loadGameState();
  connectToSse();
}

void init();
