
import { NextRequest, NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let text = '';

        if (file.type === 'application/pdf') {
            const data = await pdfParse(buffer);
            text = data.text;
        } else if (file.type === 'text/plain') {
            text = buffer.toString('utf-8');
        } else {
            // Try to treat as text anyway or fail
            return NextResponse.json({ error: 'Unsupported file type. Please upload PDF or TXT.' }, { status: 400 });
        }

        return NextResponse.json({ text });

    } catch (error) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
    }
}
