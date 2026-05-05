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
  created_by_email: string;
  status: string;
  created_at: string;
};

const list = document.querySelector<HTMLUListElement>("#games-list");
const statusMessage = document.querySelector<HTMLElement>("#status-message");

let gamesState: WaitingGame[] = [];

function setStatus(msg: string): void {
  if (statusMessage) statusMessage.textContent = msg;
}

function renderGames(): void {
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
      Game #${String(game.id)} —
      created by ${creator} —
      ${String(game.player_count)} player(s) —
      <a href="/games/${String(game.id)}">Open</a>
    `;
    list.appendChild(li);
  }
}

async function loadGames(): Promise<void> {
  const res = await fetch("/lobby/games");
  if (!res.ok) {
    setStatus("Failed to load games.");
    return;
  }
  const data = (await res.json()) as GamesResponse;
  gamesState = data.games;
  renderGames();
  setStatus("Games loaded.");
}

function connectSse(): void {
  const source = new EventSource("/api/sse?room=lobby");

  source.addEventListener("open", () => setStatus("Live updates connected."));

  source.addEventListener("lobby:game-created", (event) => {
    const message = event as MessageEvent<string>;
    const data = JSON.parse(message.data) as GameCreatedEvent;
    const newGame: WaitingGame = {
      id: data.id,
      status: data.status,
      created_at: data.created_at,
      created_by_email: data.created_by_email,
      player_count: 1,
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

async function init(): Promise<void> {
  await loadGames();
  connectSse();
}

void init();