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
  const session = await auth();

  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <AIConfigProvider>
            <ParseProvider>
              <div className="flex min-h-screen w-full bg-slate-50/80 dark:bg-[#020617] selection:bg-indigo-500/30 relative">
                {/* Immersive Backgrounds for Glassmorphism */}
                <div className="absolute inset-0 bg-gradient-mesh dark:hidden z-0 pointer-events-none opacity-60" />
                <div className="absolute inset-0 hidden dark:block bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))] z-0 pointer-events-none" />
                
                {/* Main Content Wrapper */}
                <div className="flex w-full z-10 relative">
                  <SidebarNav user={session?.user} />
                  <div className="flex flex-col flex-1 min-w-0 transition-all duration-300">
                    <MainNav user={session?.user} />
                    <main className="flex-1 p-4 md:p-6 lg:p-8 3xl:p-10 mx-auto w-full max-w-[2000px]">
                      {children}
                    </main>
                  </div>
                </div>
              </div>
              <Toaster richColors position="top-right" />
            </ParseProvider>
          </AIConfigProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
