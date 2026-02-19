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
        const userId = 1; // Assuming admin is ID 1
        console.log(`Migrating existing data to user ID ${userId}...`);

        const appsResult = await client.execute({
            sql: 'UPDATE applications SET user_id = ? WHERE user_id IS NULL',
            args: [userId]
        });
        console.log(`Updated ${appsResult.rowsAffected} applications.`);

        const profilesResult = await client.execute({
            sql: 'UPDATE profiles SET user_id = ? WHERE user_id IS NULL',
            args: [userId]
        });
        console.log(`Updated ${profilesResult.rowsAffected} profiles.`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.close();
    }
}

main();
