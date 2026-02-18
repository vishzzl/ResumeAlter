const fs = require('fs');
const path = require('path');

async function main() {
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
        console.error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set');
        process.exit(1);
    }

    const { createClient } = require('@libsql/client');
    const client = createClient({ url, authToken });

    console.log('Adding cover_letter column...');
    try {
        await client.execute('ALTER TABLE applications ADD COLUMN cover_letter TEXT');
        console.log('Done! cover_letter column added.');
    } catch (e) {
        if (e.message && e.message.includes('duplicate column')) {
            console.log('Column already exists, skipping.');
        } else {
            throw e;
        }
    }
    process.exit(0);
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
