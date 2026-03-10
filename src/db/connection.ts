import pgPromise from "pg-promise";
import dotenv from "dotenv";

dotenv.config();
const pgp = pgPromise({});
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  throw new Error("Connection string undefined. Invalid db connection URL.");
}
export const db = pgp(DB_URL);
