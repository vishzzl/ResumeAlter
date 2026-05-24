/**
 * Text-native Word Document (.docx) export using the 'docx' library.
 * Generates highly professional, editable, and ATS-friendly resumes.
 */

import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
    ExternalHyperlink,
} from 'docx';

const BODY_FONT = 'Arial';
const HEADING_FONT = 'Arial';

// Helper to parse inline markdown bold (**text**) and plain text
interface TextChunk {
    text: string;
    bold?: boolean;
}

function parseInlineMarkdown(raw: string): TextChunk[] {
    const out: TextChunk[] = [];
    const re = /\*\*(.+?)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    
    while ((m = re.exec(raw)) !== null) {
        if (m.index > last) {
            out.push({ text: raw.slice(last, m.index) });
        }
        out.push({ text: m[1], bold: true });
        last = m.index + m[0].length;
    }
    
    if (last < raw.length) {
        out.push({ text: raw.slice(last) });
    }
    
    return out;
}

// Helper to format a string with optional inline markdown bolding
function createRichTextRuns(raw: string, baseOptions: { size: number; color?: string }): TextRun[] {
    const chunks = parseInlineMarkdown(raw);
    return chunks.map(chunk => new TextRun({
        text: chunk.text,
        bold: chunk.bold ? true : undefined,
        size: baseOptions.size,
        font: BODY_FONT,
        color: baseOptions.color,
    }));
}

// Parse markdown sections
interface Sec {
    heading: string;
    lines: string[];
}

function parseMarkdown(md: string): { header: string[]; secs: Sec[] } {
    const lines = md.split('\n').map(l => l.trimEnd());
    const header: string[] = [];
    const secs: Sec[] = [];
    let cur: Sec | null = null;
    let inHdr = true;

    for (const raw of lines) {
        const t = raw.trim();
        if (!t) {
            if (cur) cur.lines.push('');
            continue;
        }
        if (t.startsWith('# ')) {
            inHdr = true;
            header.push(t.slice(2).trim());
            continue;
        }
        if (t.startsWith('## ')) {
            inHdr = false;
            if (cur) secs.push(cur);
            cur = { heading: t.slice(3).trim(), lines: [] };
            continue;
        }
        if (inHdr && !cur) {
            header.push(t);
        } else if (cur) {
            cur.lines.push(t);
        } else {
            header.push(t);
        }
    }
    if (cur) secs.push(cur);
    return { header, secs };
}

// Parse skills categorizations
function parseCategorizedSkills(rawVal: string): { category: string; items: string }[] {
    const rawItems = rawVal.split(',').map(item => item.trim());
    const result: { category: string; items: string[] }[] = [];
    let currentCat: { category: string; items: string[] } | null = null;
    
    for (const item of rawItems) {
        if (!item) continue;
        
        const catMatch = item.match(/^-{3,}\s*(.+?)\s*-{3,}$/);
        if (catMatch) {
            const catName = catMatch[1].trim();
            currentCat = { category: catName, items: [] };
            result.push(currentCat);
        } else {
            if (!currentCat) {
                currentCat = { category: 'Skills', items: [] };
                result.push(currentCat);
            }
            currentCat.items.push(item);
        }
    }
    
    return result.map(c => ({
        category: c.category,
        items: c.items.join(', '),
    }));
}

// ── Contact Row Builder ───────────────────────────────────────────────────────
function createContactRow(raw: string): Paragraph {
    const parts = raw.split(/\s*\|\s*/);
    const children: any[] = [];
    
    parts.forEach((p, idx) => {
        const trimmed = p.trim();
        if (!trimmed) return;
        
        const mdLink = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (mdLink) {
            const label = mdLink[1];
            const href = mdLink[2].startsWith('http') ? mdLink[2] : `https://${mdLink[2]}`;
            children.push(
                new ExternalHyperlink({
                    children: [
                        new TextRun({
                            text: label,
                            color: '0066cc',
                            underline: {},
                            size: 17, // 8.5pt
                            font: BODY_FONT,
                        }),
                    ],
                    link: href,
                })
            );
        } else if (/^https?:\/\//i.test(trimmed) || trimmed.includes('.com/') || trimmed.includes('.io/')) {
            const href = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
            const domainLabel = trimmed.split('/')[0].replace(/^www\./i, '');
            const prettyLabel = domainLabel.charAt(0).toUpperCase() + domainLabel.slice(1).split('.')[0];
            children.push(
                new ExternalHyperlink({
                    children: [
                        new TextRun({
                            text: prettyLabel,
                            color: '0066cc',
                            underline: {},
                            size: 17,
                            font: BODY_FONT,
                        }),
                    ],
                    link: href,
                })
            );
        } else {
            children.push(
                new TextRun({
                    text: trimmed,
                    size: 17,
                    font: BODY_FONT,
                    color: '333333',
                })
            );
        }
        
        if (idx < parts.length - 1) {
            children.push(
                new TextRun({
                    text: '  |  ',
                    size: 17,
                    font: BODY_FONT,
                    color: '666666',
                })
            );
        }
    });
    
    return new Paragraph({
        children,
        spacing: { after: 100 },
        alignment: AlignmentType.LEFT,
    });
}

