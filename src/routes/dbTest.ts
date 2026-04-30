import { Router } from "express";
import { db } from "../db/connection.js";

const router = Router();
console.log("dbTest routes loaded");
//... more debugging...
/*

GET PING; 
Quick test query to show connection works.

 */

router.get("/ping", async (_request, response, next) => {
  try {
    const result = await db.one("SELECT 1 AS ok");
    response.json({ ok: true, result });
  } catch (error) {
    next(error);
  }
});

/*

POST MESSAGE;
Body should be message string
Inserts into test_messages table and returns inserted row. 

 */

router.post("/test-messages", async (request, response, next) => {
  try {
    const { message } = request.body;

    if (typeof message !== "string" || message.trim() === "") {
      response.status(400).json({ ok: false, error: "message is required" });
      return;
    }

    const inserted = await db.one(
      "INSERT INTO test_messages (message) VALUES($1) RETURNING id, message, created_at",
      [message.trim()],
    );

    response.status(201).json({ ok: true, inserted });
  } catch (error) {
    next(error);
  }
});
/*
 
GET MESSAGES;
Returns the 50 most recent messages from test_messages table.

 */
router.get("/test-messages", async (_request, response, next) => {
  try {
    const rows = await db.any(
      "SELECT id, message, created_at FROM test_messages ORDER BY id DESC LIMIT 50",
    );

    response.json({ ok: true, rows });
  } catch (error) {
    next(error);
  }
});

export default router;
