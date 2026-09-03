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

const client = createClient({
    url: tursoUrl || 'file:sqlite.db',
    ...(tursoToken ? { authToken: tursoToken } : {}),
});

async function resetPassword(email, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await client.execute({
        sql: 'UPDATE users SET password = ? WHERE email = ?',
        args: [hashedPassword, email.trim()]
    });

    if (result.rowsAffected > 0) {
        console.log(`\n✅ Password successfully updated for "${email}".`);
    } else {
        console.log(`\n⚠️ User with email "${email}" was not found in database.`);
        
        // List existing users to help user find correct email
        const usersList = await client.execute({ sql: 'SELECT id, email, role FROM users' });
        if (usersList.rows.length > 0) {
            console.log('\nExisting registered accounts in DB:');
            usersList.rows.forEach(u => console.log(` - ID: ${u.id} | Email: ${u.email} | Role: ${u.role}`));
        } else {
            console.log('\nNo registered users found in the database. Run `node scripts/setup-admin.js` to create an admin account.');
        }
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length >= 2) {
        const email = args[0];
        const newPassword = args[1];
        await resetPassword(email, newPassword);
        client.close();
        process.exit(0);
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    console.log('--- Reset User Password ---');
    const email = await question('Enter user email: ');
    const newPassword = await question('Enter new password: ');

    if (!email.trim() || !newPassword.trim()) {
        console.error('Error: Email and password are required.');
        rl.close();
        client.close();
        process.exit(1);
    }

    await resetPassword(email, newPassword);
    rl.close();
    client.close();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
