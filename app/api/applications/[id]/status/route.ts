import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { applications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const appId = parseInt(id);
    if (isNaN(appId)) {
        return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const result = await db
        .select({
            tailorStatus: applications.tailorStatus,
            tailoredResume: applications.tailoredResume,
            analysis: applications.analysis,
        })
        .from(applications)
        .where(and(eq(applications.id, appId), eq(applications.userId, userId)))
        .limit(1);

    if (result.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const app = result[0];
    let analysisData = null;
    if (app.analysis) {
        try {
            analysisData = JSON.parse(app.analysis);
        } catch { }
    }

    return NextResponse.json({
        tailorStatus: app.tailorStatus || 'idle',
        tailoredResume: app.tailoredResume || null,
        analysis: analysisData,
    });
}
