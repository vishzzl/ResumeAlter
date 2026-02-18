const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

console.log('Adding profiles table...');

try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS profiles (
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
        );
    `);
    console.log('Profiles table created successfully.');
} catch (error) {
    console.error('Error creating table:', error);
}
