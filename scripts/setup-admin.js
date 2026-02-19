const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load env vars
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = require('dotenv').parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

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

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    console.log('--- Setup Admin Account ---');
    const email = await question('Enter admin email: ');
    const password = await question('Enter admin password: ');
    const confirmPassword = await question('Confirm password: ');

    if (password !== confirmPassword) {
        console.error('Passwords do not match.');
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        // Create user
        const result = await client.execute({
            sql: 'INSERT INTO users (email, password, role, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) RETURNING id',
            args: [email, hashedPassword, 'admin']
        });

        const userId = result.rows[0].id; // id is integer
        console.log(`Admin user created with ID: ${userId}`);

        // Update existing data
        console.log('Migrating existing data to admin user...');

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
        console.error('Error during setup:', e);
    } finally {
        rl.close();
        client.close();
    }
}

main();
