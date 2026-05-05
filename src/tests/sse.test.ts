import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";


vi.mock("../db/connection.js", () => ({
  db: {
    any: vi.fn().mockResolvedValue([]),
  },
}));

import sseRouter from "../routes/sse.js";
import { broadcastToRoom } from "../sse.js";

let server: http.Server;
let port: number;

beforeAll(async () => {
  const app = express();
  app.use("/api", sseRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

function connectSSE(room: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      `http://localhost:${port}/api/sse?room=${encodeURIComponent(room)}`,
      resolve,
    );
    req.on("error", reject);
  });
}

describe("SSE", () => {
  it("returns text/event-stream content-type", async () => {
    const res = await connectSSE("room-content-type");
    expect(res.headers["content-type"]).toBe("text/event-stream");
    res.destroy();
  });

  it("keeps connection open", async () => {
    const res = await connectSSE("room-keep-alive");
    let ended = false;
    res.on("end", () => {
      ended = true;
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(ended).toBe(false);
    res.destroy();
  });

  it("broadcasts events correctly", async () => {
    const room = "room-broadcast";
    const res = await connectSSE(room);
    const chunks: string[] = [];
    res.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));

    await new Promise((r) => setTimeout(r, 100));
    broadcastToRoom(room, "test:event", { hello: "world" });
    await new Promise((r) => setTimeout(r, 200));

    const data = chunks.join("");
    expect(data).toContain("event: test:event");
    expect(data).toContain('"hello":"world"');
    res.destroy();
  });

  it("broadcasts to multiple clients in the same room", async () => {
    const room = "room-multi";
    const [res1, res2] = await Promise.all([
      connectSSE(room),
      connectSSE(room),
    ]);

    const chunks1: string[] = [];
    const chunks2: string[] = [];
    res1.on("data", (chunk: Buffer) => chunks1.push(chunk.toString()));
    res2.on("data", (chunk: Buffer) => chunks2.push(chunk.toString()));

    await new Promise((r) => setTimeout(r, 100));
    broadcastToRoom(room, "multi:event", { count: 2 });
    await new Promise((r) => setTimeout(r, 200));

    expect(chunks1.join("")).toContain("event: multi:event");
    expect(chunks2.join("")).toContain("event: multi:event");
    res1.destroy();
    res2.destroy();
  });
});