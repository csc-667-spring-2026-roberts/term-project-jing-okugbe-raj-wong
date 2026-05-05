import { db } from "./connection.js";

// Types 

export type GameStatus = "waiting" | "started" | "finished";

export type Game = {
  id: number;
  status: GameStatus;
  current_turn_user_id: number | null;
  created_by_user_id: number | null;
  created_at: Date;
  updated_at: Date;
};

export type GamePlayerRow = {
  user_id: number;
  email: string;
  score: number;
};

export type RackTile = {
  id: number;          
  tile_id: number;
  letter: string;
  score: number;
};

export type BoardTile = {
  user_id: number;
  letter: string;
  score: number;
  row: number;
  col: number;
};

export type GameState = {
  id: number;
  status: GameStatus;
  current_turn_user_id: number | null;
  players: GamePlayerRow[];
  board: BoardTile[];
  tiles_remaining: number;
};

// Reads 

export async function getGameById(gameId: number): Promise<Game | null> {
  return db.oneOrNone<Game>(`SELECT * FROM games WHERE id = $1`, [gameId]);
}

export async function getGamePlayers(gameId: number): Promise<GamePlayerRow[]> {
  return db.any<GamePlayerRow>(
    `SELECT gp.user_id, u.email, gp.score
       FROM game_players gp
       JOIN users u ON u.id = gp.user_id
      WHERE gp.game_id = $1
      ORDER BY gp.joined_at ASC`,
    [gameId],
  );
}

export async function getPlayerRack(gameId: number, userId: number): Promise<RackTile[]> {
  return db.any<RackTile>(
    `SELECT pt.id, pt.tile_id, t.letter, t.score
       FROM player_tiles pt
       JOIN tiles t ON t.id = pt.tile_id
      WHERE pt.game_id = $1 AND pt.user_id = $2 AND pt.status = 'in_hand'
      ORDER BY pt.id ASC`,
    [gameId, userId],
  );
}

export async function getBoard(gameId: number): Promise<BoardTile[]> {
  return db.any<BoardTile>(
    `SELECT plt.user_id, t.letter, t.score,
            plt.board_row AS row, plt.board_col AS col
       FROM played_tiles plt
       JOIN tiles t ON t.id = plt.tile_id
      WHERE plt.game_id = $1
      ORDER BY plt.created_at ASC`,
    [gameId],
  );
}

export async function getTilesRemaining(gameId: number): Promise<number> {
  const row = await db.one<{ count: number }>(
    `SELECT COUNT(*)::int AS count
       FROM game_tile_bag
      WHERE game_id = $1 AND drawn_by_user_id IS NULL`,
    [gameId],
  );
  return row.count;
}

export async function getGameState(gameId: number): Promise<GameState | null> {
  const game = await getGameById(gameId);
  if (!game) return null;

  const [players, board, tiles_remaining] = await Promise.all([
    getGamePlayers(gameId),
    getBoard(gameId),
    getTilesRemaining(gameId),
  ]);

  return {
    id: game.id,
    status: game.status,
    current_turn_user_id: game.current_turn_user_id,
    players,
    board,
    tiles_remaining,
  };
}

// Writes 

export async function createGame(userId: number): Promise<Game> {
  return db.tx(async (t) => {
    const game = await t.one<Game>(
      `INSERT INTO games (created_by_user_id)
       VALUES ($1)
       RETURNING *`,
      [userId],
    );
    await t.none(
      `INSERT INTO game_players (game_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (game_id, user_id) DO NOTHING`,
      [game.id, userId],
    );
    return game;
  });
}

export async function joinGame(gameId: number, userId: number): Promise<void> {
  await db.none(
    `INSERT INTO game_players (game_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (game_id, user_id) DO NOTHING`,
    [gameId, userId],
  );
}

// Fisher-Yates shuffle in place

function fisherYatesShuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];// on a copy to avoid mutating original
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

const TILES_PER_PLAYER = 7;

