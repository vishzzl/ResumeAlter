import React from 'react';
import { Page, View, Text, Link, StyleSheet } from '@react-pdf/renderer';

// ── Built-in PDF fonts — no registration needed ───────────────────────────────
const F = 'Helvetica';
const FB = 'Helvetica-Bold';

// ── Improved ATS-friendly stylesheet ──────────────────────────────────────────
// Professional typography with clear visual hierarchy and generous spacing.
// Optimized for both readability and ATS parsing.
const S = StyleSheet.create({
    page: {
        fontFamily: F,
        fontSize: 9,
        color: '#000',
        paddingTop: 32,
        paddingBottom: 24,
        paddingHorizontal: 35,
        lineHeight: 1.4,
        backgroundColor: '#ffffff',
    },

    // ── Header ─────────────────────────────────────────────────────────────
    name: {
        fontFamily: FB,
        fontSize: 20,
        color: '#000',
        lineHeight: 1.15,
        marginBottom: 6,
        textAlign: 'left',
        letterSpacing: 0.1,
    },
    contactRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 8,
        fontSize: 8.5,
        color: '#333',
    },
    contactText: { fontFamily: F, color: '#333', fontSize: 8.5 },
    contactLink: { fontFamily: F, color: '#0066cc', fontSize: 8.5, textDecoration: 'none' },
    contactSep: { fontFamily: F, color: '#666', fontSize: 8.5, marginHorizontal: 4 },
    headerRule: { borderBottomWidth: 1.5, borderBottomColor: '#000', marginBottom: 10 },

    // ── Section ────────────────────────────────────────────────────────────
    section: { marginBottom: 10 },
    sectionHead: {
        fontFamily: FB,
        fontSize: 10,
        color: '#000',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        borderBottomWidth: 1.2,
        borderBottomColor: '#000',
        paddingBottom: 3,
        marginBottom: 6,
    },

    // ── Experience / Project entry ──────────────────────────────────────
    entryBlock: { marginBottom: 6 },
    entryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 1.5,
    },
    entryTitle: { fontFamily: FB, fontSize: 9.5, color: '#000', flex: 1, marginRight: 8 },
    entryDate: { fontFamily: F, fontSize: 8.5, color: '#555', textAlign: 'right', flexShrink: 0 },
    entryRole: { fontFamily: FB, fontSize: 9, color: '#222', marginBottom: 3 },
    clientLabel: { fontFamily: FB, fontSize: 8.5, color: '#333', marginTop: 1.5, marginBottom: 1.5 },

    // ── Bullets ────────────────────────────────────────────────────────────
    bulletRow: { flexDirection: 'row', marginBottom: 2.5, paddingLeft: 6 },
    bulletDot: { fontFamily: F, width: 8, fontSize: 9, color: '#000', flexShrink: 0, marginTop: 0, marginRight: 4 },
    bulletText: { fontFamily: F, flex: 1, fontSize: 9, color: '#222', lineHeight: 1.4 },

    // ── Skills ─────────────────────────────────────────────────────────────
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 },
    skillCat: { fontFamily: FB, fontSize: 9, color: '#000', marginRight: 4, marginBottom: 1.5 },
    skillVal: { fontFamily: F, fontSize: 9, color: '#333', flex: 1, marginBottom: 1.5 },

    // ── Paragraph / default ───────────────────────────────────────────────
    para: { fontFamily: F, fontSize: 9, color: '#222', lineHeight: 1.4, marginBottom: 3 },
    inlineBold: { fontFamily: FB },
    subHead: { fontFamily: FB, fontSize: 9.5, color: '#000', marginBottom: 3, marginTop: 3 },
});

// ── Inline parser: **bold**, *bold-fallback*, [link](url) ─────────────────────
interface Span { text: string; bold?: boolean; url?: string; }
function parseInline(raw: string): Span[] {
    const out: Span[] = [];
    const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)]+)\)/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        if (m.index > last) out.push({ text: raw.slice(last, m.index) });
        if (m[1]) out.push({ text: m[1], bold: true });
        else if (m[2]) out.push({ text: m[2], bold: true });
        else if (m[3]) out.push({ text: m[3], url: m[4] });
        last = m.index + m[0].length;
    }
    if (last < raw.length) out.push({ text: raw.slice(last) });
    return out;
}

// ── Skills delimiter parser: splits "--- Category ---, items" into structured chunks ─
function parseCategorizedSkills(rawVal: string): { category: string; items: string }[] {
    const rawItems = rawVal.split(',').map(item => item.trim());
    const result: { category: string; items: string[] }[] = [];
    let currentCat: { category: string; items: string[] } | null = null;
    
    for (const item of rawItems) {
        if (!item) continue;
        
        // Check if item is a category marker, e.g. --- Category Name --- or ---- Category Name ----
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
        items: c.items.join(', ')
    }));
}
function RichText({ raw, style }: { raw: string; style?: any }) {
    return (
        <Text style={style}>
            {parseInline(raw.trim()).map((sp, i) =>
                sp.url
                    ? <Link key={i} src={sp.url} style={S.contactLink}>{sp.text}</Link>
                    : <Text key={i} style={sp.bold ? S.inlineBold : {}}>{sp.text}</Text>
            )}
        </Text>
    );
}

