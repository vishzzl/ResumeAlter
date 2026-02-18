/**
 * Production-grade 1-page resume PDF export.
 *
 * Strategy:
 *   1. Clone the resume DOM into an offscreen A4-sized container.
 *   2. If content overflows 1 page, scale down font sizes until it fits.
 *   3. Render to a 2× canvas via html2canvas-pro for crisp text.
 *   4. Drop the canvas into a jsPDF A4 page and trigger download.
 */

import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

/* ── A4 constants (at 96 DPI) ── */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 10; // 10mm margins on all sides
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;  // 190mm
const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - MARGIN_MM * 2; // 277mm

// Pixel equivalents at 96 DPI  (1 mm ≈ 3.7795 px)
const MM_TO_PX = 3.7795;
const CONTENT_WIDTH_PX = Math.floor(CONTENT_WIDTH_MM * MM_TO_PX);  // ~718
const CONTENT_HEIGHT_PX = Math.floor(CONTENT_HEIGHT_MM * MM_TO_PX); // ~1047

const CANVAS_SCALE = 2;      // 2× for print-quality (≈192 effective DPI)
const MIN_FONT_SCALE = 0.55; // never shrink below 55 % of original

export interface ExportOptions {
    fileName?: string;
}

/**
 * Export a resume element as a 1-page A4 PDF.
 *
 * @param sourceEl - The `.resume-content` DOM element to export.
 * @param opts     - Optional overrides (file name, etc.).
 */
export async function exportResumePDF(
    sourceEl: HTMLElement,
    opts: ExportOptions = {},
): Promise<void> {
    const { fileName = 'Resume' } = opts;

    // ── 1. Create offscreen container ──
    const offscreen = document.createElement('div');
    Object.assign(offscreen.style, {
        position: 'fixed',
        left: '-9999px',
        top: '0',
        width: `${CONTENT_WIDTH_PX}px`,
        // Height intentionally auto — we measure overflow later
        background: '#ffffff',
        zIndex: '-1',
        padding: '0',
        margin: '0',
        overflow: 'visible',
    });
    document.body.appendChild(offscreen);

    // ── 2. Deep-clone the resume content ──
    const clone = sourceEl.cloneNode(true) as HTMLElement;
    clone.style.width = '100%';
    clone.style.padding = '0';
    clone.style.margin = '0';
    clone.style.background = '#ffffff';
    clone.style.color = '#1a1a1a';
    clone.style.overflow = 'visible';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    offscreen.appendChild(clone);

    // ── 3. Apply print-optimized typography ──
    applyPrintStyles(clone);

    // ── 4. Auto-scale to fit 1 page ──
    await fitToOnePage(clone, offscreen);

    // ── 5. Render to canvas ──
    // Set the offscreen container to the exact content height (capped at A4)
    const finalHeight = Math.min(clone.scrollHeight, CONTENT_HEIGHT_PX);
    offscreen.style.height = `${finalHeight}px`;
    offscreen.style.overflow = 'hidden';

    const canvas = await html2canvas(offscreen, {
        scale: CANVAS_SCALE,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: CONTENT_WIDTH_PX,
        height: finalHeight,
        windowWidth: CONTENT_WIDTH_PX,
        windowHeight: finalHeight,
    });

    // ── 6. Generate PDF ──
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    // Calculate image dimensions to fill the content area
    const imgWidth = CONTENT_WIDTH_MM;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;

    pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        MARGIN_MM,
        MARGIN_MM,
        imgWidth,
        Math.min(imgHeight, CONTENT_HEIGHT_MM),
    );

    // ── 7. Download ──
    const safeName = fileName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Resume';
    pdf.save(`${safeName}.pdf`);

    // ── 8. Clean up ──
    document.body.removeChild(offscreen);
}

/* ──────────────────────────────────────────────────────────────
   INTERNAL HELPERS
   ────────────────────────────────────────────────────────────── */

/**
 * Apply print-optimised base styles to the cloned resume so it matches
 * the `@media print` typography from globals.css without relying on
 * the actual @media print query (which html2canvas ignores).
 */
