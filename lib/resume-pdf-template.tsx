import React from 'react';
import { Page, View, Text, Link, StyleSheet } from '@react-pdf/renderer';

// ── Built-in PDF fonts — no registration needed ───────────────────────────────
const F_SANS = 'Helvetica';
const FB_SANS = 'Helvetica-Bold';
const F_SERIF = 'Times-Roman';
const FB_SERIF = 'Times-Bold';
const F_MONO = 'Courier';
const FB_MONO = 'Courier-Bold';

// ── MODERN POLISHED (Clean sans-serif, strong section hierarchy) ────────────────
const S_MODERN = StyleSheet.create({
    page: {
        fontFamily: F_SANS,
        fontSize: 9,
        color: '#1e293b',
        paddingTop: 32,
        paddingBottom: 24,
        paddingHorizontal: 35,
        lineHeight: 1.4,
        backgroundColor: '#ffffff',
    },
    name: {
        fontFamily: FB_SANS,
        fontSize: 20,
        color: '#0f172a',
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
        color: '#475569',
    },
    contactText: { fontFamily: F_SANS, color: '#475569', fontSize: 8.5 },
    contactLink: { fontFamily: F_SANS, color: '#0f172a', fontSize: 8.5, textDecoration: 'underline' },
    contactSep: { fontFamily: F_SANS, color: '#94a3b8', fontSize: 8.5, marginHorizontal: 4 },
    headerRule: { borderBottomWidth: 1.5, borderBottomColor: '#0f172a', marginBottom: 10 },
    section: { marginBottom: 10 },
    sectionHead: {
        fontFamily: FB_SANS,
        fontSize: 10,
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        borderBottomWidth: 1.2,
        borderBottomColor: '#cbd5e1',
        paddingBottom: 3,
        marginBottom: 6,
    },
    entryBlock: { marginBottom: 6 },
    entryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 1.5,
    },
    entryTitle: { fontFamily: FB_SANS, fontSize: 9.5, color: '#0f172a', flex: 1, marginRight: 8 },
    entryDate: { fontFamily: F_SANS, fontSize: 8.5, color: '#475569', textAlign: 'right', flexShrink: 0 },
    entryRole: { fontFamily: FB_SANS, fontSize: 9, color: '#334155', marginBottom: 3 },
    clientLabel: { fontFamily: FB_SANS, fontSize: 8.5, color: '#475569', marginTop: 1.5, marginBottom: 1.5 },
    bulletRow: { flexDirection: 'row', marginBottom: 2.5, paddingLeft: 6 },
    bulletDot: { fontFamily: F_SANS, width: 8, fontSize: 9, color: '#94a3b8', flexShrink: 0, marginTop: 0, marginRight: 4 },
    bulletText: { fontFamily: F_SANS, flex: 1, fontSize: 9, color: '#334155', lineHeight: 1.4 },
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 },
    skillCat: { fontFamily: FB_SANS, fontSize: 9, color: '#0f172a', marginRight: 4, marginBottom: 1.5 },
    skillVal: { fontFamily: F_SANS, fontSize: 9, color: '#334155', flex: 1, marginBottom: 1.5 },
    para: { fontFamily: F_SANS, fontSize: 9, color: '#334155', lineHeight: 1.4, marginBottom: 3 },
    inlineBold: { fontFamily: FB_SANS },
    subHead: { fontFamily: FB_SANS, fontSize: 9.5, color: '#0f172a', marginBottom: 3, marginTop: 3 },
});

