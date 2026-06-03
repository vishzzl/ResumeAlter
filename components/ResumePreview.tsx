
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ResumePreviewProps {
    content: string;
    title?: string | null;
    company?: string | null;
    template?: 'modern' | 'classic' | 'minimal' | 'executive' | 'tech' | 'creative' | 'emerald' | 'elegant' | 'slate' | 'startup' | 'banking' | 'academia';
}

export function ResumePreview({ content, template = 'modern' }: ResumePreviewProps) {

    // Template-specific classes
    const styles = {
        // MODERN POLISHED
        modern: {
            container: "font-sans text-slate-800 leading-relaxed break-words [&>h1+p]:text-[12px] [&>h1+p]:sm:text-[13px] [&>h1+p]:text-slate-500 [&>h1+p]:mb-6",
            h1: "text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight",
            h2: "text-[13px] sm:text-[15px] font-bold uppercase tracking-wider text-slate-900 mt-6 sm:mt-8 mb-3 border-b-2 border-slate-200 pb-2",
            h3: "text-[14px] sm:text-base font-bold text-slate-900 mt-4 mb-1.5",
            p: "text-[13px] sm:text-[14.5px] text-slate-700 mb-2.5 leading-relaxed",
            ul: "list-disc list-outside ml-5 sm:ml-6 space-y-1.5 text-[13px] sm:text-[14.5px] text-slate-700 mb-4 marker:text-slate-400",
            li: "pl-1.5",
            strong: "font-semibold text-slate-900",
            hr: "border-slate-200 my-5",
            a: "text-blue-600 hover:text-blue-800 transition-colors underline decoration-blue-300 underline-offset-4 print:text-inherit print:decoration-gray-400"
        },
        // CLASSIC (PROFESSIONAL ATS)
        classic: {
            container: "font-serif text-gray-900 leading-normal break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-[13px] [&>h1+p]:text-gray-600 [&>h1+p]:mb-5",
            h1: "text-2xl sm:text-[32px] font-bold text-center text-black mb-2 uppercase tracking-wide border-b border-black pb-2",
            h2: "text-[13px] sm:text-[14px] font-bold text-black uppercase border-b border-gray-400 pb-1.5 mb-3 mt-6 sm:mt-8 tracking-widest",
            h3: "text-[14px] sm:text-base font-bold text-black mt-4 mb-1",
            p: "text-[13px] sm:text-[14px] text-gray-800 mb-2 leading-[1.6]",
            ul: "list-disc list-outside ml-4 sm:ml-5 space-y-1 text-[13px] sm:text-[14px] text-gray-800 mb-3",
            li: "pl-1",
            strong: "font-bold text-black",
            hr: "border-gray-300 my-4 sm:my-5",
            a: "text-black underline decoration-gray-400 hover:decoration-black underline-offset-2"
        },
        // MINIMAL (EXECUTIVE)
        minimal: {
            container: "font-sans text-neutral-700 antialiased leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-[13px] [&>h1+p]:text-neutral-500 [&>h1+p]:mb-6",
            h1: "text-3xl sm:text-[36px] font-light text-neutral-950 mb-2 text-center tracking-tight",
            h2: "text-[11px] sm:text-[12px] font-semibold text-neutral-900 uppercase mb-3 mt-8 border-t border-neutral-200 pt-3 tracking-[0.2em]",
            h3: "text-[14px] sm:text-[15px] font-medium text-neutral-900 mt-4 mb-1.5",
            p: "text-[13px] sm:text-[14px] text-neutral-700 mb-2 leading-[1.7]",
            ul: "list-disc list-outside ml-4 sm:ml-5 space-y-1.5 text-[13px] sm:text-[14px] text-neutral-700 mb-4 marker:text-neutral-300",
            li: "pl-2",
            strong: "font-medium text-neutral-950",
            hr: "border-neutral-100 my-6",
            a: "text-neutral-950 hover:text-black transition-colors underline decoration-neutral-200 underline-offset-4"
        },
        // EXECUTIVE (SERIF CORPORATE)
        executive: {
            container: "font-serif text-slate-900 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-[13px] [&>h1+p]:text-slate-600 [&>h1+p]:mb-6",
            h1: "text-3xl sm:text-4xl font-bold text-[#1e3a8a] mb-2 text-center border-b-2 border-[#1e3a8a] pb-3 uppercase tracking-[0.1em]",
            h2: "text-[13px] sm:text-[14px] font-bold uppercase text-[#1e3a8a] mt-6 sm:mt-8 mb-3 border-b-[1.5px] border-[#1e3a8a] pb-1.5 tracking-wider",
            h3: "text-[14px] sm:text-base font-bold text-slate-900 mt-4 mb-1",
            p: "text-[13px] sm:text-[14.5px] text-slate-800 mb-2.5 leading-relaxed",
            ul: "list-none list-outside ml-0 space-y-2 text-[13px] sm:text-[14.5px] text-slate-800 mb-4 [&>li]:relative [&>li]:pl-4 [&>li::before]:content-['\\2022'] [&>li::before]:absolute [&>li::before]:left-0 [&>li::before]:text-[#1e3a8a]",
            li: "",
            strong: "font-bold text-slate-950",
            hr: "border-slate-200 my-5",
            a: "text-[#1e3a8a] underline decoration-slate-300 underline-offset-2 print:text-inherit"
        },
        // TECH MONO (DEVELOPER HIGHLIGHT)
        tech: {
            container: "font-sans text-slate-800 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-[13px] [&>h1+p]:text-slate-500 [&>h1+p]:mb-6",
            h1: "text-3xl sm:text-[34px] font-mono font-bold text-slate-900 mb-2 text-center border-b-2 border-indigo-500 pb-3",
            h2: "text-[12px] sm:text-[13px] font-mono font-bold uppercase text-indigo-700 mt-6 sm:mt-8 mb-3 border-l-4 border-indigo-600 pl-3 py-0.5 tracking-wider bg-indigo-50/50",
            h3: "text-[14px] sm:text-base font-mono font-semibold text-slate-900 mt-4 mb-1.5",
            p: "text-[13px] sm:text-[14px] text-slate-700 mb-2.5 leading-relaxed",
            ul: "list-disc list-outside ml-5 sm:ml-6 space-y-1.5 text-[13px] sm:text-[14px] text-slate-700 mb-4 marker:text-indigo-400",
            li: "pl-1.5",
            strong: "font-mono font-semibold text-slate-900",
            hr: "border-slate-200 my-5",
            a: "font-mono text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-indigo-200 underline-offset-4 print:text-inherit"
        },
        // CREATIVE TEAL
        creative: {
            container: "font-sans text-slate-800 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-[13px] [&>h1+p]:text-slate-500 [&>h1+p]:mb-6",
            h1: "text-3xl sm:text-[36px] font-black text-teal-950 mb-2 text-center tracking-tight",
            h2: "text-[13px] sm:text-[14px] font-extrabold uppercase text-teal-800 mt-6 sm:mt-8 mb-3 border-b-[3px] border-teal-500 pb-1 tracking-widest",
            h3: "text-[14px] sm:text-base font-bold text-slate-900 mt-4 mb-1.5",
            p: "text-[13px] sm:text-[14.5px] text-slate-700 mb-2.5 leading-[1.7]",
            ul: "list-disc list-outside ml-5 sm:ml-6 space-y-1.5 text-[13px] sm:text-[14.5px] text-slate-700 mb-4 marker:text-teal-500",
            li: "pl-1.5",
            strong: "font-bold text-slate-950",
            hr: "border-teal-100 my-6",
            a: "text-teal-700 hover:text-teal-900 transition-colors underline decoration-teal-300 underline-offset-4 print:text-inherit"
        },
        // EMERALD CORPORATE
        emerald: {
            container: "font-serif text-slate-900 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-[13px] [&>h1+p]:text-slate-600 [&>h1+p]:mb-6",
            h1: "text-3xl sm:text-[36px] font-bold text-emerald-950 mb-2 text-center border-b border-emerald-900 pb-4 uppercase tracking-[0.05em]",
            h2: "text-[13px] sm:text-[14px] font-bold uppercase text-emerald-800 mt-6 sm:mt-8 mb-3 border-b border-emerald-200 pb-2 tracking-widest",
            h3: "text-[14px] sm:text-base font-bold text-emerald-950 mt-4 mb-1.5",
            p: "text-[13px] sm:text-[14.5px] text-slate-800 mb-2.5 leading-relaxed",
            ul: "list-disc list-outside ml-5 sm:ml-6 space-y-1.5 text-[13px] sm:text-[14.5px] text-slate-800 mb-4 marker:text-emerald-600",
            li: "pl-1.5",
            strong: "font-bold text-slate-950",
            hr: "border-emerald-100 my-5",
            a: "text-emerald-700 hover:text-emerald-900 transition-colors underline decoration-emerald-200 underline-offset-4"
        },
        // ELEGANT CRIMSON
        elegant: {
            container: "font-serif text-slate-900 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-[13px] [&>h1+p]:text-rose-900 [&>h1+p]:mb-6",
            h1: "text-3xl sm:text-[36px] font-bold text-rose-950 mb-2 text-center border-b-[3px] border-double border-rose-900 pb-3 uppercase tracking-widest",
            h2: "text-[13px] sm:text-[14px] font-bold uppercase text-rose-900 mt-6 sm:mt-8 mb-3 border-b border-rose-200 pb-1.5 tracking-[0.15em]",
            h3: "text-[14px] sm:text-[16px] font-bold text-rose-950 mt-4 mb-1.5",
            p: "text-[13px] sm:text-[14.5px] text-slate-800 mb-2.5 leading-[1.65]",
            ul: "list-disc list-outside ml-5 sm:ml-6 space-y-1.5 text-[13px] sm:text-[14.5px] text-slate-800 mb-4 marker:text-rose-800",
            li: "pl-1.5",
            strong: "font-bold text-black",
            hr: "border-rose-100 my-5",
            a: "text-rose-800 hover:text-rose-950 transition-colors underline decoration-rose-300 underline-offset-4 print:text-inherit"
        },
        // SLATE MODERNIST
        slate: {
            container: "font-sans text-slate-700 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-[13px] [&>h1+p]:text-slate-500 [&>h1+p]:mb-6",
            h1: "text-3xl sm:text-[36px] font-bold text-slate-900 mb-2 text-center pb-4 tracking-tight",
            h2: "text-[12px] sm:text-[13px] font-bold uppercase text-slate-800 mt-6 sm:mt-8 mb-3 pb-1 border-b-[2px] border-slate-900 tracking-widest",
            h3: "text-[14px] sm:text-base font-bold text-slate-900 mt-4 mb-1.5",
            p: "text-[13px] sm:text-[14.5px] text-slate-600 mb-2.5 leading-[1.7]",
            ul: "list-disc list-outside ml-5 sm:ml-6 space-y-1.5 text-[13px] sm:text-[14.5px] text-slate-600 mb-4 marker:text-slate-400",
            li: "pl-1.5",
            strong: "font-semibold text-slate-900",
            hr: "border-slate-200 my-6",
            a: "text-slate-800 hover:text-black transition-colors underline decoration-slate-300 underline-offset-4 print:text-inherit"
        },
        // STARTUP (High Impact, Vibrant, Clean)
        startup: {
            container: "font-sans text-gray-800 leading-relaxed break-words [&>h1+p]:text-center [&>h1+p]:text-[12px] [&>h1+p]:sm:text-[13px] [&>h1+p]:text-violet-600 [&>h1+p]:font-medium [&>h1+p]:mb-6",
            h1: "text-4xl sm:text-[42px] font-black text-gray-950 mb-1 text-center tracking-tighter",
            h2: "text-[14px] sm:text-[15px] font-extrabold uppercase text-violet-700 mt-6 sm:mt-8 mb-3 bg-violet-50 px-3 py-1 rounded-md tracking-widest print:bg-transparent",
            h3: "text-[15px] sm:text-[17px] font-bold text-gray-900 mt-4 mb-1.5",
            p: "text-[13.5px] sm:text-[15px] text-gray-700 mb-2.5 leading-[1.65]",
            ul: "list-disc list-outside ml-5 sm:ml-6 space-y-2 text-[13.5px] sm:text-[15px] text-gray-700 mb-4 marker:text-violet-500",
            li: "pl-1.5",
            strong: "font-bold text-gray-950",
            hr: "border-violet-100 my-6 border-dashed",
            a: "text-violet-600 hover:text-violet-800 font-medium transition-colors underline decoration-violet-200 underline-offset-4 print:text-inherit"
        },
        // BANKING (Strictly traditional, Investment Banking standard)
        banking: {
            container: "font-serif text-black leading-tight break-words [&>h1+p]:text-center [&>h1+p]:text-[11px] [&>h1+p]:sm:text-[12px] [&>h1+p]:text-black [&>h1+p]:mb-4",
            h1: "text-2xl sm:text-[28px] font-bold text-center text-black mb-1 uppercase tracking-normal",
            h2: "text-[12px] sm:text-[13px] font-bold text-black uppercase border-b border-black pb-0.5 mb-2 mt-4 sm:mt-5",
            h3: "text-[13px] sm:text-[14px] font-bold text-black mt-3 mb-1",
            p: "text-[12px] sm:text-[12.5px] text-black mb-1.5 leading-[1.4]",
            ul: "list-disc list-outside ml-4 sm:ml-5 space-y-1 text-[12px] sm:text-[12.5px] text-black mb-2 marker:text-black",
            li: "pl-1",
            strong: "font-bold text-black",
            hr: "border-black my-3 border-[0.5px]",
            a: "text-black underline"
        },
        // ACADEMIA (Wide text spacing, classic serif, formal)
        academia: {
            container: "font-serif text-gray-900 leading-[1.8] break-words [&>h1+p]:text-center [&>h1+p]:text-[13px] [&>h1+p]:sm:text-[14px] [&>h1+p]:text-gray-700 [&>h1+p]:mb-6",
            h1: "text-3xl sm:text-[36px] font-medium text-center text-black mb-3 tracking-wide",
            h2: "text-[14px] sm:text-[16px] font-bold text-black border-b border-gray-300 pb-2 mb-3 mt-6 sm:mt-7 tracking-widest uppercase",
            h3: "text-[15px] sm:text-[17px] font-bold text-black mt-4 mb-2",
            p: "text-[14px] sm:text-[15px] text-gray-800 mb-2.5",
            ul: "list-disc list-outside ml-6 sm:ml-8 space-y-1.5 text-[14px] sm:text-[15px] text-gray-800 mb-4 marker:text-gray-500",
            li: "pl-2",
            strong: "font-bold text-black",
            hr: "border-gray-200 my-5",
            a: "text-blue-800 hover:text-blue-900 underline decoration-blue-200 hover:decoration-blue-400 underline-offset-4 transition-colors print:text-inherit"
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
        <div className={`resume-content max-w-none print:p-0 ${s.container}`} role="document" aria-label="Resume preview">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ ...props }) => <h1 className={s.h1} {...props} />,
                    h2: ({ ...props }) => <h2 className={s.h2} {...props} />,
                    // Handle H3 specifically to avoid it looking like body text if AI uses it for job titles
                    h3: ({ ...props }) => <h3 className={`${s.h3} break-inside-avoid break-after-avoid`} {...props} />,
                    // Map H4/H5/H6 to H3 style but slightly smaller if needed, or same
                    h4: ({ ...props }) => <h4 className={s.h3} {...props} />,
                    ul: ({ ...props }) => <ul className={`${s.ul} break-inside-avoid`} {...props} />,
                    ol: ({ ...props }) => <ol className={`list-decimal list-outside ml-5 mb-4 space-y-1 ${s.p} break-inside-avoid`} {...props} />,
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
