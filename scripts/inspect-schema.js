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
        console.log('--- Profiles Table Info ---');
        const profilesInfo = await client.execute('PRAGMA table_info(profiles)');
        console.table(profilesInfo.rows);

        console.log('\n--- Applications Table Info ---');
        const appsInfo = await client.execute('PRAGMA table_info(applications)');
        console.table(appsInfo.rows);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.close();
    }
}

main();
