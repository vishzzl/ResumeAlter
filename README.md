# ResumeAlter 🚀

> **AI-Powered Resume Tailoring Platform** — Automatically optimize and tailor resumes to match job descriptions, maximize ATS scores, generate cover letters, and track applications on a Kanban board.

ResumeAlter is a production-grade full-stack web application that leverages Large Language Models (LLMs) to automatically customize resumes for specific job listings, balancing Applicant Tracking System (ATS) keyword optimization with factual accuracy (using hallucination prevention mechanisms).

---

## 🌟 Key Features

*   **5-Phase AI Tailoring Pipeline**: Runs an advanced pipeline via Server-Sent Events (SSE) streaming:
    *   *Phase 0 (Keyword Extraction)*: Analyzes job descriptions to extract required and preferred keywords.
    *   *Phase 1 (ATS Optimization)*: Rewrites resume sections using STAR-method bullets targeted at extracted keywords.
    *   *Phase 1.5 (Fact-Check / CoVe)*: Fact-checks tailored text against the original resume using a Chain of Verification step to eliminate hallucinations or invented metrics.
    *   *Phase 1.7 (Keyword Injection)*: Programmatically injects missing target keywords based on the candidate's actual experience.
    *   *Phase 2 (ATS Scoring)*: Uses a hybrid deterministic-LLM scorer (Keyword Match 40% + Experience Relevance 30% + Skills 20% + Formatting 10%).
*   **Application Tracking (Kanban)**: Track job application statuses (Draft, Applied, Interview, Rejected, Offer) using an interactive Kanban board with archiving capabilities.
*   **Custom Cover Letters**: Generate styled cover letters (Professional, Concise, Storytelling, Executive) matching your resume and the job description.
*   **PDF Export Engine**: Exports print-optimized A4 resumes with automatic dynamic font scaling to perfectly fit content onto a single page.
*   **Multi-Model Support**: Run out-of-the-box with Google Gemini (via official SDK), local models (via Ollama), or any OpenAI-compatible custom endpoint.

---

## 🛠️ Tech Stack

*   **Framework**: Next.js 16 (App Router) & React 19
*   **Language**: TypeScript
*   **Database**: SQLite (local development) & Turso libSQL (production)
*   **ORM**: Drizzle ORM
*   **Authentication**: NextAuth v5 (Credentials Provider, session-based JWT)
*   **Styling**: Tailwind CSS v4, Lucide icons, Sonner toasts
*   **Libraries**: `pdf-parse` (resume parsing), `html2canvas-pro` & `jspdf` (PDF generation)

---

## 🚀 Getting Started

### Prerequisites

*   **Node.js** (v20+ recommended)
*   **Gemini API Key** (Get one from [Google AI Studio](https://aistudio.google.com/)) OR a local **Ollama** server running `llama3.1`.

### 1. Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/vishzzl/ResumeAlter.git
cd ResumeAlter
npm install
```

### 2. Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Open `.env.local` and configure your credentials:

*   Add your `GEMINI_API_KEY` (if using Google's models).
*   Add a random `AUTH_SECRET` (generate using `openssl rand -base64 32`).
*   (Optional) If deploying to production, set your Turso credentials (`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`).

### 3. Database Migration

Initialize and migrate your local SQLite database:

```bash
# Generate SQL migrations
npm run db:generate

# Apply migrations to your database file (sqlite.db)
npm run db:migrate
```

### 4. Run Development Server

Start the Next.js dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application!

---

## 📂 Project Structure

```
├── actions/                  # Next.js Server Actions (e.g. auth, admin)
├── app/                     # Next.js App Router Pages & API Routes
│   ├── api/                 # API Endpoints (SSE tailoring, scrapers, cover letters)
│   ├── context/             # React Context Providers (AI Config, Parser)
│   └── layout.tsx           # Global Layout & Providers
├── components/              # Reusable React UI Components (Kanban, Editors, Diff Viewers)
├── drizzle/                 # Drizzle database migration logs & snapshots
├── lib/                     # Core Business Logic & Infrastructure
│   ├── db/                  # Database client setup & Schema definition
│   └── ...                  # AI pipelines, PDF exporters, JDs scrapers
├── public/                  # Static assets & SVG Icons
├── scripts/                 # Utility scripts (seeding database, patches, admin setup)
├── package.json             # App scripts and dependencies
└── tsconfig.json            # TypeScript Configuration
```

---

## 📖 Further Documentation

*   For deep technical breakdowns, including LLM prompt engineering flows, database ERDs, and PDF export strategies, see [TECHNICAL_DOCUMENTATION.md](file:///c:/Users/2vish/Repos/ResumeAlter/TECHNICAL_DOCUMENTATION.md).
*   For instructions on deploying the application to **Vercel** with a persistent **Turso Edge Database**, see [DEPLOYMENT.md](file:///c:/Users/2vish/Repos/ResumeAlter/DEPLOYMENT.md).
