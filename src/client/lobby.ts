type WaitingGame = {
  id: number;
  status: string;
  created_at: string;
  created_by_email: string | null;
  player_count: number;
};

type GamesResponse = { ok: boolean; games: WaitingGame[] };

type GameCreatedEvent = {
  id: number;
  created_by_email: string | null;
  status: string;
  created_at: string;
};

const list = document.querySelector<HTMLUListElement>("#games-list");
const statusMessage = document.querySelector<HTMLElement>("#status-message");
const gameTemplate = document.querySelector<HTMLTemplateElement>("#game-row-template");
const emptyTemplate = document.querySelector<HTMLTemplateElement>("#empty-games-template");

let gamesState: WaitingGame[] = [];

function setStatus(message: string): void {
  if (statusMessage) {
    statusMessage.textContent = message;
  }
}

function cloneTemplate(template: HTMLTemplateElement): DocumentFragment {
  return template.content.cloneNode(true) as DocumentFragment;
}

function renderEmptyState(): void {
  if (!list || !emptyTemplate) {
    return;
  }

  list.appendChild(cloneTemplate(emptyTemplate));
}

function renderGameRow(game: WaitingGame): void {
  if (!list || !gameTemplate) {
    return;
  }

  const fragment = cloneTemplate(gameTemplate);
  const row = fragment.querySelector("li");
  const title = fragment.querySelector<HTMLElement>(".game-title");
  const creator = fragment.querySelector<HTMLElement>(".game-creator");
  const playerCount = fragment.querySelector<HTMLElement>(".game-player-count");
  const link = fragment.querySelector<HTMLAnchorElement>(".game-link");

  if (row) {
    row.dataset.gameId = String(game.id);
  }

  if (title) {
    title.textContent = `Game #${String(game.id)} — `;
  }

  if (creator) {
    creator.textContent = `created by ${game.created_by_email ?? "unknown"} — `;
  }

  if (playerCount) {
    playerCount.textContent = `${String(game.player_count)}/4 players — `;
  }

  if (link) {
    link.href = `/games/${String(game.id)}`;
  }

  list.appendChild(fragment);
}

function renderGames(): void {
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

async function loadGames(): Promise<void> {
  const response = await fetch("/lobby/games");

  if (!response.ok) {
    setStatus("Failed to load games.");
    return;
  }

  const data = (await response.json()) as GamesResponse;
  gamesState = data.games;
  renderGames();
  setStatus("Games loaded.");
}

function connectSse(): void {
  const source = new EventSource("/api/sse?room=lobby");

  source.addEventListener("open", (): void => {
    setStatus("Live updates connected.");
  });

  source.addEventListener("lobby:game-created", (event): void => {
    const message = event as MessageEvent<string>;
    const data = JSON.parse(message.data) as GameCreatedEvent;
    const newGame: WaitingGame = {
      id: data.id,
      status: data.status,
      created_at: data.created_at,
      created_by_email: data.created_by_email,
      player_count: 1,
    };

    if (!gamesState.some((game) => game.id === newGame.id)) {
      gamesState = [newGame, ...gamesState];
      renderGames();
      setStatus(`New game appeared: #${String(newGame.id)}`);
    }
  });

  source.onerror = (): void => {
    setStatus("SSE disconnected. Browser will retry...");
  };

  window.addEventListener("beforeunload", (): void => {
    source.close();
  });
}

async function init(): Promise<void> {
  await loadGames();
  connectSse();
}

void init();