// ── CLASSIC PROFESSIONAL (Traditional ATS serif layout) ─────────────────────────
const S_CLASSIC = StyleSheet.create({
    page: {
        fontFamily: F_SERIF,
        fontSize: 9,
        color: '#000000',
        paddingTop: 32,
        paddingBottom: 24,
        paddingHorizontal: 35,
        lineHeight: 1.4,
        backgroundColor: '#ffffff',
    },
    name: {
        fontFamily: FB_SERIF,
        fontSize: 21,
        color: '#000000',
        lineHeight: 1.15,
        marginBottom: 6,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    contactRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 8,
        fontSize: 8.5,
        color: '#444444',
    },
    contactText: { fontFamily: F_SERIF, color: '#444444', fontSize: 8.5 },
    contactLink: { fontFamily: F_SERIF, color: '#000000', fontSize: 8.5, textDecoration: 'underline' },
    contactSep: { fontFamily: F_SERIF, color: '#666666', fontSize: 8.5, marginHorizontal: 4 },
    headerRule: { borderBottomWidth: 1, borderBottomColor: '#444444', marginBottom: 10 },
    section: { marginBottom: 10 },
    sectionHead: {
        fontFamily: FB_SERIF,
        fontSize: 10.5,
        color: '#000000',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        borderBottomWidth: 1,
        borderBottomColor: '#444444',
        paddingBottom: 2,
        marginBottom: 6,
    },
    entryBlock: { marginBottom: 6 },
    entryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 1.5,
    },
    entryTitle: { fontFamily: FB_SERIF, fontSize: 9.5, color: '#000000', flex: 1, marginRight: 8 },
    entryDate: { fontFamily: F_SERIF, fontSize: 8.5, color: '#444444', textAlign: 'right', flexShrink: 0 },
    entryRole: { fontFamily: FB_SERIF, fontSize: 9, color: '#111111', marginBottom: 3 },
    clientLabel: { fontFamily: FB_SERIF, fontSize: 8.5, color: '#333333', marginTop: 1.5, marginBottom: 1.5 },
    bulletRow: { flexDirection: 'row', marginBottom: 2.5, paddingLeft: 6 },
    bulletDot: { fontFamily: F_SERIF, width: 8, fontSize: 9, color: '#000000', flexShrink: 0, marginTop: 0, marginRight: 4 },
    bulletText: { fontFamily: F_SERIF, flex: 1, fontSize: 9, color: '#111111', lineHeight: 1.4 },
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 },
    skillCat: { fontFamily: FB_SERIF, fontSize: 9, color: '#000000', marginRight: 4, marginBottom: 1.5 },
    skillVal: { fontFamily: F_SERIF, fontSize: 9, color: '#111111', flex: 1, marginBottom: 1.5 },
    para: { fontFamily: F_SERIF, fontSize: 9, color: '#111111', lineHeight: 1.4, marginBottom: 3 },
    inlineBold: { fontFamily: FB_SERIF },
    subHead: { fontFamily: FB_SERIF, fontSize: 9.5, color: '#000000', marginBottom: 3, marginTop: 3 },
});

// ── MINIMAL EXECUTIVE (Quiet, compact, and polished) ───────────────────────────
const S_MINIMAL = StyleSheet.create({
    page: {
        fontFamily: F_SANS,
        fontSize: 8.5,
        color: '#475569',
        paddingTop: 28,
        paddingBottom: 20,
        paddingHorizontal: 30,
        lineHeight: 1.35,
        backgroundColor: '#ffffff',
    },
    name: {
        fontFamily: FB_SANS,
        fontSize: 18,
        color: '#0f172a',
        lineHeight: 1.15,
        marginBottom: 4,
        textAlign: 'center',
    },
    contactRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 10,
        fontSize: 8,
        color: '#64748b',
    },
    contactText: { fontFamily: F_SANS, color: '#64748b', fontSize: 8 },
    contactLink: { fontFamily: F_SANS, color: '#0f172a', fontSize: 8, textDecoration: 'underline' },
    contactSep: { fontFamily: F_SANS, color: '#cbd5e1', fontSize: 8, marginHorizontal: 4 },
    headerRule: { borderBottomWidth: 0, marginBottom: 4 }, // No border line in minimal
    section: { marginBottom: 8 },
    sectionHead: {
        fontFamily: FB_SANS,
        fontSize: 9,
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 5,
        paddingBottom: 0,
        marginBottom: 5,
        marginTop: 4,
    },
    entryBlock: { marginBottom: 5 },
    entryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 1,
    },
    entryTitle: { fontFamily: FB_SANS, fontSize: 9, color: '#0f172a', flex: 1, marginRight: 8 },
    entryDate: { fontFamily: F_SANS, fontSize: 8, color: '#64748b', textAlign: 'right', flexShrink: 0 },
    entryRole: { fontFamily: F_SANS, fontSize: 8.5, color: '#334155', marginBottom: 2 },
    clientLabel: { fontFamily: F_SANS, fontSize: 8, color: '#475569', marginTop: 1, marginBottom: 1 },
    bulletRow: { flexDirection: 'row', marginBottom: 2, paddingLeft: 4 },
    bulletDot: { fontFamily: F_SANS, width: 8, fontSize: 8.5, color: '#64748b', flexShrink: 0, marginTop: 0, marginRight: 3 },
    bulletText: { fontFamily: F_SANS, flex: 1, fontSize: 8.5, color: '#334155', lineHeight: 1.35 },
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2.5 },
    skillCat: { fontFamily: FB_SANS, fontSize: 8.5, color: '#0f172a', marginRight: 4, marginBottom: 1 },
    skillVal: { fontFamily: F_SANS, fontSize: 8.5, color: '#334155', flex: 1, marginBottom: 1 },
    para: { fontFamily: F_SANS, fontSize: 8.5, color: '#334155', lineHeight: 1.35, marginBottom: 2.5 },
    inlineBold: { fontFamily: FB_SANS },
    subHead: { fontFamily: FB_SANS, fontSize: 9, color: '#0f172a', marginBottom: 2, marginTop: 2 },
});

