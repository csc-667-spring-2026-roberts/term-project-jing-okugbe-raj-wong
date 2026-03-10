import { Router } from "express";
import { db } from "../db/connection.js";

const router = Router();

/*

POST; 
Player creation endpoint.
Body should be display_name string.
Inserts into players table and returns inserted row.

 */
router.post("/", async (_req, res, next) => {
  try {
    const { display_name } = _req.body;

    if (typeof display_name !== "string" || display_name.trim() === "") {
      res.status(400).json({ ok: false, error: "display_name is required" });
      return;
    }

    const player = await db.one(
      "INSERT INTO players(display_name) VALUES($1) RETURNING id, display_name, created_at",
      [display_name.trim()],
    );

    res.status(201).json({ ok: true, player });
  } catch (err) {
    next(err);
  }
});

/**

GET PLAYERS;
Returns the 100 most recent players from players table.

 */
router.get("/", async (_req, res, next) => {
  try {
    const players = await db.any(
      "SELECT id, display_name, created_at FROM players ORDER BY id DESC LIMIT 100",
    );
    res.json({ ok: true, players });
  } catch (err) {
    next(err);
  }
});

export default router;
