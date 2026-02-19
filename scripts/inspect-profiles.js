const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

// Manually load env vars
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

    try {
        console.log('Fetching profiles...');
        const result = await client.execute('SELECT id, certifications FROM profiles');
        console.log('Profiles:', JSON.stringify(result.rows, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.close();
    }
}

main();
