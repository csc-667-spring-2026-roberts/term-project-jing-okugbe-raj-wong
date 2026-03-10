import { Router } from "express";
import { db } from "../db/connection.js";

const router = Router();
console.log("dbTest routes loaded");
//... more debugging...
/*

GET PING; 
Quick test query to show connection works.

 */

router.get("/ping", async (_req, res, next) => {
  try {
    const result = await db.one("SELECT 1 AS ok");
    res.json({ ok: true, result });
  } catch (err) {
    next(err);
  }
});

/*

POST MESSAGE;
Body should be message string
Inserts into test_messages table and returns inserted row. 

 */

router.post("/test-messages", async (req, res, next) => {
  try {
    const { message } = req.body;

    if (typeof message !== "string" || message.trim() === "") {
      res.status(400).json({ ok: false, error: "message is required" });
      return;
    }

    const inserted = await db.one(
      "INSERT INTO test_messages(message) VALUES($1) RETURNING id, message, created_at",
      [message.trim()],
    );

    res.status(201).json({ ok: true, inserted });
    return; // optional, but satisfies “all code paths”
  } catch (err) {
    next(err);
  }
});
/*
 
GET MESSAGES;
Returns the 50 most recent messages from test_messages table.

 */
router.get("/test-messages", async (_req, res, next) => {
  try {
    const rows = await db.any(
      "SELECT id, message, created_at FROM test_messages ORDER BY id DESC LIMIT 50",
    );
    res.json({ ok: true, rows });
  } catch (err) {
    next(err);
  }
});

export default router;
