import { Router } from "express";
import { db } from "../db/connection.js";
import { addSseClient, removeSseClient, sendSseEvent } from "../sse.js";

const router = Router();

router.get("/sse", async (request, response, next) => {
  try {
    const room =
      typeof request.query.room === "string" && request.query.room.trim() !== ""
        ? request.query.room.trim()
        : "lobby";

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");

    const clientId = addSseClient(room, response);

    const players = await db.any(
      "SELECT id, display_name, created_at FROM players ORDER BY id DESC LIMIT 100",
    );

    sendSseEvent(response, "players:init", { room, players });

    const heartbeat = setInterval(() => {
      response.write(": ping\n\n");
    }, 25000);

    request.on("close", () => {
      clearInterval(heartbeat);
      removeSseClient(clientId);
      response.end();
    });
  } catch (error) {
    next(error);
  }
});

export default router;
