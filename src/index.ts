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

function send(
  res: ServerResponse,
  statusCode: number,
  headers: Record<string, string>,
  body?: Buffer | string,
): void {
  res.statusCode = statusCode;
  res.setHeader("Date", new Date().toUTCString());
  res.setHeader("Connection", "close");

  for (const [k, v] of Object.entries(headers)) {
    res.setHeader(k, v);
  }

  res.end(body);
}

function handler(req: IncomingMessage, res: ServerResponse): void {
  const method = req.method ?? "";
  const rawUrl = req.url ?? "/";

  if (method !== "GET") {
    send(res, 405, { "Content-Type": "text/plain; charset=utf-8" }, "Method Not Allowed\n"); return;
  }

  const pathname = (rawUrl.split("?")[0] ?? "/").trim();

  const requestPath = pathname === "/" ? "/index.html" : pathname;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    send(res, 400, { "Content-Type": "text/plain; charset=utf-8" }, "Bad Request\n"); return;
  }

  const absPath = path.resolve(PUBLIC_DIR, "." + decodedPath);
  if (!absPath.startsWith(PUBLIC_DIR)) {
    send(res, 403, { "Content-Type": "text/plain; charset=utf-8" }, "Forbidden\n"); return;
  }

  fs.stat(absPath, (err, st) => {
    if (err || !st.isFile()) {
      send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found\n"); return;
    }

    fs.readFile(absPath, (err2, data) => {
      if (err2) {
        send(
          res,
          500,
          { "Content-Type": "text/plain; charset=utf-8" },
          "Internal Server Error\n",
        ); return;
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

http.createServer(handler).listen(PORT, () => {
  console.log(`Listening on http://localhost:${String(PORT)}`);
  console.log(`Serving from: ${PUBLIC_DIR}`);
});
