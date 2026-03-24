import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-serverless";
import {neonConfig, Pool} from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);