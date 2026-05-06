import { Router } from "express";
import { addSseClient, removeSseClient, sendSseEvent } from "../sse.js";

const router = Router();

router.get("/sse", (request, response) => {
  const room =
    typeof request.query.room === "string" && request.query.room.trim() !== ""
      ? request.query.room.trim()
      : "lobby";

  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders();

  response.write("retry: 3000\n\n");

  const clientId = addSseClient(room, response);
  sendSseEvent(response, "sse:connected", { room });

  const heartbeat = setInterval((): void => {
    response.write(": ping\n\n");
  }, 25000);

  request.on("close", (): void => {
    clearInterval(heartbeat);
    removeSseClient(clientId);
    response.end();
  });
});

export default router;
