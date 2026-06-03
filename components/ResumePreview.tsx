
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ResumePreviewProps {
    content: string;
    title?: string | null;
    company?: string | null;
    template?: 'modern' | 'classic' | 'minimal' | 'executive' | 'tech' | 'creative' | 'emerald' | 'elegant' | 'slate';
}

export function ResumePreview({ content, template = 'modern' }: ResumePreviewProps) {

    // Template-specific classes
    const styles = {
        // MODERN POLISHED - Clean sans-serif, strong section hierarchy.
        modern: {
            container: "font-sans text-slate-800 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-sm [&>h1+p]:text-slate-500 [&>h1+p]:mb-5",
            h1: "text-3xl sm:text-[34px] font-bold text-slate-950 mb-2 text-center border-b-2 border-slate-900 pb-3",
            h2: "text-[13px] sm:text-sm font-bold uppercase text-slate-950 mt-6 sm:mt-7 mb-2 border-b border-slate-200 pb-1.5",
            h3: "text-[14px] sm:text-base font-bold text-slate-950 mt-3 sm:mt-4 mb-1",
            p: "text-[13px] sm:text-sm text-slate-700 mb-2 leading-relaxed",
            ul: "list-disc list-outside ml-4 sm:ml-5 space-y-1 text-[13px] sm:text-sm text-slate-700 mb-3 marker:text-slate-500",
            li: "pl-1",
            strong: "font-bold text-slate-950",
            hr: "border-slate-200 my-4",
            a: "text-slate-900 underline decoration-slate-300 underline-offset-2"
        },
        // CLASSIC (PROFESSIONAL ATS) - Traditional and easy for parsers.
        classic: {
            container: "font-serif text-gray-900 leading-normal break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-sm [&>h1+p]:text-gray-600 [&>h1+p]:mb-4",
            h1: "text-2xl sm:text-3xl font-bold text-center text-gray-950 mb-2 uppercase border-b border-gray-900 pb-2",
            h2: "text-[13px] sm:text-sm font-bold text-gray-950 uppercase border-b border-gray-400 pb-1 mb-2 sm:mb-3 mt-5 sm:mt-6",
            h3: "text-[14px] sm:text-base font-bold text-gray-950 mt-3 sm:mt-4 mb-1",
            p: "text-[13px] sm:text-sm text-gray-800 mb-2 leading-relaxed",
            ul: "list-disc list-outside ml-4 sm:ml-5 space-y-1 text-[13px] sm:text-sm text-gray-800 mb-3",
            li: "pl-0",
            strong: "font-bold text-gray-950",
            hr: "border-gray-300 my-3 sm:my-4",
            a: "text-black underline decoration-gray-400 underline-offset-2"
        },
        // MINIMAL (EXECUTIVE) - Quiet, compact, and polished.
        minimal: {
            container: "font-sans text-gray-700 antialiased leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-sm [&>h1+p]:text-gray-500 [&>h1+p]:mb-6",
            h1: "text-3xl sm:text-[34px] font-semibold text-gray-950 mb-2 text-center",
            h2: "text-[12px] sm:text-[13px] font-bold text-gray-950 uppercase mb-3 mt-7 border-t border-gray-200 pt-3",
            h3: "text-[14px] sm:text-base font-semibold text-gray-900 mt-4 mb-1.5",
            p: "text-[13px] sm:text-sm text-gray-700 mb-2 leading-relaxed",
            ul: "list-disc list-outside ml-4 sm:ml-5 space-y-1.5 text-[13px] sm:text-sm text-gray-700 mb-4",
            li: "pl-1",
            strong: "font-semibold text-gray-950",
            hr: "border-gray-200 my-5",
            a: "text-gray-950 underline decoration-gray-300 underline-offset-2"
        },
        // EXECUTIVE (SERIF CORPORATE) - Deep navy/indigo accents, elegant serifs.
        executive: {
            container: "font-serif text-slate-900 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-sm [&>h1+p]:text-slate-500 [&>h1+p]:mb-5",
            h1: "text-3xl sm:text-[34px] font-bold text-indigo-950 mb-2 text-center border-b-2 border-indigo-950 pb-3 uppercase tracking-wide",
            h2: "text-[13px] sm:text-sm font-bold uppercase text-indigo-900 mt-6 sm:mt-7 mb-2 border-b border-indigo-200 pb-1.5",
            h3: "text-[14px] sm:text-base font-bold text-indigo-950 mt-3 sm:mt-4 mb-1",
            p: "text-[13px] sm:text-sm text-slate-800 mb-2 leading-relaxed",
            ul: "list-disc list-outside ml-4 sm:ml-5 space-y-1 text-[13px] sm:text-sm text-slate-800 mb-3 marker:text-indigo-500",
            li: "pl-1",
            strong: "font-bold text-slate-950",
            hr: "border-indigo-100 my-4",
            a: "text-indigo-900 underline decoration-indigo-300 underline-offset-2"
        },
        // TECH MONO (DEVELOPER HIGHLIGHT) - Monospace headers, clean sky/ocean accent lines.
        tech: {
            container: "font-sans text-slate-800 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-sm [&>h1+p]:text-slate-500 [&>h1+p]:mb-5",
            h1: "text-3xl sm:text-[34px] font-mono font-bold text-slate-950 mb-2 text-center border-b-2 border-sky-500 pb-3",
            h2: "text-[13px] sm:text-sm font-mono font-bold uppercase text-sky-700 mt-6 sm:mt-7 mb-2 border-l-4 border-sky-600 pl-2 py-0.5",
            h3: "text-[14px] sm:text-base font-mono font-bold text-slate-950 mt-3 sm:mt-4 mb-1",
            p: "text-[13px] sm:text-sm text-slate-700 mb-2 leading-relaxed",
            ul: "list-disc list-outside ml-4 sm:ml-5 space-y-1.5 text-[13px] sm:text-sm text-slate-700 mb-3 marker:text-sky-500",
            li: "pl-1",
            strong: "font-mono font-semibold text-slate-950 bg-slate-50 px-1 border border-slate-200/50 rounded",
            hr: "border-slate-200 my-4",
            a: "font-mono text-sky-600 underline decoration-sky-300 underline-offset-2"
        },
        // CREATIVE TEAL - Vibrant teal accents, left-accent border, sleek sans-serif.
        creative: {
            container: "font-sans text-slate-800 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-sm [&>h1+p]:text-slate-500 [&>h1+p]:mb-5",
            h1: "text-3xl sm:text-[34px] font-bold text-teal-900 mb-2 text-center border-b-2 border-teal-600 pb-3 tracking-wide",
            h2: "text-[13px] sm:text-sm font-bold uppercase text-teal-700 mt-6 sm:mt-7 mb-2 border-l-4 border-teal-600 pl-2.5 py-0.5",
            h3: "text-[14px] sm:text-base font-semibold text-slate-900 mt-3 sm:mt-4 mb-1",
            p: "text-[13px] sm:text-sm text-slate-700 mb-2 leading-relaxed",
            ul: "list-disc list-outside ml-4 sm:ml-5 space-y-1 text-[13px] sm:text-sm text-slate-700 mb-3 marker:text-teal-500",
            li: "pl-1",
            strong: "font-semibold text-slate-950",
            hr: "border-teal-100 my-4",
            a: "text-teal-600 underline decoration-teal-300 underline-offset-2"
        },
        // EMERALD CORPORATE - Deep forest emerald details, classy serif headers, elegant layout.
        emerald: {
            container: "font-serif text-slate-900 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-sm [&>h1+p]:text-slate-500 [&>h1+p]:mb-5",
            h1: "text-3xl sm:text-[34px] font-bold text-emerald-950 mb-2 text-center border-b-2 border-emerald-800 pb-3 uppercase tracking-wide",
            h2: "text-[13px] sm:text-sm font-bold uppercase text-emerald-800 mt-6 sm:mt-7 mb-2 border-b border-emerald-200 pb-1.5",
            h3: "text-[14px] sm:text-base font-bold text-emerald-950 mt-3 sm:mt-4 mb-1",
            p: "text-[13px] sm:text-sm text-slate-800 mb-2 leading-relaxed",
            ul: "list-disc list-outside ml-4 sm:ml-5 space-y-1 text-[13px] sm:text-sm text-slate-800 mb-3 marker:text-emerald-500",
            li: "pl-1",
            strong: "font-bold text-slate-950",
            hr: "border-emerald-100 my-4",
            a: "text-emerald-800 underline decoration-emerald-300 underline-offset-2"
        },
        // ELEGANT CRIMSON - Rich burgundy accents, double bottom border on headers, polished Georgia serif.
        elegant: {
            container: "font-serif text-rose-950 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-sm [&>h1+p]:text-rose-900 [&>h1+p]:mb-5",
            h1: "text-3xl sm:text-[34px] font-bold text-rose-900 mb-2 text-center border-b-4 border-double border-rose-900 pb-3 uppercase tracking-wider",
            h2: "text-[13px] sm:text-sm font-bold uppercase text-rose-800 mt-6 sm:mt-7 mb-2 border-b border-rose-200 pb-1.5",
            h3: "text-[14px] sm:text-base font-bold text-rose-950 mt-3 sm:mt-4 mb-1",
            p: "text-[13px] sm:text-sm text-rose-900 mb-2 leading-relaxed",
            ul: "list-disc list-outside ml-4 sm:ml-5 space-y-1 text-[13px] sm:text-sm text-rose-900 mb-3 marker:text-rose-700",
            li: "pl-1",
            strong: "font-bold text-rose-950",
            hr: "border-rose-100 my-4",
            a: "text-rose-800 underline decoration-rose-300 underline-offset-2"
        },
        // SLATE MODERNIST - Slate grey accent tones, clean sans-serif layout, light border lines.
        slate: {
            container: "font-sans text-slate-700 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-sm [&>h1+p]:text-slate-500 [&>h1+p]:mb-5",
            h1: "text-3xl sm:text-[34px] font-bold text-slate-900 mb-2 text-center border-b border-slate-400 pb-3",
            h2: "text-[13px] sm:text-sm font-bold uppercase text-slate-800 mt-6 sm:mt-7 mb-2 border-b border-slate-100 pb-1.5",
            h3: "text-[14px] sm:text-base font-bold text-slate-900 mt-3 sm:mt-4 mb-1",
            p: "text-[13px] sm:text-sm text-slate-600 mb-2 leading-relaxed",
            ul: "list-disc list-outside ml-4 sm:ml-5 space-y-1 text-[13px] sm:text-sm text-slate-600 mb-3 marker:text-slate-400",
            li: "pl-1",
            strong: "font-semibold text-slate-900",
            hr: "border-slate-100 my-4",
            a: "text-slate-800 underline decoration-slate-300 underline-offset-2"
        }
    };

    const s = styles[template] || styles.modern;

    // Pre-process content to fix common AI formatting issues
    const cleanContent = content
        // 0. Convert literal \n (backslash + n as text) into real newlines
        //    This handles cases where the AI returns escaped newlines in JSON strings
        .replace(/\\n/g, '\n')
        // 1. Ensure newlines before lists to trigger markdown parsing
        .replace(/([^\n])\n\*/g, '$1\n\n*')
        .replace(/([^\n])\n-/g, '$1\n\n-')
        // 1b. Convert standalone * at line start to proper list items
        .replace(/^\* /gm, '* ')
        // 2. Ensure headers have space around them
        .replace(/([^\n])\n#/g, '$1\n\n#')
        // 3. Remove excessive newlines (3+ -> 2) to avoid huge gaps
        .replace(/\n{3,}/g, '\n\n')
        // 4. Ensure ** bold markers ** are not broken by stray whitespace
        .replace(/\*\*\s*\n\s*\*\*/g, '** **');

    return (
        <div className={`resume-content max-w-none print:p-0 ${s.container}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ ...props }) => <h1 className={s.h1} {...props} />,
                    h2: ({ ...props }) => <h2 className={s.h2} {...props} />,
                    // Handle H3 specifically to avoid it looking like body text if AI uses it for job titles
                    h3: ({ ...props }) => <h3 className={s.h3} {...props} />,
                    // Map H4/H5/H6 to H3 style but slightly smaller if needed, or same
                    h4: ({ ...props }) => <h4 className={s.h3} {...props} />,
                    ul: ({ ...props }) => <ul className={s.ul} {...props} />,
                    ol: ({ ...props }) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-1 text-sm" {...props} />,
                    li: ({ children, ...props }) => {
                        // Fix for when "li" contains a "p" tag (common in some markdown parsers) which breaks spacing
                        // We unwrap the p if it's the only child, or style it to be inline
                        return (
                            <li className={s.li} {...props}>
                                {children}
                            </li>
                        );
                    },
                    // Paragraphs
                    p: ({ ...props }) => <p className={s.p} {...props} />,
                    strong: ({ ...props }) => <strong className={s.strong} {...props} />,
                    b: ({ ...props }) => <strong className={s.strong} {...props} />,
                    a: ({ ...props }) => <a className={s.a} {...props} target="_blank" rel="noopener noreferrer" />,
                    hr: ({ ...props }) => <hr className={s.hr} {...props} />,
                    blockquote: ({ ...props }) => <blockquote className="border-l-4 border-gray-200 pl-4 py-1 my-4 italic text-gray-600" {...props} />,
                    table: ({ ...props }) => <table className="my-4 w-full border-collapse text-[13px] sm:text-sm" {...props} />,
                    th: ({ ...props }) => <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-semibold text-slate-900" {...props} />,
                    td: ({ ...props }) => <td className="border border-slate-200 px-2 py-1.5 align-top text-slate-700" {...props} />,
                }}
            >
                {cleanContent}
            </ReactMarkdown>
        </div>
    );
}
