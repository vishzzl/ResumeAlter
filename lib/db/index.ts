import * as schema from './schema';

// Dynamically choose between Turso (production) and local SQLite (development)
function createDb() {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (tursoUrl && tursoToken) {
        // Production: use Turso (libSQL)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { drizzle } = require('drizzle-orm/libsql');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createClient } = require('@libsql/client');

        const client = createClient({
            url: tursoUrl,
            authToken: tursoToken,
        });

        console.log('[DB] Connected to Turso');
        return drizzle(client, { schema });
    } else {
        // Development: use local SQLite
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { drizzle } = require('drizzle-orm/better-sqlite3');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Database = require('better-sqlite3');

        const sqlite = new Database('sqlite.db');
        console.log('[DB] Connected to local SQLite');
        return drizzle(sqlite, { schema });
    }
}

export const db = createDb();
