/**
 * Initialize the Turso database with the application schema.
 * 
 * Run this ONCE after creating your Turso database:
 *   node scripts/init-turso.js
 * 
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local
 */

const fs = require('fs');
const path = require('path');

async function main() {
    // Load .env.local
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        for (const line of envContent.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [key, ...rest] = trimmed.split('=');
                const value = rest.join('=');
                if (value && !process.env[key]) {
                    process.env[key] = value;
                }
            }
        }
    }

    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
        console.error('❌ TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
        process.exit(1);
    }

    const { createClient } = require('@libsql/client');
    const client = createClient({ url, authToken });

    console.log('🔗 Connecting to Turso:', url);

    // Create tables
    const migrations = [
        `CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_url TEXT NOT NULL,
            job_title TEXT,
            company_name TEXT,
            job_description TEXT NOT NULL,
            job_details TEXT,
            base_resume TEXT,
            tailored_resume TEXT,
            status TEXT DEFAULT 'draft',
            analysis TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            date_applied TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            phone TEXT,
            linkedin TEXT,
            website TEXT,
            summary TEXT,
            experience TEXT,
            education TEXT,
            skills TEXT,
            projects TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`
    ];

    for (const sql of migrations) {
        console.log('📦 Running migration...');
        await client.execute(sql);
    }

    console.log('✅ Turso database initialized successfully!');

    // Verify
    const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('📋 Tables:', result.rows.map(r => r.name).join(', '));

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Failed to initialize Turso:', err);
    process.exit(1);
});
