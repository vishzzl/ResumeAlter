import { defineConfig } from 'drizzle-kit';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
    schema: './lib/db/schema.ts',
    out: './drizzle',
    dialect: 'sqlite',
    ...(tursoUrl && tursoToken
        ? {
            driver: 'turso',
            dbCredentials: {
                url: tursoUrl,
                authToken: tursoToken,
            },
        }
        : {
            dbCredentials: {
                url: 'sqlite.db',
            },
        }),
});
