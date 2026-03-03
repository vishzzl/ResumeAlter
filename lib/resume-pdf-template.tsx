'use client';

import React from 'react';
import { Page, View, Text, Link, StyleSheet } from '@react-pdf/renderer';

// ── Built-in PDF fonts — no registration needed ───────────────────────────────
const F = 'Helvetica';
const FB = 'Helvetica-Bold';

// ── Fixed compact stylesheet ──────────────────────────────────────────────────
// Sized and spaced to fit a typical 1-page ATS resume on A4.
// Tailored resumes are already concise — we don't need to dynamically scale.
// If content somehow overflows, wrap={false} on sections prevents mid-section splits.
const S = StyleSheet.create({
    page: {
        fontFamily: F,
        fontSize: 8.5,
        color: '#111',
        paddingTop: 28,
        paddingBottom: 24,
        paddingHorizontal: 38,
        lineHeight: 1.35,
        backgroundColor: '#ffffff',
    },

    // ── Header ─────────────────────────────────────────────────────────────
    name: {
        fontFamily: FB,
        fontSize: 18,
        color: '#0f0f0f',
        letterSpacing: 0.4,
        marginBottom: 4,
    },
    contactRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: 8,
        fontSize: 7.5,
        color: '#444',
    },
    contactText: { fontFamily: F, color: '#444', fontSize: 7.5 },
    contactLink: { fontFamily: F, color: '#1d4ed8', fontSize: 7.5, textDecoration: 'none' },
    contactSep: { fontFamily: F, color: '#bbb', fontSize: 7.5, marginHorizontal: 3 },
    headerRule: { borderBottomWidth: 1, borderBottomColor: '#111', marginBottom: 8 },

    // ── Section ────────────────────────────────────────────────────────────
    section: { marginBottom: 6 },
    sectionHead: {
        fontFamily: FB,
        fontSize: 7.5,
        color: '#111',
        textTransform: 'uppercase',
        letterSpacing: 1,
        borderBottomWidth: 0.5,
        borderBottomColor: '#999',
        paddingBottom: 1.5,
        marginBottom: 3,
    },

    // ── Experience / Project entry ──────────────────────────────────────
    entryBlock: { marginBottom: 4 },
    entryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    entryTitle: { fontFamily: FB, fontSize: 8.5, color: '#0f0f0f', flex: 1 },
    entryDate: { fontFamily: F, fontSize: 7.5, color: '#555', textAlign: 'right', flexShrink: 0, marginLeft: 6 },
    entryRole: { fontFamily: FB, fontSize: 7.5, color: '#444', marginBottom: 1.5 },
    clientLabel: { fontFamily: FB, fontSize: 7.5, color: '#555', marginTop: 2, marginBottom: 1 },

    // ── Bullets ────────────────────────────────────────────────────────────
    bulletRow: { flexDirection: 'row', marginBottom: 1.5, paddingLeft: 6 },
    bulletDot: { fontFamily: F, width: 9, fontSize: 8, color: '#555', flexShrink: 0, marginTop: 0.5 },
    bulletText: { fontFamily: F, flex: 1, fontSize: 8, color: '#222', lineHeight: 1.35 },

    // ── Skills ─────────────────────────────────────────────────────────────
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 1.5 },
    skillCat: { fontFamily: FB, fontSize: 8.5, color: '#111', marginRight: 3 },
    skillVal: { fontFamily: F, fontSize: 8.5, color: '#333', flex: 1 },

    // ── Paragraph / default ───────────────────────────────────────────────
    para: { fontFamily: F, fontSize: 8.5, color: '#222', lineHeight: 1.4, marginBottom: 1.5 },
    inlineBold: { fontFamily: FB },
    subHead: { fontFamily: FB, fontSize: 8.5, color: '#111', marginBottom: 2 },
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
                            {i < parts.length - 1 && <Text style={S.contactSep}> | </Text>}
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
                            {i < parts.length - 1 && <Text style={S.contactSep}> | </Text>}
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
                            {i < parts.length - 1 && <Text style={S.contactSep}> | </Text>}
                        </React.Fragment>
                    );
                }

                // Plain text (email, phone, location)
                return (
                    <React.Fragment key={i}>
                        <Text style={S.contactText}>{trimmed}</Text>
                        {i < parts.length - 1 && <Text style={S.contactSep}> | </Text>}
                    </React.Fragment>
                );
            })}
        </View>
    );
}

// ── Section body renderer ─────────────────────────────────────────────────────
function Body({ lines }: { lines: string[] }) {
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
                const tail = stripped[stripped.length - 1];
                const isDate = /\d{4}|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(tail);
                if (isDate) {
                    const company = stripped[0];
                    const role = stripped.slice(1, -1).join(' | ');
                    els.push(
                        <View key={i} style={S.entryBlock}>
                            <View style={S.entryTopRow}>
                                <Text style={S.entryTitle}>{company}</Text>
                                <Text style={S.entryDate}>{tail}</Text>
                            </View>
                            {role ? <Text style={S.entryRole}>{role}</Text> : null}
                        </View>
                    );
                } else {
                    els.push(
                        <View key={i} style={S.entryTopRow}>
                            <Text style={S.entryTitle}>{stripped[0]}</Text>
                            {stripped[1] && <Text style={S.entryDate}>{stripped[1]}</Text>}
                        </View>
                    );
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
            els.push(
                <View key={i} style={S.skillRow}>
                    <Text style={S.skillCat}>{sm[1]}:</Text>
                    <Text style={S.skillVal}>{sm[2]}</Text>
                </View>
            );
            i++; continue;
        }

        // H3 sub-heading
        if (line.startsWith('### ')) {
            els.push(<Text key={i} style={S.subHead}>{line.slice(4).trim()}</Text>);
            i++; continue;
        }

        // Default
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
            {name && <Text style={S.name}>{name}</Text>}
            {contactLines.map((l, i) => <ContactRow key={i} raw={l} />)}
            <View style={S.headerRule} />

            {/* ── Sections ── */}
            {secs.map((sec, i) => (
                <View key={i} style={S.section} wrap={false}>
                    <Text style={S.sectionHead}>{sec.heading}</Text>
                    <Body lines={sec.lines} />
                </View>
            ))}

        </Page>
    );
}