// ── EXECUTIVE SERIF (Navy accents, Times-Serif, centered header) ──────────────────
const S_EXECUTIVE = StyleSheet.create({
    page: {
        fontFamily: F_SERIF,
        fontSize: 9,
        color: '#1e293b',
        paddingTop: 32,
        paddingBottom: 24,
        paddingHorizontal: 35,
        lineHeight: 1.45,
        backgroundColor: '#ffffff',
    },
    name: {
        fontFamily: FB_SERIF,
        fontSize: 22,
        color: '#1e3a8a', // Deep corporate navy
        lineHeight: 1.15,
        marginBottom: 6,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    contactRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 8,
        fontSize: 8.5,
        color: '#475569',
    },
    contactText: { fontFamily: F_SERIF, color: '#475569', fontSize: 8.5 },
    contactLink: { fontFamily: F_SERIF, color: '#1e3a8a', fontSize: 8.5, textDecoration: 'none' },
    contactSep: { fontFamily: F_SERIF, color: '#cbd5e1', fontSize: 8.5, marginHorizontal: 5 },
    headerRule: { borderBottomWidth: 2, borderBottomColor: '#1e3a8a', marginBottom: 12 },
    section: { marginBottom: 10 },
    sectionHead: {
        fontFamily: FB_SERIF,
        fontSize: 10.5,
        color: '#1e3a8a', // Corporate Navy
        textTransform: 'uppercase',
        letterSpacing: 1,
        borderBottomWidth: 1.5,
        borderBottomColor: '#1e3a8a',
        paddingBottom: 3,
        marginBottom: 6,
    },
    entryBlock: { marginBottom: 6 },
    entryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 1.5,
    },
    entryTitle: { fontFamily: FB_SERIF, fontSize: 9.5, color: '#1e293b', flex: 1, marginRight: 8 },
    entryDate: { fontFamily: F_SERIF, fontSize: 8.5, color: '#475569', textAlign: 'right', flexShrink: 0 },
    entryRole: { fontFamily: FB_SERIF, fontSize: 9, color: '#334155', marginBottom: 3 },
    clientLabel: { fontFamily: FB_SERIF, fontSize: 8.5, color: '#475569', marginTop: 1.5, marginBottom: 1.5 },
    bulletRow: { flexDirection: 'row', marginBottom: 2.5, paddingLeft: 6 },
    bulletDot: { fontFamily: F_SERIF, width: 8, fontSize: 9, color: '#1e3a8a', flexShrink: 0, marginTop: 0, marginRight: 4 },
    bulletText: { fontFamily: F_SERIF, flex: 1, fontSize: 9, color: '#334155', lineHeight: 1.4 },
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 },
    skillCat: { fontFamily: FB_SERIF, fontSize: 9, color: '#1e3a8a', marginRight: 4, marginBottom: 1.5 },
    skillVal: { fontFamily: F_SERIF, fontSize: 9, color: '#334155', flex: 1, marginBottom: 1.5 },
    para: { fontFamily: F_SERIF, fontSize: 9, color: '#334155', lineHeight: 1.4, marginBottom: 3 },
    inlineBold: { fontFamily: FB_SERIF },
    subHead: { fontFamily: FB_SERIF, fontSize: 9.5, color: '#1e3a8a', marginBottom: 3, marginTop: 3 },
});

