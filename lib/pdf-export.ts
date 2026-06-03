/**
 * Text-native PDF export using @react-pdf/renderer.
 *
 * The exported PDF contains real, selectable text — not a screenshot.
 * ATS systems can parse the full content of the resume.
 *
 * Previous approach (html2canvas → jsPDF) produced image-only PDFs where
 * the text was unreadable by ATS parsers. This replaces it entirely.
 */

import React from 'react';
import { Document, pdf } from '@react-pdf/renderer';
import { ResumePDFPage } from './resume-pdf-template';
import type { DocumentProps } from '@react-pdf/renderer';

export interface ExportOptions {
    fileName?: string;
    template?: 'modern' | 'classic' | 'minimal' | 'executive' | 'tech' | 'creative' | 'emerald';
}

/**
 * Generate a text-native PDF from a Markdown resume string and trigger download.
 *
 * @param resumeMarkdown  The tailored resume in Markdown format.
 * @param opts            Optional overrides (file name, template etc.)
 */
export async function exportResumePDF(
    resumeMarkdown: string,
    opts: ExportOptions = {},
): Promise<void> {
    const { fileName = 'Resume', template = 'modern' } = opts;
    const safeName = fileName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Resume';

    // Build the document element — typed as ReactElement<DocumentProps>
    // so @react-pdf/renderer's pdf() function accepts it without type errors.
    const docElement = React.createElement(
        Document,
        null,
        React.createElement(ResumePDFPage, { resumeMarkdown, template })
    ) as React.ReactElement<DocumentProps>;

    // Generate PDF blob
    const blob = await pdf(docElement).toBlob();

    // Trigger browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
