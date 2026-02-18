const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

console.log('Adding date_applied column to applications table...');

try {
    db.exec(`
        ALTER TABLE applications ADD COLUMN date_applied TEXT;
    `);
    console.log('Column added successfully.');
} catch (error) {
    if (error.message.includes('duplicate column name')) {
        console.log('Column already exists.');
    } else {
        console.error('Error adding column:', error);
    }
}
