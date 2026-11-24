import pg from "pg";
import { SQL, queryValues } from "./queries.js";

export function databaseRepository(config) {
  const pool = new pg.Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.poolSize,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    query_timeout: 16000,
    application_name: "teslamate-mobile",
    ssl: config.ssl ? { rejectUnauthorized: true } : false,
  });
  return {
    async ready() {
      await pool.query("SELECT id FROM cars LIMIT 1");
      return true;
    },
    async close() {
      await pool.end();
    },
    async cars() {
      return (await pool.query(SQL.cars)).rows;
    },
    async report(name, params) {
      if (!SQL[name]) throw new Error(`Unknown report: ${name}`);
      return (
        await pool.query({
          text: SQL[name],
          values: queryValues(name, params, config.homeIds),
        })
      ).rows;
    },
  };
}
