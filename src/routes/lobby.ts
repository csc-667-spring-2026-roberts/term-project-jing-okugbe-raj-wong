import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { db } from "../db/connection.js";

const router = Router();

router.get("/", requireAuth, (request, response) => {
  const { user } = request.session;

  response.render("lobby", { user });
});
router.get("/games", requireAuth, async (_request, response, next) => {
  try {
    const games = await db.any(
      `SELECT g.id, g.status, g.created_at, u.email AS created_by_email,
              (SELECT COUNT(*)::int FROM game_players WHERE game_id = g.id) AS player_count
         FROM games g
         LEFT JOIN users u ON u.id = g.created_by_user_id
        WHERE g.status = 'waiting'
        ORDER BY g.created_at DESC
        LIMIT 50`,
    );
    response.json({ ok: true, games });
  } catch (error) {
    next(error);
  }
});

export default router;
