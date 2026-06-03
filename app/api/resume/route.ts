import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import React from 'react';
import { ResumePDFPage } from '@/lib/resume-pdf-template';
import { buildResumeDOCXBuffer } from '@/lib/docx-export';
import { Document, pdf } from '@react-pdf/renderer';

// Helper to generate the cryptographically secure HMAC token for a userId
export function generateUserToken(userId: number): string {
    const secret = process.env.AUTH_SECRET || 'fallback-secret-resume-alter';
    return crypto
        .createHmac('sha256', secret)
        .update(userId.toString())
        .digest('hex')
        .slice(0, 16); // 16-character secure token
}

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

// GET handler to retrieve the PDF resume
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userIdStr = searchParams.get('userId');
    const token = searchParams.get('token');
    const format = (searchParams.get('format') || 'pdf').toLowerCase(); // pdf, docx, markdown, text

    if (!userIdStr || !token) {
        return NextResponse.json(
            { error: 'Unauthorized: userId and token query parameters are required.' },
            { 
                status: 401,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                }
            }
        );
    }

    const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
        return NextResponse.json(
            { error: 'Invalid userId.' },
            { 
                status: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                }
            }
        );
    }

    // Verify token
    const expectedToken = generateUserToken(userId);
    if (token !== expectedToken) {
        return NextResponse.json(
            { error: 'Unauthorized: Invalid token.' },
            { 
                status: 401,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                }
            }
        );
    }

    try {
        const result = await db
            .select({ masterResume: users.masterResume, email: users.email })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        const user = result[0];

        if (!user?.masterResume?.trim()) {
            return NextResponse.json(
                { error: 'Resume not found. Please add My Resume first.' },
                { 
                    status: 404,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    }
                }
            );
        }

        const resumeMarkdown = user.masterResume.trim() + '\n';

        if (format === 'markdown' || format === 'text') {
            return new Response(resumeMarkdown, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Content-Disposition': 'inline; filename="resume.md"',
                },
            });
        }

        const headingMatch = resumeMarkdown.match(/^#\s+(.+)$/m);
        const fallbackName = user.email?.split('@')[0] || 'Resume';
        const sanitizedName = (headingMatch?.[1] || fallbackName).replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Resume';
        const inline = searchParams.get('inline') === 'true';

        if (format === 'docx' || format === 'word') {
            const docxBuffer = await buildResumeDOCXBuffer(resumeMarkdown);
            const disposition = inline ? 'inline' : `attachment; filename="${sanitizedName}.docx"`;
            const uint8Array = new Uint8Array(docxBuffer);
            return new Response(uint8Array, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'Content-Disposition': disposition,
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Render PDF to Buffer
        const docElement = React.createElement(
            Document,
            null,
            React.createElement(ResumePDFPage, { resumeMarkdown })
        );
        const pdfBuffer = await pdf(docElement).toBuffer();

        const disposition = inline ? 'inline' : `attachment; filename="${sanitizedName}.pdf"`;

        return new Response(pdfBuffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': disposition,
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error: any) {
        console.error('Error generating resume PDF:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { 
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                }
            }
        );
    }
}
