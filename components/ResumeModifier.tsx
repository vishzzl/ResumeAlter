'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Sparkles, Upload, FileText, Download, Copy, Check, Eye,
  GitCompare, Code, RefreshCw, Zap,
  Wand2, ChevronDown, ChevronUp, RotateCcw, Award, Sun, Moon, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResumePreview } from '@/components/ResumePreview';
import { DiffViewer } from '@/components/DiffViewer';
import { ModelSelector } from '@/components/ModelSelector';
import { exportResumePDF } from '@/lib/pdf-export';

const SAMPLE_RESUME = `# ALEX MORGAN
Senior Full Stack Engineer
alex.morgan@email.com | (555) 019-2834 | San Francisco, CA | github.com/alexmorgan | linkedin.com/in/alexmorgan

## PROFESSIONAL SUMMARY
Results-driven Senior Full Stack Engineer with 6+ years of experience designing and building scalable web applications. Expert in React, TypeScript, Node.js, and PostgreSQL. Proven track record of improving site performance by 40% and leading high-performing engineering teams.

## SKILLS
* Languages & Frameworks: JavaScript (ES6+), TypeScript, React, Next.js, Node.js, Express, Python, HTML5, CSS3/Tailwind
* Databases & Cloud: PostgreSQL, MongoDB, Redis, AWS (S3, EC2, Lambda), Docker, CI/CD pipelines
* Architecture & Tools: Microservices, REST APIs, GraphQL, Git, Jest, Cypress, System Architecture

## EXPERIENCE
Senior Software Engineer | TechCorp Inc. | San Francisco, CA | 2021 – Present
* Led a team of 5 engineers to re-architect core ecommerce checkout flow using Next.js and TypeScript, increasing conversion rates by 18%.
* Reduced API response times by 45% by introducing Redis caching layer and optimizing PostgreSQL queries.
* Implemented automated CI/CD pipeline using GitHub Actions, cutting deployment time from 40 minutes to 8 minutes.

Software Engineer | DevStream Systems | Austin, TX | 2018 – 2021
* Built responsive real-time dashboard UI using React and WebSockets handling over 100k daily active users.
* Migrated monolithic backend service into Node.js microservices, reducing infrastructure costs by $35,000 annually.
* Conducted code reviews, mentored 3 junior developers, and established frontend testing best practices with Jest.

## EDUCATION
B.S. in Computer Science | University of Texas at Austin | 2014 – 2018
`;

const SAMPLE_JD = `Senior Frontend / Full Stack Engineer

We are seeking an experienced Senior Software Engineer to join our core product team. You will lead the frontend architecture using Next.js, React, and TypeScript while collaborating with backend systems in Node.js and AWS.

Requirements:
- 5+ years experience building complex web applications with React and TypeScript.
- Strong expertise in site speed optimization, performance metrics, and clean UI architecture.
- Experience with AWS cloud infrastructure, microservices, and serverless environments.
- Excellent track record of mentoring junior developers and driving technical standards.
- Passion for crafting accessible, high-performing user interfaces.
`;

const COMMON_TECH_KEYWORDS = [
  'React', 'Next.js', 'TypeScript', 'JavaScript', 'Node.js', 'Express', 'Python',
  'PostgreSQL', 'MongoDB', 'Redis', 'AWS', 'Docker', 'CI/CD', 'REST APIs',
  'GraphQL', 'Microservices', 'Jest', 'Cypress', 'System Architecture', 'Git',
  'Kubernetes', 'Tailwind', 'HTML5', 'CSS3', 'Agile', 'Scrum', 'Performance', 'WebSockets'
];

function extractJDKeywords(jdText: string): string[] {
  if (!jdText) return [];
  const found: string[] = [];
  for (const kw of COMMON_TECH_KEYWORDS) {
    const regex = new RegExp(`\\b${kw.replace('.', '\\.')}\\b`, 'i');
    if (regex.test(jdText)) {
      found.push(kw);
    }
  }
  return found;
}