// ── Markdown section parser ───────────────────────────────────────────────────
interface Sec { heading: string; lines: string[]; }
function parse(md: string): { header: string[]; secs: Sec[] } {
    const lines = md.split('\n').map(l => l.trimEnd());
    const header: string[] = [];
    const secs: Sec[] = [];
    let cur: Sec | null = null;
    let inHdr = true;

    for (const raw of lines) {
        const t = raw.trim();
        if (!t) { if (cur) cur.lines.push(''); continue; }
        if (t.startsWith('# ')) { inHdr = true; header.push(t.slice(2).trim()); continue; }
        if (t.startsWith('## ')) { inHdr = false; if (cur) secs.push(cur); cur = { heading: t.slice(3).trim(), lines: [] }; continue; }
        if (inHdr && !cur) header.push(t);
        else if (cur) cur.lines.push(t);
        else header.push(t);
    }
    if (cur) secs.push(cur);
    return { header, secs };
}

// ── Contact row ───────────────────────────────────────────────────────────────
// Handles 4 forms:  [label](url)  |  https://...  |  domain.com/...  |  plain text
const DOMAIN_RE = /^(linkedin|github|gitlab|twitter|x\.com|portfolio|behance|dribbble)\./i;

function ContactRow({ raw }: { raw: string }) {
    const parts = raw.split(/\s*\|\s*/);
    return (
        <View style={S.contactRow}>
            {parts.map((p, i) => {
                const trimmed = p.trim();

                // [Label](url)
                const mdLink = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                if (mdLink) {
                    const href = mdLink[2].startsWith('http') ? mdLink[2] : `https://${mdLink[2]}`;
                    return (
                        <React.Fragment key={i}>
                            <Link src={href} style={S.contactLink}>{mdLink[1]}</Link>
                            {i < parts.length - 1 ? <Text style={S.contactSep}> | </Text> : null}
                        </React.Fragment>
                    );
                }

                // https:// bare URL
                if (/^https?:\/\//i.test(trimmed)) {
                    // Use a short label if it's a known social domain
                    const labelMatch = trimmed.match(/https?:\/\/(www\.)?(linkedin|github|gitlab|twitter|x\.com)\.com[^\s]*/i);
                    const label = labelMatch ? labelMatch[2] : trimmed;
                    return (
                        <React.Fragment key={i}>
                            <Link src={trimmed} style={S.contactLink}>{label}</Link>
                            {i < parts.length - 1 ? <Text style={S.contactSep}> | </Text> : null}
                        </React.Fragment>
                    );
                }

                // Bare domain URL like linkedin.com/in/... or github.com/...
                if (DOMAIN_RE.test(trimmed) || trimmed.includes('.com/') || trimmed.includes('.io/')) {
                    const href = `https://${trimmed}`;
                    // Show a clean label: capitalize the domain name
                    const domainLabel = trimmed.split('/')[0].replace(/^www\./i, '');
                    const prettyLabel = domainLabel.charAt(0).toUpperCase() + domainLabel.slice(1).split('.')[0];
                    return (
                        <React.Fragment key={i}>
                            <Link src={href} style={S.contactLink}>{prettyLabel}</Link>
                            {i < parts.length - 1 ? <Text style={S.contactSep}> | </Text> : null}
                        </React.Fragment>
                    );
                }

                // Plain text (email, phone, location)
                return (
                    <React.Fragment key={i}>
                        <Text style={S.contactText}>{trimmed}</Text>
                        {i < parts.length - 1 ? <Text style={S.contactSep}> | </Text> : null}
                    </React.Fragment>
                );
            })}
        </View>
    );
}