// ── Borderless Side-by-Side Row ────────────────────────────────────────────────
function createSideBySideRow(leftText: string, rightText: string, leftBold = true): Table {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 75, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE },
                        },
                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: leftText,
                                        bold: leftBold ? true : undefined,
                                        size: 19, // 9.5pt
                                        font: BODY_FONT,
                                        color: '000000',
                                    }),
                                ],
                                spacing: { after: 40 },
                            }),
                        ],
                    }),
                    new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE },
                        },
                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: rightText,
                                        size: 17, // 8.5pt
                                        font: BODY_FONT,
                                        color: '555555',
                                    }),
                                ],
                                alignment: AlignmentType.RIGHT,
                                spacing: { after: 40 },
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

// ── Main Section Builder ──────────────────────────────────────────────────────
function buildSection(sec: Sec): any[] {
    const els: any[] = [];
    const sectionName = sec.heading;
    
    // 1. Header
    els.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: sectionName.toUpperCase(),
                    bold: true,
                    size: 20, // 10pt
                    font: HEADING_FONT,
                    color: '000000',
                }),
            ],
            border: {
                bottom: {
                    color: '000000',
                    space: 4,
                    style: BorderStyle.SINGLE,
                    size: 8, // 1pt
                },
            },
            spacing: { before: 240, after: 120 },
        })
    );
    
    const lines = sec.lines;
    let i = 0;
    
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) {
            i++;
            continue;
        }
        
        // A. Bullet Points
        if (/^\s*[-•*]\s/.test(line)) {
            const text = line.replace(/^\s*[-•*]\s+/, '').trim();
            els.push(
                new Paragraph({
                    children: createRichTextRuns(text, { size: 18 }), // 9pt
                    bullet: { level: 0 },
                    indent: { left: 240 },
                    spacing: { before: 40, after: 40 },
                })
            );
            i++;
            continue;
        }
        
        // B. Entry Row (Company | Role | Date)
        if (line.includes('**') && line.includes('|')) {
            const parts = line.split('|').map(p => p.trim());
            const stripped = parts.map(p => p.replace(/\*\*/g, '').trim());
            
            if (stripped.length >= 2) {
                const isProjectSec = /project/i.test(sectionName);
                const isCertSec = /certifications/i.test(sectionName);
                
                if (isCertSec) {
                    const certName = stripped[0];
                    const issuer = stripped[1];
                    const date = stripped[2];
                    
                    let certText = certName;
                    if (issuer) certText += ` — ${issuer}`;
                    if (date) certText += ` (${date})`;
                    
                    els.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: certText,
                                    bold: true,
                                    size: 18,
                                    font: BODY_FONT,
                                }),
                            ],
                            bullet: { level: 0 },
                            indent: { left: 240 },
                            spacing: { before: 40, after: 40 },
                        })
                    );
                } else if (stripped.length >= 3) {
                    const title = stripped[0];
                    const subtitle = stripped[1];
                    const rightDetail = stripped[2];
                    
                    els.push(createSideBySideRow(title, rightDetail));
                    
                    if (subtitle) {
                        if (isProjectSec) {
                            els.push(
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: 'Technologies: ', bold: true, size: 18, font: BODY_FONT }),
                                        new TextRun({ text: subtitle, size: 18, font: BODY_FONT, color: '333333' }),
                                    ],
                                    spacing: { after: 60 },
                                })
                            );
                        } else {
                            els.push(
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: subtitle,
                                            bold: true,
                                            size: 18, // 9pt
                                            font: BODY_FONT,
                                            color: '222222',
                                        }),
                                    ],
                                    spacing: { after: 60 },
                                })
                            );
                        }
                    }
                } else {
                    // stripped.length === 2
                    const title = stripped[0];
                    const detail = stripped[1];
                    const isDate = /\d{4}|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(detail);
                    
                    if (isDate) {
                        els.push(createSideBySideRow(title, detail));
                    } else {
                        els.push(createSideBySideRow(title, ''));
                        if (detail) {
                            if (isProjectSec) {
                                els.push(
                                    new Paragraph({
                                        children: [
                                            new TextRun({ text: 'Technologies: ', bold: true, size: 18, font: BODY_FONT }),
                                            new TextRun({ text: detail, size: 18, font: BODY_FONT, color: '333333' }),
                                        ],
                                        spacing: { after: 60 },
                                    })
                                );
                            } else {
                                els.push(
                                    new Paragraph({
                                        children: [
                                            new TextRun({
                                                text: detail,
                                                bold: true,
                                                size: 18,
                                                font: BODY_FONT,
                                                color: '222222',
                                            }),
                                        ],
                                        spacing: { after: 60 },
                                    })
                                );
                            }
                        }
                    }
                }
                
                i++;
                continue;
            }
        }
        
        // C. Client Label
        if (/^\*\*Client:/i.test(line)) {
            const clientVal = line.replace(/^\*\*Client:\*\*/i, '').trim();
            els.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Client: ${clientVal}`,
                            bold: true,
                            size: 17, // 8.5pt
                            font: BODY_FONT,
                            color: '333333',
                        }),
                    ],
                    spacing: { before: 40, after: 40 },
                })
            );
            i++;
            continue;
        }
        
        // D. Skill Rows
        const sm = line.match(/^\*\*([^*]+)\*\*\s*:\s*(.+)$/);
        if (sm) {
            const cat = sm[1];
            const rawVal = sm[2];
            
            if (rawVal.includes('---')) {
                const cats = parseCategorizedSkills(rawVal);
                cats.forEach(c => {
                    els.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: `${c.category}: `, bold: true, size: 18, font: BODY_FONT }),
                                new TextRun({ text: c.items, size: 18, font: BODY_FONT, color: '333333' }),
                            ],
                            spacing: { after: 60 },
                        })
                    );
                });
            } else {
                els.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: `${cat}: `, bold: true, size: 18, font: BODY_FONT }),
                            new TextRun({ text: rawVal, size: 18, font: BODY_FONT, color: '333333' }),
                        ],
                        spacing: { after: 60 },
                    })
                );
            }
            
            i++;
            continue;
        }
        
        // E. Sub-headings (H3)
        if (line.startsWith('### ')) {
            els.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: line.slice(4).trim(),
                            bold: true,
                            size: 19, // 9.5pt
                            font: HEADING_FONT,
                        }),
                    ],
                    spacing: { before: 120, after: 60 },
                })
            );
            i++;
            continue;
        }
        
        // F. Paragraphs (Fallback)
        els.push(
            new Paragraph({
                children: createRichTextRuns(line, { size: 18 }), // 9pt
                spacing: { after: 60 },
            })
        );
        
        i++;
    }
    
    return els;
}

// ── Export Interface ─────────────────────────────────────────────────────────
export interface ExportOptions {
    fileName?: string;
}

export async function exportResumeDOCX(
    resumeMarkdown: string,
    opts: ExportOptions = {}
): Promise<void> {
    const { fileName = 'Resume' } = opts;
    const safeName = fileName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Resume';

    const { header, secs } = parseMarkdown(resumeMarkdown);
    const [name, ...contactLines] = header;

    const children: any[] = [];

    // 1. Header (Large Name)
    if (name) {
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: name,
                        bold: true,
                        size: 40, // 20pt
                        font: HEADING_FONT,
                        color: '000000',
                    }),
                ],
                spacing: { after: 80 },
            })
        );
    }

    // 2. Contact details lines
    contactLines.forEach(l => {
        children.push(createContactRow(l));
    });

    // 3. Header Divider Line
    children.push(
        new Paragraph({
            border: {
                bottom: {
                    color: '000000',
                    space: 4,
                    style: BorderStyle.SINGLE,
                    size: 12, // 1.5pt
                },
            },
            spacing: { after: 120 },
        })
    );

    // 4. Document Sections
    secs.forEach(sec => {
        const secChildren = buildSection(sec);
        children.push(...secChildren);
    });

    // 5. Package Document
    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1080, // 0.75 in
                            bottom: 1080,
                            left: 1080,
                            right: 1080,
                        },
                    },
                },
                children: children,
            },
        ],
    });

    // 6. Generate DOCX Blob & Download
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function buildResumeDOCXBuffer(resumeMarkdown: string): Promise<Buffer> {
    const { header, secs } = parseMarkdown(resumeMarkdown);
    const [name, ...contactLines] = header;

    const children: any[] = [];

    if (name) {
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: name,
                        bold: true,
                        size: 40,
                        font: HEADING_FONT,
                        color: '000000',
                    }),
                ],
                spacing: { after: 80 },
            })
        );
    }

    contactLines.forEach(l => {
        children.push(createContactRow(l));
    });

    children.push(
        new Paragraph({
            border: {
                bottom: {
                    color: '000000',
                    space: 4,
                    style: BorderStyle.SINGLE,
                    size: 12,
                },
            },
            spacing: { after: 120 },
        })
    );

    secs.forEach(sec => {
        const secChildren = buildSection(sec);
        children.push(...secChildren);
    });

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1080,
                            bottom: 1080,
                            left: 1080,
                            right: 1080,
                        },
                    },
                },
                children,
            },
        ],
    });

    return await Packer.toBuffer(doc);
}
