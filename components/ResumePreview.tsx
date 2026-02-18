
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ResumePreviewProps {
    content: string;
    title?: string | null;
    company?: string | null;
    template?: 'modern' | 'classic' | 'minimal';
}

export function ResumePreview({ content, title, company, template = 'modern' }: ResumePreviewProps) {

    // Template-specific classes
    const styles = {
        // MODERN POLISHED - Visual impact, clean sans-serif
        modern: {
            container: "font-sans text-slate-800 leading-relaxed",
            // H1 = Name
            h1: "text-4xl font-extrabold tracking-tight text-slate-900 mb-2 border-b-4 border-blue-600 pb-4",
            // H2 = Section Title
            h2: "text-lg font-bold uppercase tracking-wider text-blue-700 mt-8 mb-4 flex items-center after:content-[''] after:flex-1 after:h-px after:bg-blue-200 after:ml-4",
            h3: "text-base font-bold text-slate-900 mt-4 mb-1",
            p: "text-sm text-slate-700 mb-2 leading-relaxed",
            ul: "list-disc list-outside ml-4 space-y-1 text-sm text-slate-700 mb-4 marker:text-blue-500",
            li: "pl-1",
            strong: "font-bold text-slate-900",
            hr: "border-slate-200 my-4",
            a: "text-blue-600 hover:text-blue-800 underline decoration-blue-300 underline-offset-2"
        },
        // CLASSIC (PROFESSIONAL ATS) - Traditional, serif headings, very safe parsing
        classic: {
            container: "font-serif text-gray-900 leading-normal",
            // H1 = Name
            h1: "text-3xl font-bold text-center text-gray-900 mb-6 uppercase tracking-wide border-b border-gray-900 pb-2",
            // H2 = Section Title
            h2: "text-base font-bold text-gray-900 uppercase border-b border-gray-400 pb-1 mb-3 mt-6 tracking-widest",
            h3: "text-base font-bold text-gray-900 mt-4 mb-1",
            p: "text-sm text-gray-800 mb-2",
            ul: "list-disc list-outside ml-5 space-y-1 text-sm text-gray-800 mb-3",
            li: "pl-0",
            strong: "font-bold text-gray-950",
            hr: "border-gray-300 my-4",
            a: "text-black underline decoration-gray-400 underline-offset-2"
        },
        // MINIMAL (EXECUTIVE) - Clean, sophisticated, airy
        minimal: {
            container: "font-sans text-gray-600 antialiased",
            // H1 = Name
            h1: "text-4xl font-light text-gray-900 mb-8 tracking-tight",
            // H2 = Section Title
            h2: "text-xs font-bold text-gray-900 uppercase tracking-[0.2em] mb-4 mt-10 border-t border-gray-100 pt-4",
            h3: "text-base font-medium text-gray-800 mt-6 mb-2",
            p: "text-sm text-gray-600 mb-3 font-light leading-7",
            ul: "list-none space-y-2 text-sm text-gray-600 mb-6",
            li: "relative pl-4 before:content-[''] before:absolute before:left-0 before:top-2.5 before:w-1 before:h-1 before:bg-gray-300 before:rounded-full",
            strong: "font-semibold text-gray-900",
            hr: "border-gray-100 my-8",
            a: "text-gray-900 border-b border-gray-300 hover:border-gray-900 transition-colors"
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
                    h1: ({ node, ...props }) => <h1 className={s.h1} {...props} />,
                    h2: ({ node, ...props }) => <h2 className={s.h2} {...props} />,
                    // Handle H3 specifically to avoid it looking like body text if AI uses it for job titles
                    h3: ({ node, ...props }) => <h3 className={s.h3} {...props} />,
                    // Map H4/H5/H6 to H3 style but slightly smaller if needed, or same
                    h4: ({ node, ...props }) => <h4 className={s.h3} {...props} />,
                    ul: ({ node, ...props }) => <ul className={s.ul} {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-1 text-sm" {...props} />,
                    li: ({ node, children, ...props }) => {
                        // Fix for when "li" contains a "p" tag (common in some markdown parsers) which breaks spacing
                        // We unwrap the p if it's the only child, or style it to be inline
                        return (
                            <li className={s.li} {...props}>
                                {children}
                            </li>
                        );
                    },
                    // Paragraphs
                    p: ({ node, ...props }) => <p className={s.p} {...props} />,
                    strong: ({ node, ...props }) => <strong className={s.strong} {...props} />,
                    b: ({ node, ...props }) => <strong className={s.strong} {...props} />,
                    a: ({ node, ...props }) => <a className={s.a} {...props} target="_blank" rel="noopener noreferrer" />,
                    hr: ({ node, ...props }) => <hr className={s.hr} {...props} />,
                    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-200 pl-4 py-1 my-4 italic text-gray-600" {...props} />,
                }}
            >
                {cleanContent}
            </ReactMarkdown>
        </div>
    );
}
