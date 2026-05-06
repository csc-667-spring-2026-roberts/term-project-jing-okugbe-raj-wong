type GamePlayer = {
  user_id: number;
  email: string;
  score: number;
};

type BoardTile = {
  user_id: number;
  letter: string;
  score: number;
  row: number;
  col: number;
};

type RackTile = {
  id: number;
  tile_id: number;
  letter: string;
  score: number;
};

type GameState = {
  id: number;
  status: string;
  current_turn_user_id: number | null;
  players: GamePlayer[];
  board: BoardTile[];
  tiles_remaining: number;
};

type GameStateResponse = {
  ok: boolean;
  game?: GameState;
  rack?: RackTile[];
  error?: string;
};

const main = document.querySelector<HTMLElement>("main[data-game-id]");
const gameId = main?.dataset.gameId;
const currentUserId = main?.dataset.currentUserId ? Number(main.dataset.currentUserId) : null;

const statusMessage = document.querySelector<HTMLElement>("#status-message");
const gameStatus = document.querySelector<HTMLElement>("#game-status");
const tilesRemaining = document.querySelector<HTMLElement>("#tiles-remaining");
const turnIndicator = document.querySelector<HTMLElement>("#turn-indicator");
const playersList = document.querySelector<HTMLUListElement>("#players-list");
const boardList = document.querySelector<HTMLOListElement>("#board-list");
const rackContainer = document.querySelector<HTMLDivElement>("#rack");

function setStatus(message: string): void {
  if (statusMessage) {
    statusMessage.textContent = message;
  }
}

function renderPlayers(players: GamePlayer[]): void {
  if (!playersList) {
    return;
  }

  playersList.replaceChildren();

  for (const player of players) {
    const li = document.createElement("li");
    li.dataset.userId = String(player.user_id);
    li.textContent = `${player.email} — score: ${String(player.score)}`;
    playersList.appendChild(li);
  }
}

function renderBoard(board: BoardTile[]): void {
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

function renderRack(rack: RackTile[], game: GameState): void {
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

function renderGame(game: GameState, rack: RackTile[]): void {
  if (gameStatus) {
    gameStatus.textContent = game.status;
  }

  if (tilesRemaining) {
    tilesRemaining.textContent = String(game.tiles_remaining);
  }

  if (turnIndicator) {
    turnIndicator.textContent =
      game.current_turn_user_id === null ? "—" : String(game.current_turn_user_id);
  }

  renderPlayers(game.players);
  renderBoard(game.board);
  renderRack(rack, game);

  setStatus("Live game state updated.");
}

async function loadGameState(): Promise<void> {
  if (!gameId) {
    return;
  }

  const response = await fetch(`/games/${gameId}/state`);
  const data = (await response.json()) as GameStateResponse;

  if (!response.ok || !data.ok || !data.game) {
    setStatus(data.error ?? "Failed to load game state.");
    return;
  }

  renderGame(data.game, data.rack ?? []);
}

async function playTile(playerTileId: string): Promise<void> {
  if (!gameId) {
    return;
  }

  setStatus("Playing tile...");

  const body = new URLSearchParams();
  body.set("player_tile_id", playerTileId);

  const response = await fetch(`/games/${gameId}/play`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = (await response.json()) as { ok: boolean; error?: string };

  if (!response.ok || !data.ok) {
    setStatus(data.error ?? "Failed to play tile.");
    return;
  }

  await loadGameState();
}

function connectToSse(): void {
  if (!gameId) {
    return;
  }

  const source = new EventSource(`/api/sse?room=${encodeURIComponent(`game-${gameId}`)}`);

  source.addEventListener("open", (): void => {
    setStatus("SSE connected. Waiting for game updates...");
  });

  source.addEventListener("game:updated", (): void => {
    void loadGameState();
  });

  source.onerror = (): void => {
    setStatus("SSE disconnected. Browser will retry automatically.");
  };

  window.addEventListener("beforeunload", (): void => {
    source.close();
  });
}

function setupRackClickHandler(): void {
  if (!rackContainer) {
    return;
  }

  rackContainer.addEventListener("click", (event): void => {
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

async function init(): Promise<void> {
  setupRackClickHandler();
  await loadGameState();
  connectToSse();
}

void init();
