import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import pdf from 'pdf-parse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    console.log('Received resume parse request');
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            console.error('No file in request');
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        console.log('File received:', file.name, file.type, file.size);

        const buffer = Buffer.from(await file.arrayBuffer());

        let text = '';

        if (file.type === 'application/pdf') {
            try {
                const data = await pdf(buffer);
                text = data.text;
            } catch (e) {
                console.error('PDF Parse Error:', e);
                throw new Error('Failed to parse PDF content');
            }
        } else {
            // Basic text support
            text = buffer.toString('utf-8');
        }

        return NextResponse.json({ text });
    } catch (error) {
        console.error('Error parsing resume:', error);
        return NextResponse.json({ error: 'Failed to parse resume' }, { status: 500 });
    }
}
