import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { broadcastToRoom } from "../sse.js";

const router = Router();

type DemoGame = {
  id: number;
  status: "waiting" | "started";
  players: string[];
  playedTiles: string[];
};

const demoGames = new Map<number, DemoGame>();
let nextGameId = 1;

router.post("/", requireAuth, (request, response) => {
  const user = request.session.user;

  if (!user) {
    response.redirect("/auth/login");
    return;
  }

  const game: DemoGame = {
    id: nextGameId++,
    status: "waiting",
    players: [user.email],
    playedTiles: [],
  };

  demoGames.set(game.id, game);
  response.redirect(`/games/${String(game.id)}`);
});

router.get("/:id", requireAuth, (request, response) => {
  const gameId = Number(request.params.id);
  const game = demoGames.get(gameId);

  response.render("game", {
    user: request.session.user,
    gameId,
    game,
  });
});

router.post("/:id/join", requireAuth, (request, response) => {
  const gameId = Number(request.params.id);
  const user = request.session.user;

  if (!user) {
    response.redirect("/auth/login");
    return;
  }

  let game = demoGames.get(gameId);

  if (!game) {
    game = {
      id: gameId,
      status: "waiting",
      players: [],
      playedTiles: [],
    };
    demoGames.set(gameId, game);
  }

  if (!game.players.includes(user.email)) {
    game.players.push(user.email);
  }

  broadcastToRoom(`game-${String(gameId)}`, "game:updated", game);
  response.redirect(`/games/${String(gameId)}`);
});

router.post("/:id/start", requireAuth, (request, response) => {
  const gameId = Number(request.params.id);
  const game = demoGames.get(gameId);

  if (!game) {
    response.redirect("/lobby");
    return;
  }

  game.status = "started";

  broadcastToRoom(`game-${String(gameId)}`, "game:updated", game);
  response.redirect(`/games/${String(gameId)}`);
});

router.post("/:id/play", requireAuth, (request, response) => {
  const gameId = Number(request.params.id);
  const body = request.body as { tile?: unknown };

  const tile =
    typeof body.tile === "string" && body.tile.trim() !== ""
      ? body.tile.trim().charAt(0).toUpperCase()
      : "A";
  const game = demoGames.get(gameId);

  if (!game) {
    response.redirect("/lobby");
    return;
  }

  game.playedTiles.push(tile);

  broadcastToRoom(`game-${String(gameId)}`, "game:updated", game);
  response.redirect(`/games/${String(gameId)}`);
});

router.get("/:id/state", requireAuth, (request, response) => {
  const gameId = Number(request.params.id);
  const game = demoGames.get(gameId);

  response.json({
    ok: true,
    game,
  });
});

export default router;
