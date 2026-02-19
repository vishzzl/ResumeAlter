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
        console.log('Adding user_id to profiles table...');
        await client.execute('ALTER TABLE profiles ADD user_id integer REFERENCES users(id)');
        console.log('Successfully added user_id to profiles.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.close();
    }
}

main();
