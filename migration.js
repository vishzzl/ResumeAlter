const sqlite3 = require('better-sqlite3');
const db = sqlite3('sqlite.db');

try {
    console.log('Adding analysis column...');
    db.prepare('ALTER TABLE applications ADD COLUMN analysis text').run();
    console.log('Successfully added analysis column.');
} catch (error) {
    if (error.message.includes('duplicate column name')) {
        console.log('Column already exists.');
    } else {
        console.error('Error adding column:', error);
    }
}