const PROMPT_PRESETS = [
  { label: '📊 Quantify Metrics & Impact', prompt: 'Enhance bullet points by adding concrete metrics, percentages, and data-driven achievements wherever applicable.' },
  { label: '🚀 ATS Keyword Optimization', prompt: 'Identify missing technical keywords from the job description and seamlessly integrate them into skills and experience bullets.' },
  { label: '⚡ Strong Action Verbs', prompt: 'Rewrite experience bullets starting with high-impact power action verbs (e.g., Architected, Engineered, Spearheaded).' },
  { label: '📄 Concise 1-Page Summary', prompt: 'Condense descriptions into concise, high-value bullet points optimized for a clean 1-page resume layout.' },
  { label: '🧹 Clean Formatting & Syntax', prompt: 'Standardize section headers, bullet formatting, and fix any grammar or phrasing inconsistencies.' },
];

export function ResumeModifier() {
  // Theme state (Dark vs Light mode)
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check initial preference from document or localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Input states
  const [baseResume, setBaseResume] = useState(SAMPLE_RESUME);
  const [jobDescription, setJobDescription] = useState(SAMPLE_JD);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<'modern' | 'classic' | 'minimal' | 'executive' | 'tech'>('modern');

  // AI & Processing states
  const [isModifying, setIsModifying] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [modifiedResume, setModifiedResume] = useState('');
  const [atsScore, setAtsScore] = useState<{ before: number; after: number } | null>(null);
  const [changes, setChanges] = useState<Array<{ section?: string; reason?: string }>>([]);

  // Versioning & History Shelf State
  const [savedVersions, setSavedVersions] = useState<Array<{ id: string; name: string; text: string; score?: number; timestamp: string }>>([
    { id: 'v0', name: 'Original Resume', text: SAMPLE_RESUME, timestamp: 'Initial' }
  ]);
  const [activeVersionId, setActiveVersionId] = useState<string>('current');

  // Keyword Highlighting Toggle State
  const [highlightKeywords, setHighlightKeywords] = useState(false);

  // UI state
  const [viewMode, setViewMode] = useState<'preview' | 'edit' | 'diff'>('preview');
  const [copied, setCopied] = useState(false);
  const [showAdvancedPrompts, setShowAdvancedPrompts] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick preset toggle handler
  const handleAddPresetPrompt = (presetText: string) => {
    if (customPrompt.includes(presetText)) return;
    setCustomPrompt(prev => prev ? `${prev}\n• ${presetText}` : `• ${presetText}`);
  };

  // Add missing keyword to custom prompt
  const handleAddMissingKeyword = (kw: string) => {
    const textToAdd = `• Highlight and include ${kw} technical experience`;
    if (customPrompt.includes(kw)) return;
    setCustomPrompt(prev => prev ? `${prev}\n${textToAdd}` : textToAdd);
    toast.success(`Added directive for missing keyword: ${kw}`);
  };

  // Upload resume file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/parse-resume', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('File upload failed');
      const data = await res.json();
      if (data.text) {
        setBaseResume(data.text);
        toast.success('Resume uploaded successfully!');
      }
    } catch (err) {
      toast.error('Failed to parse file. Please copy & paste the text directly.');
    } finally {
      setIsUploading(false);
    }
  };

  // Main Resume Modification Handler
  const handleModifyResume = async () => {
    if (!baseResume.trim()) {
      toast.error('Please enter or upload a base resume first.');
      return;
    }

    setIsModifying(true);
    setCurrentPhase('Preparing AI request...');
    setAtsScore(null);
    setChanges([]);

    let finalJobContext = jobDescription.trim();
    if (customPrompt.trim()) {
      finalJobContext += `\n\nUSER CUSTOM MODIFICATION INSTRUCTIONS:\n${customPrompt.trim()}`;
    }

    try {
      const apiKey = localStorage.getItem('gemini_api_key') || '';
      const modelProvider = 'gemini';
      const modelName = localStorage.getItem('resume_alter_model') || 'gemini-1.5-flash';

      const res = await fetch('/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: baseResume,
          jobDescription: finalJobContext,
          apiKey,
          modelProvider,
          modelName,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server Error: ${res.status}`);
      }

      if (!res.body) throw new Error('No stream body received.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });
        const lines = accumulated.split('\n\n');
        accumulated = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.phase === 'formatting') setCurrentPhase('Formatting Markdown structure...');
              else if (event.phase === 'extracting') setCurrentPhase('Analyzing keywords & target requirements...');
              else if (event.phase === 'tailoring') setCurrentPhase('Rewriting & tailoring resume bullets...');
              else if (event.phase === 'verifying') setCurrentPhase('Verifying metrics & groundedness...');
              else if (event.phase === 'gap_check') setCurrentPhase('Optimizing ATS keyword coverage...');
              else if (event.phase === 'tailored' && event.data?.tailoredResume) {
                setModifiedResume(event.data.tailoredResume);
              } else if (event.phase === 'analyzing') setCurrentPhase('Calculating ATS Score...');
              else if (event.phase === 'complete') {
                if (event.data?.tailoredResume) {
                  const newRes = event.data.tailoredResume;
                  setModifiedResume(newRes);
                  const vId = `v${Date.now()}`;
                  const vName = `Version ${savedVersions.length} (${event.data?.atsScore?.after || 90}% ATS Match)`;
                  setSavedVersions(prev => [
                    ...prev,
                    { id: vId, name: vName, text: newRes, score: event.data?.atsScore?.after, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
                  ]);
                  setActiveVersionId(vId);
                }
                if (event.data?.atsScore) setAtsScore(event.data.atsScore);
                if (event.data?.changes) setChanges(event.data.changes);
                toast.success('🎉 Resume modified & ATS optimized!');
              }
            } catch (e) {
              // ignore json parse error
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Modification failed:', err);
      toast.error(err.message || 'Failed to modify resume. Please try again.');
    } finally {
      setIsModifying(false);
      setCurrentPhase(null);
    }
  };

  // Copy output resume to clipboard
  const handleCopy = () => {
    const textToCopy = modifiedResume || baseResume;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Copied resume to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    const content = modifiedResume || baseResume;
    if (!content) return;
    try {
      await exportResumePDF(content, { template: selectedTemplate, fileName: 'Modified_Resume' });
      toast.success('Downloaded PDF resume!');
    } catch (err) {
      toast.error('Failed to export PDF.');
    }
  };

  // Download TXT / Markdown
  const handleDownloadTXT = () => {
    const content = modifiedResume || baseResume;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Modified_Resume.md';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded Markdown file!');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#e6e1d6] dark:bg-[#0c0e14] text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">
      
      {/* Skeuomorphic Header Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 bg-[#f0eae1]/90 dark:bg-[#141822]/90 backdrop-blur-md border-b border-[#e0d8c9] dark:border-[#1f2533] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-b from-amber-600 to-amber-800 dark:from-indigo-600 dark:to-indigo-900 text-white shadow-md border border-amber-500/30">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Resume Modifier Studio
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">Craft, refine & optimize your resume with tactile precision</p>
          </div>
        </div>

        {/* Right Header Toolbar (Theme Toggle + Actions + Model Selector) */}
        <div className="flex items-center gap-3">
          {/* Dark / Light Mode Switcher Button */}
          <button
            onClick={toggleTheme}
            className="skeuo-button-secondary px-3 py-1.5 flex items-center gap-2 text-xs font-semibold"
            title="Toggle Light / Dark Studio Theme"
          >
            {isDark ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600" />
                <span>Dark Mode</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setBaseResume(SAMPLE_RESUME);
              setJobDescription(SAMPLE_JD);
              toast.info('Loaded sample resume & job description!');
            }}
            className="skeuo-button-secondary px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Load Sample
          </button>

          <ModelSelector />
        </div>
      </header>

      {/* Main Workspace Layout - Restructured to 3 Columns */}
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 p-4 lg:p-6">

        {/* COLUMN 1: Original Resume Input Plate (col-span-3) */}
        <div className="xl:col-span-3 flex flex-col gap-4 overflow-y-auto">
          <div className="skeuo-panel p-5 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between pb-2 border-b border-[#dcd5c9] dark:border-[#282e3c]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-700 dark:text-indigo-400" />
                <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-wider uppercase">
                  1. Original Resume
                </h2>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="skeuo-button-secondary px-2.5 py-1 text-xs flex items-center gap-1 font-semibold"
              >
                <Upload className="w-3.5 h-3.5" />
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>

            <div className="relative flex-1 flex flex-col">
              <textarea
                value={baseResume}
                onChange={e => setBaseResume(e.target.value)}
                placeholder="Paste your base resume here (Markdown or Plain Text)..."
                rows={22}
                className="skeuo-well w-full p-3.5 text-xs font-mono focus:outline-none resize-none flex-1 min-h-[350px]"
              />
            </div>
          </div>
        </div>

        {/* COLUMN 2: Target Context & AI Directives Plate (col-span-4) */}
        <div className="xl:col-span-4 flex flex-col gap-4 overflow-y-auto">
          <div className="skeuo-panel p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#dcd5c9] dark:border-[#282e3c]">
              <Sparkles className="w-4 h-4 text-amber-700 dark:text-indigo-400" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-wider uppercase">
                2. Role Context & AI Directives
              </h2>
            </div>

            {/* Target Job Description Sub-section */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Job Description
                </label>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">ATS Match</span>
              </div>
              <textarea
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
                placeholder="Paste target job description..."
                rows={4}
                className="skeuo-well w-full p-3 text-xs focus:outline-none resize-y"
              />
            </div>

            {/* ATS Keyword Coverage & Gap Meter */}
            {(() => {
              const allJDKeywords = extractJDKeywords(jobDescription);
              if (allJDKeywords.length === 0) return null;
              const textToScan = (modifiedResume || baseResume).toLowerCase();
              const matched = allJDKeywords.filter(kw => textToScan.includes(kw.toLowerCase()));
              const missing = allJDKeywords.filter(kw => !textToScan.includes(kw.toLowerCase()));
              const percent = Math.round((matched.length / allJDKeywords.length) * 100);

              return (
                <div className="p-3 bg-[#e6e0d4] dark:bg-[#121620] border border-[#d4cbba] dark:border-[#222838] rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                      Keyword Coverage ({matched.length}/{allJDKeywords.length})
                    </span>
                    <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">{percent}%</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-[#d2c9b8] dark:bg-[#1f2534] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 transition-all duration-500" style={{ width: `${percent}%` }} />
                  </div>

                  {/* Chips */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {matched.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-900/50">
                        ✓ {kw}
                      </span>
                    ))}
                    {missing.map((kw, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAddMissingKeyword(kw)}
                        className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-900/50 hover:bg-amber-200 transition-colors"
                        title="Click to add directive to include this keyword"
                      >
                        + {kw}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Quick AI Presets Sub-section */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-[#e2dcd0] dark:border-[#222836]">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Directive Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddPresetPrompt(preset.prompt)}
                    className="skeuo-button-secondary px-2.5 py-1 text-[11px] font-medium transition-all hover:scale-[1.02]"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Directives Box Sub-section */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-[#e2dcd0] dark:border-[#222836]">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Custom Modification Directives
              </label>
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="e.g. Focus on cloud architecture metrics, emphasize React experience..."
                rows={3}
                className="skeuo-well w-full p-3 text-xs focus:outline-none resize-y"
              />
            </div>

            {/* Advanced Rules Drawer Sub-section */}
            <div className="border-t border-[#d8cfc0] dark:border-[#282e3c] pt-2">
              <button
                type="button"
                onClick={() => setShowAdvancedPrompts(!showAdvancedPrompts)}
                className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 py-1"
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-indigo-400" />
                  Advanced Guarantees
                </span>
                {showAdvancedPrompts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvancedPrompts && (
                <div className="mt-2 p-3 skeuo-well text-[11px] space-y-1">
                  <p className="font-bold text-slate-800 dark:text-slate-200">Active System Guarantees:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-400">
                    <li>Strict Fact Preservation: Employment dates, companies preserved.</li>
                    <li>ATS Keyword Integration: Matched to job requirements.</li>
                    <li>Action-Oriented Rewrites: Metric-driven bullet statements.</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Main Action Button with Keyboard Shortcut Badge */}
            <button
              onClick={handleModifyResume}
              disabled={isModifying || !baseResume.trim()}
              className="skeuo-button-primary w-full py-3.5 px-4 mt-1 text-sm flex items-center justify-center gap-2 font-bold tracking-wide group"
            >
              {isModifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{currentPhase || 'Modifying Resume with AI...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Modify & Optimize Resume</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-black/20 text-white rounded border border-white/20 ml-1.5 opacity-80 group-hover:opacity-100">
                    ⌘/Ctrl + ↵
                  </kbd>
                </>
              )}
            </button>
          </div>
        </div>

        {/* COLUMN 3: Studio Output & Paper Preview Plate (col-span-5) */}
        <div className="xl:col-span-5 flex flex-col gap-4 overflow-y-auto">
          <div className="skeuo-panel p-5 flex flex-col gap-4">

            {/* Toolbar Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8cfc0] dark:border-[#282e3c] pb-3">

              {/* Mode Switcher */}
              <div className="flex items-center gap-1 bg-[#e0d9cc] dark:bg-[#0f1218] p-1 rounded-xl border border-[#c9c2b4] dark:border-[#212634] shadow-inner">
                <button
                  onClick={() => setViewMode('preview')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition",
                    viewMode === 'preview' ? "bg-amber-700 dark:bg-indigo-600 text-white shadow-md" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Paper Preview
                </button>

                <button
                  onClick={() => setViewMode('edit')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition",
                    viewMode === 'edit' ? "bg-amber-700 dark:bg-indigo-600 text-white shadow-md" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  <Code className="w-3.5 h-3.5" />
                  Raw Text
                </button>

                <button
                  onClick={() => setViewMode('diff')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition",
                    viewMode === 'diff' ? "bg-amber-700 dark:bg-indigo-600 text-white shadow-md" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  Diff View
                </button>
              </div>

              {/* Version History Shelf & Template Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-700 dark:text-indigo-400" />
                  <select
                    value={activeVersionId}
                    onChange={e => {
                      const selectedId = e.target.value;
                      setActiveVersionId(selectedId);
                      const found = savedVersions.find(v => v.id === selectedId);
                      if (found) {
                        setModifiedResume(found.text);
                        toast.info(`Switched to ${found.name}`);
                      }
                    }}
                    className="skeuo-well text-xs font-semibold px-2.5 py-1.5 focus:outline-none max-w-[150px] truncate"
                  >
                    <option value="current">Current Output</option>
                    {savedVersions.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.timestamp})
                      </option>
                    ))}
                  </select>
                </div>

                {viewMode === 'preview' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Template:</span>
                    <select
                      value={selectedTemplate}
                      onChange={e => setSelectedTemplate(e.target.value as any)}
                      className="skeuo-well text-xs font-semibold px-2.5 py-1.5 focus:outline-none"
                    >
                      <option value="modern">Modern Clean</option>
                      <option value="classic">Classic ATS</option>
                      <option value="minimal">Minimalist</option>
                      <option value="executive">Executive</option>
                      <option value="tech">Tech Mono</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="skeuo-button-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                  title="Copy to Clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>

                <button
                  onClick={handleDownloadPDF}
                  className="skeuo-button-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
                  title="Download PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </button>

                <button
                  onClick={handleDownloadTXT}
                  className="skeuo-button-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                  title="Download Markdown"
                >
                  <FileText className="w-3.5 h-3.5" />
                  MD
                </button>
              </div>
            </div>

            {/* ATS Score Plate */}
            {atsScore && (
              <div className="p-3.5 bg-[#e4ded2] dark:bg-[#121620] border border-[#d0c7b8] dark:border-[#242c3d] rounded-xl flex items-center justify-between shadow-inner">
                <div className="flex items-center gap-3">
                  <Award className="w-6 h-6 text-amber-700 dark:text-indigo-400" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">ATS Quality Score</h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Score increased from <span className="font-bold text-amber-700 dark:text-amber-400">{atsScore.before}%</span> to <span className="font-bold text-emerald-700 dark:text-emerald-400">{atsScore.after}%</span>
                    </p>
                  </div>
                </div>

                <div className="px-3.5 py-1 bg-emerald-600 text-white rounded-full font-extrabold text-xs shadow">
                  {atsScore.after}% Match
                </div>
              </div>
            )}

            {/* Output Canvas Area */}
            <div className="min-h-[520px] max-h-[780px] overflow-y-auto skeuo-well p-4">
              {viewMode === 'preview' && (
                <div className="skeuo-paper-sheet p-6 min-h-[500px]">
                  <ResumePreview
                    content={modifiedResume || baseResume}
                    template={selectedTemplate}
                  />
                </div>
              )}

              {viewMode === 'edit' && (
                <textarea
                  value={modifiedResume || baseResume}
                  onChange={e => setModifiedResume(e.target.value)}
                  rows={26}
                  className="w-full h-full p-3 font-mono text-xs bg-transparent focus:outline-none resize-none"
                  placeholder="Modified resume text will appear here..."
                />
              )}

              {viewMode === 'diff' && (
                <div className="p-2">
                  <DiffViewer
                    oldText={baseResume}
                    newText={modifiedResume || baseResume}
                  />
                </div>
              )}
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}
