import type { Response } from "express";

type SseClient = {
  id: number;
  room: string;
  response: Response;
};

const clients = new Map<number, SseClient>();
let nextClientId = 1;

export function addSseClient(room: string, response: Response): number {
  const clientId = nextClientId++;
  clients.set(clientId, {
    id: clientId,
    room,
    response,
  });
  return clientId;
}

export function removeSseClient(clientId: number): void {
  clients.delete(clientId);
}

export function sendSseEvent(response: Response, eventName: string, data: unknown): void {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function broadcastToRoom(room: string, eventName: string, data: unknown): void {
  for (const client of clients.values()) {
    if (client.room === room) {
      sendSseEvent(client.response, eventName, data);
    }
  }
}
