import { Store } from "../src/store.js";
import { Pool } from "pg";
if (!process.env.DATABASE_URL)
  throw new Error(
    "Set DATABASE_URL in .env before seeding. The demo seed must target the same persistent database as the server.",
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const store = new Store(pool);
  const result = await store.seed();
  console.log(
    `Loaded ${result.tasks.length} reproducible scenario tasks into development user local-user.`,
  );
} finally {
  await pool.end();
}
