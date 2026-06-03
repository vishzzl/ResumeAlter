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

// ── Design Tokens per Template Style ──────────────────────────────────────────
interface TemplateTokens {
    headingFont: string;
    bodyFont: string;
    primaryColor: string; // hex
    secondaryColor: string; // hex
    nameSize: number; // in half-points (40 = 20pt)
    headingSize: number; // in half-points (20 = 10pt)
    roleSize: number; // (18 = 9pt)
    bodySize: number; // (18 = 9pt)
    margin: { top: number; bottom: number; left: number; right: number }; // dxa (1440 = 1 in, 1080 = 0.75 in)
    centerHeader: boolean;
    headerSeparator: boolean;
    borderAccent: 'none' | 'bottom' | 'left';
}

const TOKENS: Record<string, TemplateTokens> = {
    modern: {
        headingFont: 'Arial',
        bodyFont: 'Arial',
        primaryColor: '000000',
        secondaryColor: '333333',
        nameSize: 40,
        headingSize: 20,
        roleSize: 18,
        bodySize: 18,
        margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        centerHeader: false,
        headerSeparator: true,
        borderAccent: 'bottom',
    },
    classic: {
        headingFont: 'Times New Roman',
        bodyFont: 'Times New Roman',
        primaryColor: '000000',
        secondaryColor: '444444',
        nameSize: 42,
        headingSize: 21,
        roleSize: 18,
        bodySize: 18,
        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        centerHeader: true,
        headerSeparator: true,
        borderAccent: 'bottom',
    },
    minimal: {
        headingFont: 'Arial',
        bodyFont: 'Arial',
        primaryColor: '0f172a',
        secondaryColor: '475569',
        nameSize: 36,
        headingSize: 18,
        roleSize: 17,
        bodySize: 17,
        margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        centerHeader: true,
        headerSeparator: false,
        borderAccent: 'none',
    },
    executive: {
        headingFont: 'Georgia',
        bodyFont: 'Georgia',
        primaryColor: '1E3A8A', // Deep corporate navy
        secondaryColor: '334155',
        nameSize: 44,
        headingSize: 21,
        roleSize: 18,
        bodySize: 18,
        margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        centerHeader: true,
        headerSeparator: true,
        borderAccent: 'bottom',
    },
    tech: {
        headingFont: 'Consolas', // Monospace headings
        bodyFont: 'Calibri', // Elegant sans body
        primaryColor: '0F172A',
        secondaryColor: '4F46E5', // Indigo details
        nameSize: 40,
        headingSize: 19,
        roleSize: 18,
        bodySize: 18,
        margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        centerHeader: false,
        headerSeparator: true,
        borderAccent: 'left', // Blue left highlight
    },
    creative: {
        headingFont: 'Arial',
        bodyFont: 'Arial',
        primaryColor: '0D9488', // Teal
        secondaryColor: '475569',
        nameSize: 40,
        headingSize: 19,
        roleSize: 18,
        bodySize: 18,
        margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        centerHeader: true,
        headerSeparator: true,
        borderAccent: 'left', // Teal left highlight
    },
    emerald: {
        headingFont: 'Georgia',
        bodyFont: 'Georgia',
        primaryColor: '065F46', // Emerald
        secondaryColor: '334155',
        nameSize: 44,
        headingSize: 21,
        roleSize: 18,
        bodySize: 18,
        margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        centerHeader: true,
        headerSeparator: true,
        borderAccent: 'bottom',
    },
    elegant: {
        headingFont: 'Georgia',
        bodyFont: 'Georgia',
        primaryColor: '881337', // Burgundy
        secondaryColor: '4C0519',
        nameSize: 42,
        headingSize: 21,
        roleSize: 18,
        bodySize: 18,
        margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        centerHeader: true,
        headerSeparator: true,
        borderAccent: 'bottom',
    },
    slate: {
        headingFont: 'Arial',
        bodyFont: 'Arial',
        primaryColor: '1E293B', // Slate
        secondaryColor: '475569',
        nameSize: 40,
        headingSize: 20,
        roleSize: 18,
        bodySize: 18,
        margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        centerHeader: false,
        headerSeparator: true,
        borderAccent: 'bottom',
    },
    startup: {
        headingFont: 'Arial',
        bodyFont: 'Arial',
        primaryColor: '7C3AED', // Violet 600
        secondaryColor: '4C1D95', // Violet 900
        nameSize: 46,
        headingSize: 21,
        roleSize: 19,
        bodySize: 18,
        margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        centerHeader: true,
        headerSeparator: false,
        borderAccent: 'bottom',
    },
    banking: {
        headingFont: 'Times New Roman',
        bodyFont: 'Times New Roman',
        primaryColor: '000000',
        secondaryColor: '000000',
        nameSize: 42,
        headingSize: 21,
        roleSize: 17,
        bodySize: 17,
        margin: { top: 720, bottom: 720, left: 900, right: 900 },
        centerHeader: true,
        headerSeparator: false,
        borderAccent: 'bottom',
    },
    academia: {
        headingFont: 'Georgia',
        bodyFont: 'Georgia',
        primaryColor: '000000',
        secondaryColor: '1F2937',
        nameSize: 44,
        headingSize: 22,
        roleSize: 19,
        bodySize: 19,
        margin: { top: 1200, bottom: 1200, left: 1260, right: 1260 }, // wide margins
        centerHeader: true,
        headerSeparator: true,
        borderAccent: 'bottom',
    },
};

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
function createRichTextRuns(raw: string, baseOptions: { size: number; color?: string; font: string }): TextRun[] {
    const chunks = parseInlineMarkdown(raw);
    return chunks.map(chunk => new TextRun({
        text: chunk.text,
        bold: chunk.bold ? true : undefined,
        size: baseOptions.size,
        font: baseOptions.font,
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
function createContactRow(raw: string, t: TemplateTokens): Paragraph {
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
                            color: t.secondaryColor === '333333' ? '0066cc' : t.primaryColor,
                            underline: {},
                            size: t.bodySize - 1, // slightly smaller than body
                            font: t.headingFont === 'Consolas' ? 'Consolas' : t.bodyFont,
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
                            color: t.secondaryColor === '333333' ? '0066cc' : t.primaryColor,
                            underline: {},
                            size: t.bodySize - 1,
                            font: t.headingFont === 'Consolas' ? 'Consolas' : t.bodyFont,
                        }),
                    ],
                    link: href,
                })
            );
        } else {
            children.push(
                new TextRun({
                    text: trimmed,
                    size: t.bodySize - 1,
                    font: t.bodyFont,
                    color: t.secondaryColor,
                })
            );
        }
        
        if (idx < parts.length - 1) {
            children.push(
                new TextRun({
                    text: ' | ',
                    size: t.bodySize - 1,
                    font: t.bodyFont,
                    color: '666666',
                })
            );
        }
    });
    
    return new Paragraph({
        children,
        spacing: { after: 100 },
        alignment: t.centerHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
    });
}

