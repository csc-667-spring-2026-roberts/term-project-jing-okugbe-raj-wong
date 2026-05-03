import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE tiles (
      id SERIAL PRIMARY KEY,
      letter VARCHAR(2) NOT NULL UNIQUE,
      score INTEGER NOT NULL,
      quantity INTEGER NOT NULL
    );

    INSERT INTO tiles (letter, score, quantity) VALUES
      ('A', 1, 9),
      ('B', 3, 2),
      ('C', 3, 2),
      ('D', 2, 4),
      ('E', 1, 12),
      ('F', 4, 2),
      ('G', 2, 3),
      ('H', 4, 2),
      ('I', 1, 9),
      ('J', 8, 1),
      ('K', 5, 1),
      ('L', 1, 4),
      ('M', 3, 2),
      ('N', 1, 6),
      ('O', 1, 8),
      ('P', 3, 2),
      ('Q', 10, 1),
      ('R', 1, 6),
      ('S', 1, 4),
      ('T', 1, 6),
      ('U', 1, 4),
      ('V', 4, 2),
      ('W', 4, 2),
      ('X', 8, 1),
      ('Y', 4, 2),
      ('Z', 10, 1),
      ('_', 0, 2);

    CREATE TABLE games (
      id SERIAL PRIMARY KEY,
      status VARCHAR(20) NOT NULL DEFAULT 'waiting',
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      current_turn_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE game_players (
      id SERIAL PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      score INTEGER NOT NULL DEFAULT 0,
      joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (game_id, user_id)
    );

    CREATE TABLE game_tile_bag (
      id SERIAL PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      tile_id INTEGER NOT NULL REFERENCES tiles(id) ON DELETE CASCADE,
      draw_order INTEGER NOT NULL,
      drawn_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      drawn_at TIMESTAMP,
      UNIQUE (game_id, draw_order)
    );

    CREATE TABLE player_tiles (
      id SERIAL PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tile_id INTEGER NOT NULL REFERENCES tiles(id) ON DELETE CASCADE,
      tile_bag_id INTEGER NOT NULL REFERENCES game_tile_bag(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'in_hand',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE played_tiles (
      id SERIAL PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tile_id INTEGER NOT NULL REFERENCES tiles(id) ON DELETE CASCADE,
      player_tile_id INTEGER NOT NULL REFERENCES player_tiles(id) ON DELETE CASCADE,
      board_row INTEGER NOT NULL DEFAULT 7,
      board_col INTEGER NOT NULL DEFAULT 7,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS played_tiles;
    DROP TABLE IF EXISTS player_tiles;
    DROP TABLE IF EXISTS game_tile_bag;
    DROP TABLE IF EXISTS game_players;
    DROP TABLE IF EXISTS games;
    DROP TABLE IF EXISTS tiles;
  `);
}