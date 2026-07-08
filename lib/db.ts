import postgres from "postgres";

// Cache the connection across hot reloads in dev so we don't open a new
// pool on every file save.
const globalForSql = globalThis as unknown as { sql?: postgres.Sql };

export const sql = globalForSql.sql ?? postgres(process.env.DATABASE_URL!);

if (process.env.NODE_ENV !== "production") {
  globalForSql.sql = sql;
}
