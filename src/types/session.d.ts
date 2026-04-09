import "express-session";
import { User } from "./types.js";

declare module "express-session" {
    interface SessionData {
        user: User;
    }
}