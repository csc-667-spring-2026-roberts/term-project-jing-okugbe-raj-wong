import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { broadcastToRoom } from "../sse.js";
import {
  createGame,
  joinGame,
  startGame,
  playWord,
  passTurn,
  getGameState,
  getPlayerRack,
} from "../db/games.js";

const router = Router();

router.post("/", requireAuth, async (request, response, next) => {
  try {
    const user = request.session.user;
    if (!user) {
      response.redirect("/auth/login");
      return;
    }
    const game = await createGame(user.id);

    // Tell the lobby a new game appeared
    broadcastToRoom("lobby", "lobby:game-created", {
      id: game.id,
      created_by_email: user.email,
      status: game.status,
      created_at: game.created_at,
    });

    response.redirect(`/games/${String(game.id)}`);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireAuth, async (request, response, next) => {
  try {
    const user = request.session.user;
    if (!user) {
      response.redirect("/auth/login");
      return;
    }
    const gameId = Number(request.params.id);
    const state = await getGameState(gameId);
    if (!state) {
      response.redirect("/lobby");
      return;
    }
    const rack = await getPlayerRack(gameId, user.id);
    const errorMessage = typeof request.query.error === "string" ? request.query.error : null;
    response.render("game", {
      user,
      gameId,
      game: state,
      rack,
      errorMessage,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/join", requireAuth, async (request, response) => {
  const gameId = Number(request.params.id);

  try {
    const user = request.session.user;
    if (!user) {
      response.redirect("/auth/login");
      return;
    }

    await joinGame(gameId, user.id);

    const state = await getGameState(gameId);
    broadcastToRoom(`game-${String(gameId)}`, "game:updated", state);

    response.redirect(`/games/${String(gameId)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to join game";
    response.redirect(`/games/${String(gameId)}?error=${encodeURIComponent(message)}`);
  }
});

router.post("/:id/start", requireAuth, async (request, response) => {
  try {
    const gameId = Number(request.params.id);
    await startGame(gameId);
    const state = await getGameState(gameId);
    broadcastToRoom(`game-${String(gameId)}`, "game:updated", state);
    response.redirect(`/games/${String(gameId)}`);
  } catch (error) {
    // For form-submit, redirect back to the game with the error in a flash-style query
    const message = error instanceof Error ? error.message : "Failed to start game";
    const gameId = Number(request.params.id);
    response.redirect(`/games/${String(gameId)}?error=${encodeURIComponent(message)}`);
  }
});
router.post("/:id/play", requireAuth, async (request, response) => {
  try {
    const user = request.session.user;
    if (!user) {
      response.status(401).json({ ok: false, error: "Not logged in" });
      return;
    }
    const gameId = Number(request.params.id);
    const body = request.body as { placements?: unknown };

    if (!Array.isArray(body.placements) || body.placements.length === 0) {
      response.status(400).json({ ok: false, error: "placements array required" });
      return;
    }

    const placements = (
      body.placements as { player_tile_id: unknown; row: unknown; col: unknown }[]
    ).map((p) => ({
      player_tile_id: Number(p.player_tile_id),
      row: Number(p.row),
      col: Number(p.col),
    }));

    for (const p of placements) {
      if (
        !Number.isFinite(p.player_tile_id) ||
        !Number.isFinite(p.row) ||
        !Number.isFinite(p.col)
      ) {
        response.status(400).json({ ok: false, error: "Invalid placement data" });
        return;
      }
    }

    await playWord(gameId, user.id, placements);
    const state = await getGameState(gameId);
    broadcastToRoom(`game-${String(gameId)}`, "game:updated", state);
    response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to play word";
    response.status(400).json({ ok: false, error: message });
  }
});

router.post("/:id/pass", requireAuth, async (request, response) => {
  try {
    const user = request.session.user;
    if (!user) {
      response.status(401).json({ ok: false, error: "Not logged in" });
      return;
    }
    const gameId = Number(request.params.id);
    await passTurn(gameId, user.id);
    const state = await getGameState(gameId);
    broadcastToRoom(`game-${String(gameId)}`, "game:updated", state);
    response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to pass turn";
    response.status(400).json({ ok: false, error: message });
  }
});

router.get("/:id/state", requireAuth, async (request, response, next) => {
  try {
    const user = request.session.user;
    if (!user) {
      response.redirect("/auth/login");
      return;
    }
    const gameId = Number(request.params.id);
    const state = await getGameState(gameId);
    if (!state) {
      response.status(404).json({ ok: false, error: "Game not found" });
      return;
    }
    const rack = await getPlayerRack(gameId, user.id);
    response.json({ ok: true, game: state, rack });
  } catch (error) {
    next(error);
  }
});

export default router;