export async function startGame(gameId: number): Promise<void> {
  await db.tx(async (t) => {
    // Guard 1: only start if currently waiting (re-start protection)
    const game = await t.oneOrNone<Game>(
      `SELECT * FROM games WHERE id = $1`,
      [gameId],
    );
    if (!game) throw new Error("Game not found");
    if (game.status !== "waiting") {
      throw new Error(`Cannot start game in status '${game.status}'`);
    }

    // Get joined players in order
    const players = await t.any<{ user_id: number }>(
      `SELECT user_id FROM game_players
        WHERE game_id = $1 ORDER BY joined_at ASC`,
      [gameId],
    );

    // Guard 2: min 2 players
    if (players.length < 2) {
      throw new Error("Need at least 2 players to start");
    }
    const firstPlayer = players[0];
    if (!firstPlayer) throw new Error("Cannot start game with no players");

    // 1. Build the bag from the tiles lookup
    const tiles = await t.any<{ id: number; quantity: number }>(
      `SELECT id, quantity FROM tiles`,
    );
    const bag: number[] = [];
    for (const tile of tiles) {
      for (let i = 0; i < tile.quantity; i++) bag.push(tile.id);
    }

    // 2. Shuffle (Fisher-Yates) and insert into game_tile_bag
    const shuffled = fisherYatesShuffle(bag);
    for (let i = 0; i < shuffled.length; i++) {
      await t.none(
        `INSERT INTO game_tile_bag (game_id, tile_id, draw_order)
         VALUES ($1, $2, $3)`,
        [gameId, shuffled[i], i],
      );
    }

    // 3. Deal 7 tiles to each player from the front of the bag
    let drawOrder = 0;
    for (const p of players) {
      for (let i = 0; i < TILES_PER_PLAYER; i++) {
        const drawn = await t.one<{ id: number; tile_id: number }>(
          `UPDATE game_tile_bag
              SET drawn_by_user_id = $1, drawn_at = CURRENT_TIMESTAMP
            WHERE game_id = $2 AND draw_order = $3
            RETURNING id, tile_id`,
          [p.user_id, gameId, drawOrder],
        );
        await t.none(
          `INSERT INTO player_tiles (game_id, user_id, tile_id, tile_bag_id, status)
           VALUES ($1, $2, $3, $4, 'in_hand')`,
          [gameId, p.user_id, drawn.tile_id, drawn.id],
        );
        drawOrder++;
      }
    }

    // 4. Set status + first turn
    await t.none(
      `UPDATE games
          SET status = 'started',
              current_turn_user_id = $1,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
      [firstPlayer.user_id, gameId],
    );
  });
}

// "Play one tile" 

export async function playTile(
  gameId: number,
  userId: number,
  playerTileId: number,
): Promise<{ row: number; col: number }> {
  return db.tx(async (t) => {
    const game = await t.one<Game>(`SELECT * FROM games WHERE id = $1`, [gameId]);
    if (game.status !== "started") throw new Error("Game not started");
    if (game.current_turn_user_id !== userId) throw new Error("Not your turn");

    const tile = await t.oneOrNone<{ id: number; tile_id: number }>(
      `SELECT id, tile_id FROM player_tiles
        WHERE id = $1 AND game_id = $2 AND user_id = $3 AND status = 'in_hand'`,
      [playerTileId, gameId, userId],
    );
    if (!tile) throw new Error("Tile not in your hand");

    const row = 7;
    const last = await t.one<{ max_col: number | null }>(
      `SELECT MAX(board_col) AS max_col FROM played_tiles
        WHERE game_id = $1 AND board_row = $2`,
      [gameId, row],
    );
    const col = (last.max_col ?? -1) + 1;

    await t.none(`UPDATE player_tiles SET status = 'played' WHERE id = $1`, [tile.id]);
    await t.none(
      `INSERT INTO played_tiles (game_id, user_id, tile_id, player_tile_id, board_row, board_col)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [gameId, userId, tile.tile_id, tile.id, row, col],
    );

    const tileScore = await t.one<{ score: number }>(
      `SELECT score FROM tiles WHERE id = $1`,
      [tile.tile_id],
    );
    await t.none(
      `UPDATE game_players SET score = score + $1
        WHERE game_id = $2 AND user_id = $3`,
      [tileScore.score, gameId, userId],
    );

    // Advance turn
    const players = await t.any<{ user_id: number }>(
      `SELECT user_id FROM game_players
        WHERE game_id = $1 ORDER BY joined_at ASC`,
      [gameId],
    );
    const idx = players.findIndex((p) => p.user_id === userId);
    const next = players[(idx + 1) % players.length];
    if (!next) throw new Error("No next player");
    await t.none(
      `UPDATE games SET current_turn_user_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
      [next.user_id, gameId],
    );

    return { row, col };
  });
}