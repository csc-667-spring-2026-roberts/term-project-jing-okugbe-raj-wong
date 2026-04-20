import { Router, type NextFunction, type Request, type Response } from "express";
import { db } from "../db/connection.js";
import { broadcastToRoom } from "../sse.js";

type Player = {
  id: number;
  display_name: string;
  created_at: Date;
};

type CreatePlayerBody = {
  display_name?: string;
  room?: string;
};

const router = Router();

router.post(
  "/",
  async (
    request: Request<Record<string, never>, unknown, CreatePlayerBody>,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { display_name, room } = request.body;

      if (typeof display_name !== "string" || display_name.trim() === "") {
        response.status(400).json({ ok: false, error: "display_name is required" });
        return;
      }

      const roomName = typeof room === "string" && room.trim() !== "" ? room.trim() : "lobby";

      const player = await db.one<Player>(
        "INSERT INTO players(display_name) VALUES($1) RETURNING id, display_name, created_at",
        [display_name.trim()],
      );

      broadcastToRoom(roomName, "player:created", { player });

      response.status(201).json({ ok: true, player });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/",
  async (_request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const players = await db.any<Player>(
        "SELECT id, display_name, created_at FROM players ORDER BY id DESC LIMIT 100",
      );

      response.json({ ok: true, players });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