// ── TECH MONO (Sky blue details, Courier highlights for dates & tech) ─────────────
const S_TECH = StyleSheet.create({
    page: {
        fontFamily: F_SANS,
        fontSize: 9,
        color: '#1e293b',
        paddingTop: 32,
        paddingBottom: 24,
        paddingHorizontal: 35,
        lineHeight: 1.4,
        backgroundColor: '#ffffff',
    },
    name: {
        fontFamily: FB_SANS,
        fontSize: 20,
        color: '#0f172a',
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
        color: '#475569',
    },
    contactText: { fontFamily: F_SANS, color: '#475569', fontSize: 8.5 },
    contactLink: { fontFamily: F_MONO, color: '#0284c7', fontSize: 8.5, textDecoration: 'none' }, // Monospace links
    contactSep: { fontFamily: F_SANS, color: '#94a3b8', fontSize: 8.5, marginHorizontal: 4 },
    headerRule: { borderBottomWidth: 2, borderBottomColor: '#0284c7', marginBottom: 12 }, // Sky blue divider
    section: { marginBottom: 10 },
    sectionHead: {
        fontFamily: FB_MONO, // Monospace section headers
        fontSize: 9.5,
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        borderLeftWidth: 3,
        borderLeftColor: '#0284c7', // Sky Blue Left Accent
        paddingLeft: 6,
        paddingBottom: 0,
        marginBottom: 6,
        marginTop: 4,
    },
    entryBlock: { marginBottom: 6 },
    entryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 1.5,
    },
    entryTitle: { fontFamily: FB_SANS, fontSize: 9.5, color: '#0f172a', flex: 1, marginRight: 8 },
    entryDate: { fontFamily: FB_MONO, fontSize: 8.5, color: '#0284c7', textAlign: 'right', flexShrink: 0 }, // Monospace blue dates
    entryRole: { fontFamily: FB_SANS, fontSize: 9, color: '#334155', marginBottom: 3 },
    clientLabel: { fontFamily: FB_SANS, fontSize: 8.5, color: '#475569', marginTop: 1.5, marginBottom: 1.5 },
    bulletRow: { flexDirection: 'row', marginBottom: 2.5, paddingLeft: 6 },
    bulletDot: { fontFamily: F_SANS, width: 8, fontSize: 9, color: '#0284c7', flexShrink: 0, marginTop: 0, marginRight: 4 },
    bulletText: { fontFamily: F_SANS, flex: 1, fontSize: 9, color: '#334155', lineHeight: 1.4 },
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 },
    skillCat: { fontFamily: FB_MONO, fontSize: 8.5, color: '#0284c7', marginRight: 4, marginBottom: 1.5 }, // Monospace blue labels
    skillVal: { fontFamily: F_SANS, fontSize: 9, color: '#334155', flex: 1, marginBottom: 1.5 },
    para: { fontFamily: F_SANS, fontSize: 9, color: '#334155', lineHeight: 1.4, marginBottom: 3 },
    inlineBold: { fontFamily: FB_SANS },
    subHead: { fontFamily: FB_MONO, fontSize: 9, color: '#0284c7', marginBottom: 3, marginTop: 3 },
});

// ── CREATIVE TEAL (Sleek sans-serif, teal highlight lines & left section bars) ─────
const S_CREATIVE = StyleSheet.create({
    page: {
        fontFamily: F_SANS,
        fontSize: 9,
        color: '#1e293b',
        paddingTop: 32,
        paddingBottom: 24,
        paddingHorizontal: 35,
        lineHeight: 1.4,
        backgroundColor: '#ffffff',
    },
    name: {
        fontFamily: FB_SANS,
        fontSize: 20,
        color: '#0d9488', // Teal
        lineHeight: 1.15,
        marginBottom: 6,
        textAlign: 'center',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    contactRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 8,
        fontSize: 8.5,
        color: '#475569',
    },
    contactText: { fontFamily: F_SANS, color: '#475569', fontSize: 8.5 },
    contactLink: { fontFamily: F_SANS, color: '#0d9488', fontSize: 8.5, textDecoration: 'underline' },
    contactSep: { fontFamily: F_SANS, color: '#94a3b8', fontSize: 8.5, marginHorizontal: 4 },
    headerRule: { borderBottomWidth: 2, borderBottomColor: '#0d9488', marginBottom: 12 },
    section: { marginBottom: 10 },
    sectionHead: {
        fontFamily: FB_SANS,
        fontSize: 9.5,
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        borderLeftWidth: 3,
        borderLeftColor: '#0d9488', // Teal Left Accent
        paddingLeft: 6,
        paddingBottom: 0,
        marginBottom: 6,
        marginTop: 4,
    },
    entryBlock: { marginBottom: 6 },
    entryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 1.5,
    },
    entryTitle: { fontFamily: FB_SANS, fontSize: 9.5, color: '#0f172a', flex: 1, marginRight: 8 },
    entryDate: { fontFamily: F_SANS, fontSize: 8.5, color: '#0d9488', textAlign: 'right', flexShrink: 0 },
    entryRole: { fontFamily: FB_SANS, fontSize: 9, color: '#334155', marginBottom: 3 },
    clientLabel: { fontFamily: FB_SANS, fontSize: 8.5, color: '#475569', marginTop: 1.5, marginBottom: 1.5 },
    bulletRow: { flexDirection: 'row', marginBottom: 2.5, paddingLeft: 6 },
    bulletDot: { fontFamily: F_SANS, width: 8, fontSize: 9, color: '#0d9488', flexShrink: 0, marginTop: 0, marginRight: 4 },
    bulletText: { fontFamily: F_SANS, flex: 1, fontSize: 9, color: '#334155', lineHeight: 1.4 },
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 },
    skillCat: { fontFamily: FB_SANS, fontSize: 8.5, color: '#0d9488', marginRight: 4, marginBottom: 1.5 },
    skillVal: { fontFamily: F_SANS, fontSize: 9, color: '#334155', flex: 1, marginBottom: 1.5 },
    para: { fontFamily: F_SANS, fontSize: 9, color: '#334155', lineHeight: 1.4, marginBottom: 3 },
    inlineBold: { fontFamily: FB_SANS },
    subHead: { fontFamily: FB_SANS, fontSize: 9, color: '#0d9488', marginBottom: 3, marginTop: 3 },
});

