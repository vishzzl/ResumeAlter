
const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

try {
    const tableInfo = db.prepare("PRAGMA table_info(applications)").all();
    const hasCol = tableInfo.some(col => col.name === 'selected_certifications');

    if (!hasCol) {
        console.log("Adding selected_certifications column...");
        db.prepare("ALTER TABLE applications ADD COLUMN selected_certifications text").run();
        console.log("Column added successfully.");
    } else {
        console.log("selected_certifications column already exists.");
    }

} catch (err) {
    console.error("Error:", err);
}
