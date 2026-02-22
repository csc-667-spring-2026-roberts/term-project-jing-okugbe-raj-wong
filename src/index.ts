import http, { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";

const PORT = Number(process.env.PORT ?? 8080);
const PUBLIC_DIR = path.resolve(process.cwd(), "public");

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function toBuffer(body?: Buffer | string): Buffer {
  if (body === undefined) return Buffer.alloc(0);
  return Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
}

function send(
  res: ServerResponse,
  statusCode: number,
  headers: Record<string, string>,
  body?: Buffer | string,
): void {
  const buf = toBuffer(body);

  res.statusCode = statusCode;
  res.setHeader("Date", new Date().toUTCString());
  res.setHeader("Connection", "close");

  if (!("Content-Length" in headers)) {
    headers["Content-Length"] = String(buf.length);
  }
  if (!("Content-Type" in headers)) {
    headers["Content-Type"] = "text/plain; charset=utf-8";
  }

  for (const [k, v] of Object.entries(headers)) {
    res.setHeader(k, v);
  }

  res.end(buf);
}

function parseAndResolvePath(rawUrl: string): { absPath?: string; status?: number } {
  const pathname = (rawUrl.split("?")[0] ?? "/").trim();

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return { status: 400 };
  }

  const normalized = decodedPath === "/" ? "/index.html" : decodedPath;

  const absPath = path.resolve(PUBLIC_DIR, "." + normalized);
  if (!absPath.startsWith(PUBLIC_DIR)) {
    return { status: 403 };
  }

  return { absPath };
}

function readRequestBody(
  req: IncomingMessage,
  cb: (err: Error | null, body?: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });
  req.on("end", () => {
    cb(null, Buffer.concat(chunks));
  });
  req.on("error", (err) => {
    cb(err);
  });
}

function handleGet(absPath: string, res: ServerResponse): void {
  fs.stat(absPath, (err, st) => {
    if (err || !st.isFile()) {
      send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found\n");
      return;
    }

    fs.readFile(absPath, (err2, data) => {
      if (err2) {
        send(res, 500, { "Content-Type": "text/plain; charset=utf-8" }, "Internal Server Error\n");
        return;
      }

      send(
        res,
        200,
        {
          "Content-Type": guessContentType(absPath),
          "Content-Length": String(data.length),
        },
        data,
      );
    });
  });
}

function handlePut(absPath: string, req: IncomingMessage, res: ServerResponse): void {
  const parent = path.dirname(absPath);

  fs.stat(parent, (parentErr, parentSt) => {
    if (parentErr || !parentSt.isDirectory()) {
      send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found\n");
      return;
    }

    fs.stat(absPath, (statErr, st) => {
      const existed = !statErr && st.isFile();

      readRequestBody(req, (bodyErr, body) => {
        if (bodyErr || body === undefined) {
          send(
            res,
            500,
            { "Content-Type": "text/plain; charset=utf-8" },
            "Internal Server Error\n",
          );
          return;
        }

        fs.writeFile(absPath, body, (writeErr) => {
          if (writeErr) {
            send(
              res,
              500,
              { "Content-Type": "text/plain; charset=utf-8" },
              "Internal Server Error\n",
            );
            return;
          }
          const code = existed ? 200 : 201;
          send(res, code, { "Content-Type": "text/plain; charset=utf-8" }, "");
        });
      });
    });
  });
}

function handleDelete(absPath: string, res: ServerResponse): void {
  fs.unlink(absPath, (err) => {
    if (err) {
      if ((err).code === "ENOENT") {
        send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found\n");
        return;
      }
      send(res, 500, { "Content-Type": "text/plain; charset=utf-8" }, "Internal Server Error\n");
      return;
    }
    // 204 No Content
    send(res, 204, {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Length": "0",
    });
  });
}

function handler(req: IncomingMessage, res: ServerResponse): void {
  const method = req.method ?? "";
  const rawUrl = req.url ?? "/";

  const parsed = parseAndResolvePath(rawUrl);
  if (parsed.status === 400) {
    send(res, 400, { "Content-Type": "text/plain; charset=utf-8" }, "Bad Request\n");
    return;
  }
  if (parsed.status === 403) {
    send(res, 403, { "Content-Type": "text/plain; charset=utf-8" }, "Forbidden\n");
    return;
  }
  if (!parsed.absPath) {
    send(res, 500, { "Content-Type": "text/plain; charset=utf-8" }, "Internal Server Error\n");
    return;
  }

  if (method === "GET") {
    handleGet(parsed.absPath, res);
    return;
  }

  if (method === "PUT") {
    handlePut(parsed.absPath, req, res);
    return;
  }

  if (method === "DELETE") {
    handleDelete(parsed.absPath, res);
    return;
  }

  send(res, 405, { "Content-Type": "text/plain; charset=utf-8" }, "Method Not Allowed\n");
}

http.createServer(handler).listen(PORT, () => {
  console.log(`Listening on http://localhost:${String(PORT)}`);
  console.log(`Serving from: ${PUBLIC_DIR}`);
});