// ── EMERALD CORPORATE (Forest green details, elegant serif headers) ─────────────
const S_EMERALD = StyleSheet.create({
    page: {
        fontFamily: F_SERIF,
        fontSize: 9,
        color: '#1e293b',
        paddingTop: 32,
        paddingBottom: 24,
        paddingHorizontal: 35,
        lineHeight: 1.45,
        backgroundColor: '#ffffff',
    },
    name: {
        fontFamily: FB_SERIF,
        fontSize: 22,
        color: '#065f46', // Deep emerald
        lineHeight: 1.15,
        marginBottom: 6,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    contactRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 8,
        fontSize: 8.5,
        color: '#475569',
    },
    contactText: { fontFamily: F_SERIF, color: '#475569', fontSize: 8.5 },
    contactLink: { fontFamily: F_SERIF, color: '#065f46', fontSize: 8.5, textDecoration: 'none' },
    contactSep: { fontFamily: F_SERIF, color: '#cbd5e1', fontSize: 8.5, marginHorizontal: 5 },
    headerRule: { borderBottomWidth: 2, borderBottomColor: '#065f46', marginBottom: 12 },
    section: { marginBottom: 10 },
    sectionHead: {
        fontFamily: FB_SERIF,
        fontSize: 10.5,
        color: '#065f46',
        textTransform: 'uppercase',
        letterSpacing: 1,
        borderBottomWidth: 1.5,
        borderBottomColor: '#065f46',
        paddingBottom: 3,
        marginBottom: 6,
    },
    entryBlock: { marginBottom: 6 },
    entryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 1.5,
    },
    entryTitle: { fontFamily: FB_SERIF, fontSize: 9.5, color: '#1e293b', flex: 1, marginRight: 8 },
    entryDate: { fontFamily: F_SERIF, fontSize: 8.5, color: '#475569', textAlign: 'right', flexShrink: 0 },
    entryRole: { fontFamily: FB_SERIF, fontSize: 9, color: '#334155', marginBottom: 3 },
    clientLabel: { fontFamily: FB_SERIF, fontSize: 8.5, color: '#475569', marginTop: 1.5, marginBottom: 1.5 },
    bulletRow: { flexDirection: 'row', marginBottom: 2.5, paddingLeft: 6 },
    bulletDot: { fontFamily: F_SERIF, width: 8, fontSize: 9, color: '#065f46', flexShrink: 0, marginTop: 0, marginRight: 4 },
    bulletText: { fontFamily: F_SERIF, flex: 1, fontSize: 9, color: '#334155', lineHeight: 1.4 },
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 },
    skillCat: { fontFamily: FB_SERIF, fontSize: 9, color: '#065f46', marginRight: 4, marginBottom: 1.5 },
    skillVal: { fontFamily: F_SERIF, fontSize: 9, color: '#334155', flex: 1, marginBottom: 1.5 },
    para: { fontFamily: F_SERIF, fontSize: 9, color: '#334155', lineHeight: 1.4, marginBottom: 3 },
    inlineBold: { fontFamily: FB_SERIF },
    subHead: { fontFamily: FB_SERIF, fontSize: 9.5, color: '#065f46', marginBottom: 3, marginTop: 3 },
});

