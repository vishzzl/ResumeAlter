const React = require('react');
const { renderToBuffer } = require('@react-pdf/renderer');
const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Import local compiled resume template to avoid JSX issues in pure Node
const { ResumePDFPage } = require('../lib/resume-pdf-template');
const { formatProfileToMarkdownForPDF } = require('../lib/utils');

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({
  url: tursoUrl,
  authToken: tursoToken,
});

async function run() {
  console.log('Querying Turso database for user_id = 1...');
  try {
    const res = await client.execute({
      sql: 'SELECT * FROM profiles WHERE user_id = ? LIMIT 1',
      args: [1]
    });
    
    if (res.rows.length === 0) {
      console.log('No profile found for user_id = 1');
      return;
    }

    const profile = res.rows[0];
    console.log('Profile retrieved:', profile.name);

    console.log('Formatting profile to Markdown...');
    const resumeMarkdown = formatProfileToMarkdownForPDF(profile);
    console.log('--- Markdown Output ---');
    console.log(resumeMarkdown);
    console.log('-----------------------');

    console.log('Rendering Markdown to PDF...');
    const docElement = React.createElement(ResumePDFPage, { resumeMarkdown });
    const pdfBuffer = await renderToBuffer(docElement);

    const outputPath = path.join(__dirname, 'test-resume.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log('PDF generated successfully at:', outputPath);
    console.log('PDF File size:', pdfBuffer.length, 'bytes');

  } catch (error) {
    console.error('Error during generation:', error);
  } finally {
    client.close();
  }
}

run();
