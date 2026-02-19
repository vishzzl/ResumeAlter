const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

// Manually load env vars since we are running this script directly
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = require('dotenv').parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

async function main() {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken) {
        console.error('Missing Turso credentials in .env.local');
        process.exit(1);
    }

    const client = createClient({
        url: tursoUrl,
        authToken: tursoToken,
    });

    const migrationDir = path.join(__dirname, '../drizzle');
    const files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();

    // Get the latest migration file
    const latestMigration = files[files.length - 1];

    if (!latestMigration) {
        console.log('No migration files found.');
        return;
    }

    console.log(`Applying migration: ${latestMigration}`);
    const migrationContent = fs.readFileSync(path.join(migrationDir, latestMigration), 'utf-8');

    // Split valid SQLite statements
    const statements = migrationContent.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

    for (const statement of statements) {
        try {
            await client.execute(statement);
            console.log('Executed statement.');
        } catch (e) {
            console.error('Error executing statement:', e);
            // Ignore "table already exists" or "column already exists" errors if re-running
            if (!e.message.includes('already exists') && !e.message.includes('duplicate column name')) {
                throw e;
            }
        }
    }

    console.log('Migration applied successfully.');
}

main().catch(console.error);
