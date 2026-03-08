import pgPromise from "pg-promise";
import dotenv from "dotenv";

dotenv.config();
const connectionString = process.env.DATABASE_URL;

if(connectionString === undefined) {
    throw "Connection string undefined."
}

const pgp = pgPromise();
const connection = pgp(connectionString);

export default connection;