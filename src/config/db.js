import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

const { DATABASE_URL, PGUSER, PGPASSWORD, PGHOST, PGDATABASE } = process.env;

const connectionString =
	DATABASE_URL ??
	(PGUSER && PGPASSWORD && PGHOST && PGDATABASE
		? `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}/${PGDATABASE}`
		: null);

if (!connectionString) {
	console.error(
		"Missing database connection configuration. Set `DATABASE_URL` or PGUSER/PGPASSWORD/PGHOST/PGDATABASE in .env"
	);
	process.exit(1);
}

export const sql = neon(connectionString);