// ── Borderless Side-by-Side Row ────────────────────────────────────────────────
function createSideBySideRow(leftText: string, rightText: string, t: TemplateTokens, leftBold = true): Table {
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
                                        size: t.roleSize + 1, // slightly larger
                                        font: t.bodyFont,
                                        color: t.primaryColor,
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
                                        size: t.bodySize - 1,
                                        font: t.headingFont === 'Consolas' ? 'Consolas' : t.bodyFont,
                                        color: t.headingFont === 'Consolas' ? t.secondaryColor : '555555',
                                        bold: t.headingFont === 'Consolas' ? true : undefined,
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
function buildSection(sec: Sec, t: TemplateTokens): any[] {
    const els: any[] = [];
    const sectionName = sec.heading;
    
    // 1. Header with Template Specific borders/accents
    els.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: sectionName.toUpperCase(),
                    bold: true,
                    size: t.headingSize,
                    font: t.headingFont,
                    color: t.primaryColor,
                }),
            ],
            border: t.borderAccent === 'bottom' ? {
                bottom: {
                    color: t.primaryColor,
                    space: 4,
                    style: BorderStyle.SINGLE,
                    size: 8, // 1pt
                },
            } : t.borderAccent === 'left' ? {
                left: {
                    color: t.secondaryColor,
                    space: 6,
                    style: BorderStyle.SINGLE,
                    size: 24, // 3pt left border highlight
                }
            } : undefined,
            indent: t.borderAccent === 'left' ? { left: 120 } : undefined,
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
                    children: createRichTextRuns(text, { size: t.bodySize, font: t.bodyFont }),
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
                                    size: t.bodySize,
                                    font: t.bodyFont,
                                    color: t.primaryColor,
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
                    
                    els.push(createSideBySideRow(title, rightDetail, t));
                    
                    if (subtitle) {
                        if (isProjectSec) {
                            els.push(
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: 'Technologies: ', bold: true, size: t.bodySize, font: t.headingFont === 'Consolas' ? 'Consolas' : t.bodyFont, color: t.headingFont === 'Consolas' ? t.secondaryColor : t.primaryColor }),
                                        new TextRun({ text: subtitle, size: t.bodySize, font: t.bodyFont, color: t.secondaryColor }),
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
                                            size: t.bodySize,
                                            font: t.bodyFont,
                                            color: t.secondaryColor,
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
                        els.push(createSideBySideRow(title, detail, t));
                    } else {
                        els.push(createSideBySideRow(title, '', t));
                        if (detail) {
                            if (isProjectSec) {
                                els.push(
                                    new Paragraph({
                                        children: [
                                            new TextRun({ text: 'Technologies: ', bold: true, size: t.bodySize, font: t.headingFont === 'Consolas' ? 'Consolas' : t.bodyFont, color: t.headingFont === 'Consolas' ? t.secondaryColor : t.primaryColor }),
                                            new TextRun({ text: detail, size: t.bodySize, font: t.bodyFont, color: t.secondaryColor }),
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
                                                size: t.bodySize,
                                                font: t.bodyFont,
                                                color: t.secondaryColor,
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
                            size: t.bodySize - 1,
                            font: t.bodyFont,
                            color: t.secondaryColor,
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
                                new TextRun({ text: `${c.category}: `, bold: true, size: t.bodySize, font: t.headingFont === 'Consolas' ? 'Consolas' : t.bodyFont, color: t.headingFont === 'Consolas' ? t.secondaryColor : t.primaryColor }),
                                new TextRun({ text: c.items, size: t.bodySize, font: t.bodyFont, color: t.secondaryColor }),
                            ],
                            spacing: { after: 60 },
                        })
                    );
                });
            } else {
                els.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: `${cat}: `, bold: true, size: t.bodySize, font: t.headingFont === 'Consolas' ? 'Consolas' : t.bodyFont, color: t.headingFont === 'Consolas' ? t.secondaryColor : t.primaryColor }),
                            new TextRun({ text: rawVal, size: t.bodySize, font: t.bodyFont, color: t.secondaryColor }),
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
                            size: t.roleSize + 1,
                            font: t.headingFont,
                            color: t.primaryColor,
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
                children: createRichTextRuns(line, { size: t.bodySize, font: t.bodyFont }),
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
    template?: 'modern' | 'classic' | 'minimal' | 'executive' | 'tech' | 'creative' | 'emerald' | 'elegant' | 'slate' | 'startup' | 'banking' | 'academia';
}

