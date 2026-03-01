const { createClient } = require('@libsql/client');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrate() {
    // Check current columns
    const info = await db.execute('PRAGMA table_info(applications)');
    const existingCols = info.rows.map(c => c.name);
    console.log('Existing columns:', existingCols.join(', '));

    const columnsToAdd = [
        { name: 'cover_letter', sql: 'ALTER TABLE applications ADD COLUMN cover_letter TEXT' },
        { name: 'tailor_status', sql: "ALTER TABLE applications ADD COLUMN tailor_status TEXT DEFAULT 'idle'" },
    ];

    for (const col of columnsToAdd) {
        if (existingCols.includes(col.name)) {
            console.log(`- ${col.name} already exists, skipping`);
            continue;
        }
        try {
            await db.execute(col.sql);
            console.log(`✓ Added column: ${col.name}`);
        } catch (e) {
            console.error(`✗ Failed to add ${col.name}:`, e.message);
        }
    }

    // Verify
    const result = await db.execute('PRAGMA table_info(applications)');
    console.log('\nFinal columns:', result.rows.map(c => c.name).join(', '));
}

migrate().catch(console.error);