// ── Section body renderer ─────────────────────────────────────────────────────
function Body({ lines, sectionName }: { lines: string[]; sectionName?: string }) {
    const els: React.ReactNode[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }

        // Bullet
        if (/^\s*[-•*]\s/.test(line)) {
            const text = line.replace(/^\s*[-•*]\s+/, '').trim();
            els.push(
                <View key={i} style={S.bulletRow}>
                    <Text style={S.bulletDot}>•</Text>
                    <RichText raw={text} style={S.bulletText} />
                </View>
            );
            i++; continue;
        }

        // Entry line: **Company** | **Role** | **Date** (detected by ** + |)
        if (line.includes('**') && line.includes('|')) {
            const parts = line.split('|').map(p => p.trim());
            const stripped = parts.map(p => p.replace(/\*\*/g, '').trim());
            if (stripped.length >= 2) {
                const isProjectSec = sectionName && /project/i.test(sectionName);
                const isCertSec = sectionName && /certifications/i.test(sectionName);

                if (isCertSec) {
                    const certName = stripped[0];
                    const issuer = stripped[1];
                    const date = stripped[2]; // could be undefined or empty

                    els.push(
                        <View key={i} style={S.bulletRow}>
                            <Text style={S.bulletDot}>•</Text>
                            <Text style={S.bulletText}>
                                <Text style={S.inlineBold}>{certName}</Text>
                                {issuer ? <Text style={{ color: '#444' }}>{` — ${issuer}`}</Text> : null}
                                {date ? <Text style={{ color: '#666', fontSize: 8.5 }}>{` (${date})`}</Text> : null}
                            </Text>
                        </View>
                    );
                } else if (stripped.length >= 3) {
                    const title = stripped[0];
                    const subtitle = stripped[1];
                    const rightDetail = stripped[2];

                    els.push(
                        <View key={i} style={S.entryBlock}>
                            <View style={S.entryTopRow}>
                                <Text style={S.entryTitle}>{title}</Text>
                                {rightDetail ? (
                                    rightDetail.startsWith('http') || rightDetail.includes('.com') || rightDetail.includes('.org') || rightDetail.includes('.io') ? (
                                        <Link src={rightDetail.startsWith('http') ? rightDetail : `https://${rightDetail}`} style={S.contactLink}>
                                            {rightDetail}
                                        </Link>
                                    ) : (
                                        <Text style={S.entryDate}>{rightDetail}</Text>
                                    )
                                ) : null}
                            </View>
                            {subtitle ? (
                                isProjectSec ? (
                                    <View style={S.skillRow}>
                                        <Text style={S.skillCat}>Technologies:</Text>
                                        <Text style={S.skillVal}>{subtitle}</Text>
                                    </View>
                                ) : (
                                    <Text style={S.entryRole}>{subtitle}</Text>
                                )
                            ) : null}
                        </View>
                    );
                } else {
                    // stripped.length === 2
                    const title = stripped[0];
                    const detail = stripped[1];
                    const isDate = /\d{4}|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(detail);

                    if (isDate) {
                        els.push(
                            <View key={i} style={S.entryBlock}>
                                <View style={S.entryTopRow}>
                                    <Text style={S.entryTitle}>{title}</Text>
                                    <Text style={S.entryDate}>{detail}</Text>
                                </View>
                            </View>
                        );
                    } else {
                        els.push(
                            <View key={i} style={S.entryBlock}>
                                <View style={S.entryTopRow}>
                                    <Text style={S.entryTitle}>{title}</Text>
                                </View>
                                {detail ? (
                                    isProjectSec ? (
                                        <View style={S.skillRow}>
                                            <Text style={S.skillCat}>Technologies:</Text>
                                            <Text style={S.skillVal}>{detail}</Text>
                                        </View>
                                    ) : (
                                        <Text style={S.entryRole}>{detail}</Text>
                                    )
                                ) : null}
                            </View>
                        );
                    }
                }
                i++; continue;
            }
        }

        // Client label
        if (/^\*\*Client:/i.test(line)) {
            els.push(<Text key={i} style={S.clientLabel}>{'Client: ' + line.replace(/^\*\*Client:\*\*/i, '').trim()}</Text>);
            i++; continue;
        }

        // Skill row: **Category**: values
        const sm = line.match(/^\*\*([^*]+)\*\*\s*:\s*(.+)$/);
        if (sm) {
            const cat = sm[1];
            const rawVal = sm[2];

            if (rawVal.includes('---')) {
                const cats = parseCategorizedSkills(rawVal);
                cats.forEach((c, index) => {
                    els.push(
                        <View key={`${i}-${index}`} style={S.skillRow}>
                            <Text style={S.skillCat}>{c.category}:</Text>
                            <Text style={S.skillVal}>{c.items}</Text>
                        </View>
                    );
                });
            } else {
                els.push(
                    <View key={i} style={S.skillRow}>
                        <Text style={S.skillCat}>{cat}:</Text>
                        <Text style={S.skillVal}>{rawVal}</Text>
                    </View>
                );
            }
            i++; continue;
        }

        // H3 sub-heading
        if (line.startsWith('### ')) {
            els.push(<Text key={i} style={S.subHead}>{line.slice(4).trim()}</Text>);
            i++; continue;
        }

        // Default paragraph
        els.push(<RichText key={i} raw={line} style={S.para} />);
        i++;
    }
    return <>{els}</>;
}

// ── Page export ───────────────────────────────────────────────────────────────
export function ResumePDFPage({ resumeMarkdown }: { resumeMarkdown: string }) {
    const { header, secs } = parse(resumeMarkdown);
    const [name, ...contactLines] = header;

    return (
        <Page size="A4" style={S.page}>

            {/* ── Header ── */}
            {name ? <Text style={S.name}>{name}</Text> : null}
            {contactLines.map((l, i) => <ContactRow key={i} raw={l} />)}
            <View style={S.headerRule} />

            {/* ── Sections ── */}
            {secs.map((sec, i) => (
                <View key={i} style={S.section} wrap={true}>
                    <Text style={S.sectionHead}>{sec.heading}</Text>
                    <Body lines={sec.lines} sectionName={sec.heading} />
                </View>
            ))}

        </Page>
    );
}
