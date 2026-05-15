/* eslint-disable complexity, max-lines-per-function, @typescript-eslint/no-non-null-assertion */
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

export type TilePlacement = {
  player_tile_id: number;
  row: number;
  col: number;
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
  await db.tx(async (t) => {
    const game = await t.oneOrNone<Game>(`SELECT * FROM games WHERE id = $1 FOR UPDATE`, [gameId]);

    if (!game) {
      throw new Error("Game not found");
    }

    if (game.status !== "waiting") {
      throw new Error("Cannot join a game that already started");
    }

    const alreadyJoined = await t.oneOrNone<{ user_id: number }>(
      `SELECT user_id
         FROM game_players
        WHERE game_id = $1 AND user_id = $2`,
      [gameId, userId],
    );

    if (alreadyJoined) {
      return;
    }

    const row = await t.one<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM game_players
        WHERE game_id = $1`,
      [gameId],
    );

    if (row.count >= MAX_PLAYERS) {
      throw new Error("This game is full");
    }

    await t.none(
      `INSERT INTO game_players (game_id, user_id)
       VALUES ($1, $2)`,
      [gameId, userId],
    );
  });
}

// Fisher-Yates shuffle in place

function fisherYatesShuffle<T>(input: readonly T[]): T[] {
  const arr = [...input]; // on a copy to avoid mutating original
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

const TILES_PER_PLAYER = 7;
const MIN_PLAYERS_TO_START = 2;
const MAX_PLAYERS = 4;

export async function startGame(gameId: number): Promise<void> {
  await db.tx(async (t) => {
    // Guard 1: only start if currently waiting (re-start protection)
    const game = await t.oneOrNone<Game>(`SELECT * FROM games WHERE id = $1`, [gameId]);
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
    if (players.length < MIN_PLAYERS_TO_START) {
      throw new Error(`Need at least ${String(MIN_PLAYERS_TO_START)} players to start`);
    }

    if (players.length > MAX_PLAYERS) {
      throw new Error(`This game supports up to ${String(MAX_PLAYERS)} players`);
    }
    const firstPlayer = players[0];
    if (!firstPlayer) throw new Error("Cannot start game with no players");

    // 1. Build the bag from the tiles lookup
    const tiles = await t.any<{ id: number; quantity: number }>(`SELECT id, quantity FROM tiles`);
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
export async function playWord(
  gameId: number,
  userId: number,
  placements: TilePlacement[],
): Promise<void> {
  return db.tx(async (t) => {
    const game = await t.one<Game>(`SELECT * FROM games WHERE id = $1`, [gameId]);
    if (game.status !== "started") throw new Error("Game not started");
    if (game.current_turn_user_id !== userId) throw new Error("Not your turn");
    if (placements.length === 0) throw new Error("Must place at least one tile");

    for (const p of placements) {
      if (p.row < 0 || p.row > 14 || p.col < 0 || p.col > 14) {
        throw new Error(`Position (${String(p.row)}, ${String(p.col)}) is off the board`);
      }
    }

    const posSet = new Set(placements.map((p) => `${String(p.row)},${String(p.col)}`));
    if (posSet.size !== placements.length) {
      throw new Error("Cannot place two tiles on the same cell");
    }

    const tiles: { id: number; tile_id: number }[] = [];
    for (const p of placements) {
      const tile = await t.oneOrNone<{ id: number; tile_id: number }>(
        `SELECT id, tile_id FROM player_tiles
          WHERE id = $1 AND game_id = $2 AND user_id = $3 AND status = 'in_hand'`,
        [p.player_tile_id, gameId, userId],
      );
      if (!tile) throw new Error("Tile not in your hand");
      tiles.push(tile);
    }

    const existingTiles = await t.any<{ row: number; col: number }>(
      `SELECT board_row AS row, board_col AS col FROM played_tiles WHERE game_id = $1`,
      [gameId],
    );
    const occupied = new Set(existingTiles.map((et) => `${String(et.row)},${String(et.col)}`));

    for (const p of placements) {
      if (occupied.has(`${String(p.row)},${String(p.col)}`)) {
        throw new Error(`Cell (${String(p.row)}, ${String(p.col)}) is already occupied`);
      }
    }

    const allSameRow = placements.every((p) => p.row === placements[0]!.row);
    const allSameCol = placements.every((p) => p.col === placements[0]!.col);
    if (!allSameRow && !allSameCol) {
      throw new Error("All tiles must be placed in the same row or column");
    }

    if (allSameRow && placements.length > 1) {
      const row = placements[0]!.row;
      const cols = placements.map((p) => p.col).sort((a, b) => a - b);
      for (let c = cols[0]!; c <= cols[cols.length - 1]!; c++) {
        const isPlaced = placements.some((p) => p.col === c);
        const isExisting = occupied.has(`${String(row)},${String(c)}`);
        if (!isPlaced && !isExisting) {
          throw new Error("Tiles must form a contiguous line with no gaps");
        }
      }
    } else if (allSameCol && placements.length > 1) {
      const col = placements[0]!.col;
      const rows = placements.map((p) => p.row).sort((a, b) => a - b);
      for (let r = rows[0]!; r <= rows[rows.length - 1]!; r++) {
        const isPlaced = placements.some((p) => p.row === r);
        const isExisting = occupied.has(`${String(r)},${String(col)}`);
        if (!isPlaced && !isExisting) {
          throw new Error("Tiles must form a contiguous line with no gaps");
        }
      }
    }

    const boardEmpty = existingTiles.length === 0;
    if (boardEmpty) {
      const coversCenter = placements.some((p) => p.row === 7 && p.col === 7);
      if (!coversCenter) {
        throw new Error("First word must cross the center square");
      }
    } else {
      const connected = placements.some((p) => {
        return (
          occupied.has(`${String(p.row - 1)},${String(p.col)}`) ||
          occupied.has(`${String(p.row + 1)},${String(p.col)}`) ||
          occupied.has(`${String(p.row)},${String(p.col - 1)}`) ||
          occupied.has(`${String(p.row)},${String(p.col + 1)}`)
        );
      });
      if (!connected) {
        throw new Error("Word must connect to existing tiles on the board");
      }
    }

    let wordScore = 0;
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i]!;
      const tile = tiles[i]!;

      await t.none(`UPDATE player_tiles SET status = 'played' WHERE id = $1`, [tile.id]);
      await t.none(
        `INSERT INTO played_tiles (game_id, user_id, tile_id, player_tile_id, board_row, board_col)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [gameId, userId, tile.tile_id, tile.id, p.row, p.col],
      );

      const tileScore = await t.one<{ score: number }>(`SELECT score FROM tiles WHERE id = $1`, [
        tile.tile_id,
      ]);
      wordScore += tileScore.score;
    }

    await t.none(`UPDATE game_players SET score = score + $1 WHERE game_id = $2 AND user_id = $3`, [
      wordScore,
      gameId,
      userId,
    ]);

    const available = await t.any<{ id: number; tile_id: number }>(
      `SELECT id, tile_id FROM game_tile_bag
        WHERE game_id = $1 AND drawn_by_user_id IS NULL
        ORDER BY draw_order ASC
        LIMIT $2`,
      [gameId, placements.length],
    );
    for (const bag of available) {
      await t.none(
        `UPDATE game_tile_bag SET drawn_by_user_id = $1, drawn_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [userId, bag.id],
      );
      await t.none(
        `INSERT INTO player_tiles (game_id, user_id, tile_id, tile_bag_id, status)
         VALUES ($1, $2, $3, $4, 'in_hand')`,
        [gameId, userId, bag.tile_id, bag.id],
      );
    }

    const players = await t.any<{ user_id: number }>(
      `SELECT user_id FROM game_players WHERE game_id = $1 ORDER BY joined_at ASC`,
      [gameId],
    );
    const idx = players.findIndex((p) => p.user_id === userId);
    const next = players[(idx + 1) % players.length];
    if (!next) throw new Error("No next player");
    await t.none(
      `UPDATE games SET current_turn_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [next.user_id, gameId],
    );
  });
}

export async function passTurn(gameId: number, userId: number): Promise<void> {
  return db.tx(async (t) => {
    const game = await t.one<Game>(`SELECT * FROM games WHERE id = $1`, [gameId]);
    if (game.status !== "started") throw new Error("Game not started");
    if (game.current_turn_user_id !== userId) throw new Error("Not your turn");

    const players = await t.any<{ user_id: number }>(
      `SELECT user_id FROM game_players WHERE game_id = $1 ORDER BY joined_at ASC`,
      [gameId],
    );
    const idx = players.findIndex((p) => p.user_id === userId);
    const next = players[(idx + 1) % players.length];
    if (!next) throw new Error("No next player");
    await t.none(
      `UPDATE games SET current_turn_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [next.user_id, gameId],
    );
  });
}