// ── ELEGANT CRIMSON (Burgundy/Crimson accents, elegant Georgia serif) ─────────────
const S_ELEGANT = StyleSheet.create({
    page: {
        fontFamily: F_SERIF,
        fontSize: 9,
        color: '#1e293b',
        paddingTop: 32,
        paddingBottom: 24,
        paddingHorizontal: 35,
        lineHeight: 1.45,
        backgroundColor: '#ffffff',
    },
    name: {
        fontFamily: FB_SERIF,
        fontSize: 22,
        color: '#881337', // Crimson
        lineHeight: 1.15,
        marginBottom: 6,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    contactRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 8,
        fontSize: 8.5,
        color: '#475569',
    },
    contactText: { fontFamily: F_SERIF, color: '#475569', fontSize: 8.5 },
    contactLink: { fontFamily: F_SERIF, color: '#881337', fontSize: 8.5, textDecoration: 'none' },
    contactSep: { fontFamily: F_SERIF, color: '#cbd5e1', fontSize: 8.5, marginHorizontal: 5 },
    headerRule: { borderBottomWidth: 2, borderBottomColor: '#881337', marginBottom: 12 },
    section: { marginBottom: 10 },
    sectionHead: {
        fontFamily: FB_SERIF,
        fontSize: 10.5,
        color: '#881337',
        textTransform: 'uppercase',
        letterSpacing: 1,
        borderBottomWidth: 1.5,
        borderBottomColor: '#881337',
        paddingBottom: 3,
        marginBottom: 6,
    },
    entryBlock: { marginBottom: 6 },
    entryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 1.5,
    },
    entryTitle: { fontFamily: FB_SERIF, fontSize: 9.5, color: '#1e293b', flex: 1, marginRight: 8 },
    entryDate: { fontFamily: F_SERIF, fontSize: 8.5, color: '#475569', textAlign: 'right', flexShrink: 0 },
    entryRole: { fontFamily: FB_SERIF, fontSize: 9, color: '#334155', marginBottom: 3 },
    clientLabel: { fontFamily: FB_SERIF, fontSize: 8.5, color: '#475569', marginTop: 1.5, marginBottom: 1.5 },
    bulletRow: { flexDirection: 'row', marginBottom: 2.5, paddingLeft: 6 },
    bulletDot: { fontFamily: F_SERIF, width: 8, fontSize: 9, color: '#881337', flexShrink: 0, marginTop: 0, marginRight: 4 },
    bulletText: { fontFamily: F_SERIF, flex: 1, fontSize: 9, color: '#334155', lineHeight: 1.4 },
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 },
    skillCat: { fontFamily: FB_SERIF, fontSize: 9, color: '#881337', marginRight: 4, marginBottom: 1.5 },
    skillVal: { fontFamily: F_SERIF, fontSize: 9, color: '#334155', flex: 1, marginBottom: 1.5 },
    para: { fontFamily: F_SERIF, fontSize: 9, color: '#334155', lineHeight: 1.4, marginBottom: 3 },
    inlineBold: { fontFamily: FB_SERIF },
    subHead: { fontFamily: FB_SERIF, fontSize: 9.5, color: '#881337', marginBottom: 3, marginTop: 3 },
});

// ── SLATE MODERNIST (Sleek slate accents, clean sans-serif layout) ─────────────
const S_SLATE = StyleSheet.create({
    page: {
        fontFamily: F_SANS,
        fontSize: 9,
        color: '#334155',
        paddingTop: 32,
        paddingBottom: 24,
        paddingHorizontal: 35,
        lineHeight: 1.4,
        backgroundColor: '#ffffff',
    },
    name: {
        fontFamily: FB_SANS,
        fontSize: 20,
        color: '#1e293b',
        lineHeight: 1.15,
        marginBottom: 6,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    contactRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 8,
        fontSize: 8.5,
        color: '#64748b',
    },
    contactText: { fontFamily: F_SANS, color: '#64748b', fontSize: 8.5 },
    contactLink: { fontFamily: F_SANS, color: '#475569', fontSize: 8.5, textDecoration: 'underline' },
    contactSep: { fontFamily: F_SANS, color: '#cbd5e1', fontSize: 8.5, marginHorizontal: 4 },
    headerRule: { borderBottomWidth: 1.5, borderBottomColor: '#475569', marginBottom: 12 },
    section: { marginBottom: 10 },
    sectionHead: {
        fontFamily: FB_SANS,
        fontSize: 9.5,
        color: '#1e293b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 3,
        marginBottom: 6,
        marginTop: 4,
    },
    entryBlock: { marginBottom: 6 },
    entryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 1.5,
    },
    entryTitle: { fontFamily: FB_SANS, fontSize: 9.5, color: '#1e293b', flex: 1, marginRight: 8 },
    entryDate: { fontFamily: F_SANS, fontSize: 8.5, color: '#64748b', textAlign: 'right', flexShrink: 0 },
    entryRole: { fontFamily: FB_SANS, fontSize: 9, color: '#475569', marginBottom: 3 },
    clientLabel: { fontFamily: FB_SANS, fontSize: 8.5, color: '#64748b', marginTop: 1.5, marginBottom: 1.5 },
    bulletRow: { flexDirection: 'row', marginBottom: 2.5, paddingLeft: 6 },
    bulletDot: { fontFamily: F_SANS, width: 8, fontSize: 9, color: '#64748b', flexShrink: 0, marginTop: 0, marginRight: 4 },
    bulletText: { fontFamily: F_SANS, flex: 1, fontSize: 9, color: '#475569', lineHeight: 1.4 },
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 },
    skillCat: { fontFamily: FB_SANS, fontSize: 8.5, color: '#475569', marginRight: 4, marginBottom: 1.5 },
    skillVal: { fontFamily: F_SANS, fontSize: 9, color: '#475569', flex: 1, marginBottom: 1.5 },
    para: { fontFamily: F_SANS, fontSize: 9, color: '#475569', lineHeight: 1.4, marginBottom: 3 },
    inlineBold: { fontFamily: FB_SANS },
    subHead: { fontFamily: FB_SANS, fontSize: 9, color: '#475569', marginBottom: 3, marginTop: 3 },
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