export async function exportResumeDOCX(
    resumeMarkdown: string,
    opts: ExportOptions = {}
): Promise<void> {
    const { fileName = 'Resume', template = 'modern' } = opts;
    const safeName = fileName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Resume';

    const { header, secs } = parseMarkdown(resumeMarkdown);
    const [name, ...contactLines] = header;

    const children: any[] = [];
    const t = TOKENS[template] || TOKENS.modern;

    // 1. Header (Large Name)
    if (name) {
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: name,
                        bold: true,
                        size: t.nameSize,
                        font: t.headingFont,
                        color: t.primaryColor,
                    }),
                ],
                alignment: t.centerHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
                spacing: { after: 80 },
            })
        );
    }

    // 2. Contact details lines
    contactLines.forEach(l => {
        children.push(createContactRow(l, t));
    });

    // 3. Header Divider Line
    if (t.headerSeparator) {
        children.push(
            new Paragraph({
                border: {
                    bottom: {
                        color: t.primaryColor,
                        space: 4,
                        style: BorderStyle.SINGLE,
                        size: 12, // 1.5pt
                    },
                },
                spacing: { after: 120 },
            })
        );
    } else {
        children.push(
            new Paragraph({
                spacing: { after: 120 },
            })
        );
    }

    // 4. Document Sections
    secs.forEach(sec => {
        const secChildren = buildSection(sec, t);
        children.push(...secChildren);
    });

    // 5. Package Document
    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: t.margin,
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
    const t = TOKENS.modern; // Default buffer export (e.g. backend/migration) uses Modern

    if (name) {
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: name,
                        bold: true,
                        size: t.nameSize,
                        font: t.headingFont,
                        color: t.primaryColor,
                    }),
                ],
                spacing: { after: 80 },
            })
        );
    }

    contactLines.forEach(l => {
        children.push(createContactRow(l, t));
    });

    children.push(
        new Paragraph({
            border: {
                bottom: {
                    color: t.primaryColor,
                    space: 4,
                    style: BorderStyle.SINGLE,
                    size: 12,
                },
            },
            spacing: { after: 120 },
        })
    );

    secs.forEach(sec => {
        const secChildren = buildSection(sec, t);
        children.push(...secChildren);
    });

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: t.margin,
                    },
                },
                children,
            },
        ],
    });

    return await Packer.toBuffer(doc);
}