function applyPrintStyles(root: HTMLElement): void {
    // Base
    root.style.fontFamily = "'Inter', Arial, Helvetica, sans-serif";
    root.style.fontSize = '11pt';
    root.style.lineHeight = '1.4';
    root.style.color = '#1a1a1a';

    // Remove all shadows / borders / backgrounds from every child
    const all = root.querySelectorAll('*') as NodeListOf<HTMLElement>;
    all.forEach((el) => {
        el.style.boxShadow = 'none';
        el.style.textShadow = 'none';
        el.style.backdropFilter = 'none';
        // Keep element backgrounds white unless it's a purposeful color
        const bg = getComputedStyle(el).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            el.style.backgroundColor = 'transparent';
        }
    });

    // Headings
    root.querySelectorAll('h1').forEach((h) => {
        const el = h as HTMLElement;
        el.style.fontSize = '18pt';
        el.style.fontWeight = '800';
        el.style.margin = '0 0 3pt 0';
        el.style.padding = '0 0 4pt 0';
        el.style.lineHeight = '1.15';
        el.style.color = '#111';
        el.style.borderBottom = '1.5pt solid #333';
    });

    root.querySelectorAll('h2').forEach((h) => {
        const el = h as HTMLElement;
        el.style.fontSize = '12pt';
        el.style.fontWeight = '700';
        el.style.margin = '7pt 0 3pt 0';
        el.style.padding = '0';
        el.style.color = '#222';
        el.style.lineHeight = '1.2';
        el.style.letterSpacing = '0.5pt';
        // Remove the ::after pseudo-element line (can't do via JS, so remove flex)
        el.style.display = 'block';
    });

    root.querySelectorAll('h3').forEach((h) => {
        const el = h as HTMLElement;
        el.style.fontSize = '11pt';
        el.style.fontWeight = '700';
        el.style.margin = '4pt 0 1pt 0';
        el.style.color = '#222';
        el.style.lineHeight = '1.2';
    });

    root.querySelectorAll('h4, h5, h6').forEach((h) => {
        const el = h as HTMLElement;
        el.style.fontSize = '11pt';
        el.style.fontWeight = '600';
        el.style.margin = '3pt 0 1pt 0';
        el.style.color = '#333';
        el.style.lineHeight = '1.2';
    });

    // Paragraphs
    root.querySelectorAll('p').forEach((p) => {
        const el = p as HTMLElement;
        el.style.fontSize = '11pt';
        el.style.margin = '0 0 2pt 0';
        el.style.lineHeight = '1.4';
        el.style.color = '#222';
    });

    // Lists
    root.querySelectorAll('ul').forEach((ul) => {
        const el = ul as HTMLElement;
        el.style.margin = '1pt 0 3pt 0';
        el.style.paddingLeft = '14pt';
    });

    root.querySelectorAll('li').forEach((li) => {
        const el = li as HTMLElement;
        el.style.fontSize = '10.5pt';
        el.style.lineHeight = '1.35';
        el.style.marginBottom = '1pt';
        el.style.color = '#333';
    });

    // Links — plain black, no decoration
    root.querySelectorAll('a').forEach((a) => {
        const el = a as HTMLElement;
        el.style.color = '#222';
        el.style.textDecoration = 'none';
    });

    // HRs
    root.querySelectorAll('hr').forEach((hr) => {
        const el = hr as HTMLElement;
        el.style.margin = '4pt 0';
        el.style.border = 'none';
        el.style.borderTop = '0.5pt solid #ccc';
    });
}

/**
 * Iteratively shrink all font sizes until the content fits within
 * CONTENT_HEIGHT_PX.  Uses a simple linear step-down approach.
 */
async function fitToOnePage(
    clone: HTMLElement,
    _container: HTMLElement,
): Promise<void> {
    let scale = 1.0;
    const STEP = 0.03;

    // Collect original font sizes
    const elements = clone.querySelectorAll('*') as NodeListOf<HTMLElement>;
    const originalSizes: { el: HTMLElement; size: number }[] = [];

    elements.forEach((el) => {
        const computed = parseFloat(getComputedStyle(el).fontSize);
        if (computed > 0) {
            originalSizes.push({ el, size: computed });
        }
    });

    // Also track the root
    const rootSize = parseFloat(getComputedStyle(clone).fontSize);
    if (rootSize > 0) {
        originalSizes.push({ el: clone, size: rootSize });
    }

    // Step down until it fits
    while (clone.scrollHeight > CONTENT_HEIGHT_PX && scale > MIN_FONT_SCALE) {
        scale -= STEP;
        originalSizes.forEach(({ el, size }) => {
            el.style.fontSize = `${size * scale}px`;
        });

        // Also scale margins proportionally for tighter fit
        clone.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, li, hr').forEach((el) => {
            const he = el as HTMLElement;
            const tag = he.tagName.toLowerCase();
            if (tag === 'h1') {
                he.style.margin = `0 0 ${3 * scale}pt 0`;
                he.style.padding = `0 0 ${4 * scale}pt 0`;
            } else if (tag === 'h2') {
                he.style.margin = `${7 * scale}pt 0 ${3 * scale}pt 0`;
            } else if (tag === 'h3') {
                he.style.margin = `${4 * scale}pt 0 ${1 * scale}pt 0`;
            } else if (tag === 'p') {
                he.style.margin = `0 0 ${2 * scale}pt 0`;
            } else if (tag === 'ul' || tag === 'ol') {
                he.style.margin = `${1 * scale}pt 0 ${3 * scale}pt 0`;
            } else if (tag === 'li') {
                he.style.marginBottom = `${1 * scale}pt`;
            } else if (tag === 'hr') {
                he.style.margin = `${4 * scale}pt 0`;
            }
        });

        // Force a reflow so scrollHeight updates
        void clone.offsetHeight;
    }
}
