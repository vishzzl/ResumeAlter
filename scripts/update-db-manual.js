
const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

try {
    const tableInfo = db.prepare("PRAGMA table_info(profiles)").all();
    const hasCertifications = tableInfo.some(col => col.name === 'certifications');

    if (!hasCertifications) {
        console.log("Adding certifications column...");
        db.prepare("ALTER TABLE profiles ADD COLUMN certifications text").run();
        console.log("Column added successfully.");
    } else {
        console.log("certifications column already exists.");
    }

    // Check for cover_letter too while we are at it, just to see
    const appTableInfo = db.prepare("PRAGMA table_info(applications)").all();
    const hasCoverLetter = appTableInfo.some(col => col.name === 'cover_letter');
    console.log("Has cover_letter:", hasCoverLetter);

} catch (err) {
    console.error("Error:", err);
}
