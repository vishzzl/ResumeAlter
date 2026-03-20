const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

async function main() {
    // If not on Vercel, try to load .env.local fallback
    if (!process.env.VERCEL) {
        const envPath = path.resolve(__dirname, '../.env.local');
        if (fs.existsSync(envPath)) {
            const envConfig = require('dotenv').parse(fs.readFileSync(envPath));
            for (const k in envConfig) {
                if (!process.env[k]) process.env[k] = envConfig[k];
            }
        }
    }

    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken) {
        console.log('Skipping Turso migration: Missing credentials in environment.');
        return;
    }

    console.log(`📡 Connecting to Turso database: ${tursoUrl}`);
    const client = createClient({
        url: tursoUrl,
        authToken: tursoToken,
    });

    const migrationDir = path.join(__dirname, '../drizzle');
    const files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();

    console.log(`📦 Found ${files.length} migration files.`);

    for (const file of files) {
        console.log(`\n⏳ Applying migration: ${file}`);
        const migrationContent = fs.readFileSync(path.join(migrationDir, file), 'utf-8');

        // Split valid SQLite statements
        const statements = migrationContent.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

        for (const statement of statements) {
            try {
                await client.execute(statement);
                console.log(`   ✓ Executed statement`);
            } catch (e) {
                const isAlreadyExists =
                    e.message.includes('already exists') ||
                    e.message.includes('duplicate column name');

                if (isAlreadyExists) {
                    console.log(`   ⏭️ Skipped (Already applied)`);
                } else {
                    console.error(`   ❌ Error executing statement:`, e.message);
                    console.error(`   Statement: ${statement}`);
                    throw e; // Fail the build if it's a real error
                }
            }
        }
    }

    console.log('\n✅ All migrations processed successfully!');
}

main().catch(e => {
    console.error('Migration failed completely:', e);
    process.exit(1);
});