function RichText({ raw, style, styles }: { raw: string; style?: any; styles: any }) {
    return (
        <Text style={style}>
            {parseInline(raw.trim()).map((sp, i) =>
                sp.url
                    ? <Link key={i} src={sp.url} style={styles.contactLink}>{sp.text}</Link>
                    : <Text key={i} style={sp.bold ? styles.inlineBold : {}}>{sp.text}</Text>
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
const DOMAIN_RE = /^(linkedin|github|gitlab|twitter|x\.com|portfolio|behance|dribbble)\./i;

function ContactRow({ raw, styles }: { raw: string; styles: any }) {
    const parts = raw.split(/\s*\|\s*/);
    return (
        <View style={styles.contactRow}>
            {parts.map((p, i) => {
                const trimmed = p.trim();

                // [Label](url)
                const mdLink = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                if (mdLink) {
                    const href = mdLink[2].startsWith('http') ? mdLink[2] : `https://${mdLink[2]}`;
                    return (
                        <React.Fragment key={i}>
                            <Link src={href} style={styles.contactLink}>{mdLink[1]}</Link>
                            {i < parts.length - 1 ? <Text style={styles.contactSep}> | </Text> : null}
                        </React.Fragment>
                    );
                }

                // https:// bare URL
                if (/^https?:\/\//i.test(trimmed)) {
                    const labelMatch = trimmed.match(/https?:\/\/(www\.)?(linkedin|github|gitlab|twitter|x\.com)\.com[^\s]*/i);
                    const label = labelMatch ? labelMatch[2] : trimmed;
                    return (
                        <React.Fragment key={i}>
                            <Link src={trimmed} style={styles.contactLink}>{label}</Link>
                            {i < parts.length - 1 ? <Text style={styles.contactSep}> | </Text> : null}
                        </React.Fragment>
                    );
                }

                // Bare domain URL
                if (DOMAIN_RE.test(trimmed) || trimmed.includes('.com/') || trimmed.includes('.io/')) {
                    const href = `https://${trimmed}`;
                    const domainLabel = trimmed.split('/')[0].replace(/^www\./i, '');
                    const prettyLabel = domainLabel.charAt(0).toUpperCase() + domainLabel.slice(1).split('.')[0];
                    return (
                        <React.Fragment key={i}>
                            <Link src={href} style={styles.contactLink}>{prettyLabel}</Link>
                            {i < parts.length - 1 ? <Text style={styles.contactSep}> | </Text> : null}
                        </React.Fragment>
                    );
                }

                // Plain text
                return (
                    <React.Fragment key={i}>
                        <Text style={styles.contactText}>{trimmed}</Text>
                        {i < parts.length - 1 ? <Text style={styles.contactSep}> | </Text> : null}
                    </React.Fragment>
                );
            })}
        </View>
    );
}

// ── Section body renderer ─────────────────────────────────────────────────────
function Body({ lines, sectionName, styles }: { lines: string[]; sectionName?: string; styles: any }) {
    const els: React.ReactNode[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }

        // Bullet
        if (/^\s*[-•*]\s/.test(line)) {
            const text = line.replace(/^\s*[-•*]\s+/, '').trim();
            els.push(
                <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <RichText raw={text} style={styles.bulletText} styles={styles} />
                </View>
            );
            i++; continue;
        }

        // Entry line: **Company** | **Role** | **Date**
        if (line.includes('**') && line.includes('|')) {
            const parts = line.split('|').map(p => p.trim());
            const stripped = parts.map(p => p.replace(/\*\*/g, '').trim());
            if (stripped.length >= 2) {
                const isProjectSec = sectionName && /project/i.test(sectionName);
                const isCertSec = sectionName && /certifications/i.test(sectionName);

                if (isCertSec) {
                    const certName = stripped[0];
                    const issuer = stripped[1];
                    const date = stripped[2];

                    els.push(
                        <View key={i} style={styles.bulletRow}>
                            <Text style={styles.bulletDot}>•</Text>
                            <Text style={styles.bulletText}>
                                <Text style={styles.inlineBold}>{certName}</Text>
                                {issuer ? <Text style={{ color: '#444444' }}>{` — ${issuer}`}</Text> : null}
                                {date ? <Text style={{ color: '#666666', fontSize: 8.5 }}>{` (${date})`}</Text> : null}
                            </Text>
                        </View>
                    );
                } else if (stripped.length >= 3) {
                    const title = stripped[0];
                    const subtitle = stripped[1];
                    const rightDetail = stripped[2];

                    els.push(
                        <View key={i} style={styles.entryBlock}>
                            <View style={styles.entryTopRow}>
                                <Text style={styles.entryTitle}>{title}</Text>
                                {rightDetail ? (
                                    rightDetail.startsWith('http') || rightDetail.includes('.com') || rightDetail.includes('.org') || rightDetail.includes('.io') ? (
                                        <Link src={rightDetail.startsWith('http') ? rightDetail : `https://${rightDetail}`} style={styles.contactLink}>
                                            {rightDetail}
                                        </Link>
                                    ) : (
                                        <Text style={styles.entryDate}>{rightDetail}</Text>
                                    )
                                ) : null}
                            </View>
                            {subtitle ? (
                                isProjectSec ? (
                                    <View style={styles.skillRow}>
                                        <Text style={styles.skillCat}>Technologies:</Text>
                                        <Text style={styles.skillVal}>{subtitle}</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.entryRole}>{subtitle}</Text>
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
                            <View key={i} style={styles.entryBlock}>
                                <View style={styles.entryTopRow}>
                                    <Text style={styles.entryTitle}>{title}</Text>
                                    <Text style={styles.entryDate}>{detail}</Text>
                                </View>
                            </View>
                        );
                    } else {
                        els.push(
                            <View key={i} style={styles.entryBlock}>
                                <View style={styles.entryTopRow}>
                                    <Text style={styles.entryTitle}>{title}</Text>
                                </View>
                                {detail ? (
                                    isProjectSec ? (
                                        <View style={styles.skillRow}>
                                            <Text style={styles.skillCat}>Technologies:</Text>
                                            <Text style={styles.skillVal}>{detail}</Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.entryRole}>{detail}</Text>
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
            els.push(<Text key={i} style={styles.clientLabel}>{'Client: ' + line.replace(/^\*\*Client:\*\*/i, '').trim()}</Text>);
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
                        <View key={`${i}-${index}`} style={styles.skillRow}>
                            <Text style={styles.skillCat}>{c.category}:</Text>
                            <Text style={styles.skillVal}>{c.items}</Text>
                        </View>
                    );
                });
            } else {
                els.push(
                    <View key={i} style={styles.skillRow}>
                        <Text style={styles.skillCat}>{cat}:</Text>
                        <Text style={styles.skillVal}>{rawVal}</Text>
                    </View>
                );
            }
            i++; continue;
        }

        // H3 sub-heading
        if (line.startsWith('### ')) {
            els.push(<Text key={i} style={styles.subHead}>{line.slice(4).trim()}</Text>);
            i++; continue;
        }

        // Default paragraph
        els.push(<RichText key={i} raw={line} style={styles.para} styles={styles} />);
        i++;
    }
    return <>{els}</>;
}

// ── Page export ───────────────────────────────────────────────────────────────
export function ResumePDFPage({ resumeMarkdown, template = 'modern' }: { resumeMarkdown: string; template?: string }) {
    const { header, secs } = parse(resumeMarkdown);
    const [name, ...contactLines] = header;

    const styles = template === 'classic' ? S_CLASSIC :
                   template === 'minimal' ? S_MINIMAL :
                   template === 'executive' ? S_EXECUTIVE :
                   template === 'tech' ? S_TECH :
                   template === 'creative' ? S_CREATIVE :
                   template === 'emerald' ? S_EMERALD :
                   template === 'elegant' ? S_ELEGANT :
                   template === 'slate' ? S_SLATE :
                   S_MODERN;

    return (
        <Page size="A4" style={styles.page}>

            {/* ── Header ── */}
            {name ? <Text style={styles.name}>{name}</Text> : null}
            {contactLines.map((l, i) => <ContactRow key={i} raw={l} styles={styles} />)}
            {styles.headerRule ? <View style={styles.headerRule} /> : null}

            {/* ── Sections ── */}
            {secs.map((sec, i) => (
                <View key={i} style={styles.section} wrap={true}>
                    <Text style={styles.sectionHead}>{sec.heading}</Text>
                    <Body lines={sec.lines} sectionName={sec.heading} styles={styles} />
                </View>
            ))}

        </Page>
    );
}
