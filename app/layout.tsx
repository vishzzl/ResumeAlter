import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarNav } from "@/components/sidebar-nav";
import { MainNav } from "@/components/main-nav";
import { AIConfigProvider } from "@/app/context/AIConfigContext";
import { ParseProvider } from "@/app/context/ParseContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { auth } from "@/auth";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: {
    default: "ResumeAlter - AI-Powered Resume Tailoring",
    template: "%s | ResumeAlter",
  },
  description: "Transform your resume for each job application with AI. ResumeAlter helps you tailor your resume to match job descriptions, improving your ATS score and landing more interviews.",
  keywords: ["resume", "AI", "job application", "ATS", "resume tailoring", "career", "job search"],
  authors: [{ name: "ResumeAlter" }],
  creator: "ResumeAlter",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://resumealter.vercel.app",
    siteName: "ResumeAlter",
    title: "ResumeAlter - AI-Powered Resume Tailoring",
    description: "Transform your resume for each job application with AI-powered tailoring",
  },
  twitter: {
    card: "summary_large_image",
    title: "ResumeAlter - AI-Powered Resume Tailoring",
    description: "Transform your resume for each job application with AI",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ErrorBoundary>
          <AIConfigProvider>
            <ParseProvider>
              <div className="min-h-screen w-full bg-slate-950 text-slate-100 relative">
                <main className="w-full min-h-screen">
                  {children}
                </main>
              </div>
              <Toaster richColors position="top-right" />
            </ParseProvider>
          </AIConfigProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
