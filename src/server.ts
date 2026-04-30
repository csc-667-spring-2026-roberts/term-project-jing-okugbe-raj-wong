import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import connectPgSimple from "connect-pg-simple";
import session from "express-session";
import livereload from "livereload";
import connectLiveReload from "connect-livereload";
import sseRoutes from "./routes/sse.js";

import authRoutes from "./routes/auth.js";
import playerRoutes from "./routes/players.js";
import homeRoutes from "./routes/home.js";
import testRoutes from "./routes/dbTest.js";
import lobbyRoutes from "./routes/lobby.js";
import loggingMiddleware from "./middleware/logging.js";
import { db } from "./db/connection.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV !== "production") {
  const liveReloadServer = livereload.createServer({ exts: ["ejs", "css", "js"] });

  liveReloadServer.watch([
    path.join(__dirname, "..", "public"),
    path.join(__dirname, "..", "views"),
  ]);

  app.use(connectLiveReload());
}

const PgSession = connectPgSimple(session);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "..", "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(
  session({
    store: new PgSession({ pgPromise: db }),
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(loggingMiddleware);

app.use("/auth", authRoutes);
app.use("/players", playerRoutes);
app.use("/api", sseRoutes);
app.use("/", homeRoutes);
app.use("/test", testRoutes);
app.use("/lobby", lobbyRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${String(PORT)} at ${new Date().toLocaleTimeString()}`);
});
