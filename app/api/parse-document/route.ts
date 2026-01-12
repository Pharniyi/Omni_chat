import { NextResponse } from 'next/server';
// @ts-ignore
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        console.log(`[Document Parser] Processing file: ${file.name} (${file.type})`);

        let text = '';

        // Handle PDF files
        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            try {
                const data = await pdf(buffer);
                text = data.text;
                console.log(`[Document Parser] Extracted ${text.length} characters from PDF`);
            } catch (err: any) {
                console.error('[Document Parser] PDF sub-error:', err);
                // Fallback or rethrow
                throw new Error(`PDF parsing failed: ${err.message}`);
            }
        }
        // Handle Word (DOCX) files
        else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
            console.log(`[Document Parser] Extracted ${text.length} characters from DOCX`);
        }
        // Handle text files
        else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
            text = await file.text();
            console.log(`[Document Parser] Read ${text.length} characters from text file`);
        }
        // Handle other file types
        else {
            return NextResponse.json(
                { error: 'Unsupported file type. Please upload PDF, DOCX, or TXT files.' },
                { status: 400 }
            );
        }

        if (!text || text.trim().length === 0) {
            return NextResponse.json(
                { error: 'No text content found in document' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            text: text.trim(),
            fileName: file.name,
            fileType: file.type,
            length: text.length
        });

    } catch (error: any) {
        console.error('[Document Parser] Error:', error);
        return NextResponse.json(
            { error: 'Failed to parse document', details: error.message },
            { status: 500 }
        );
    }
}
