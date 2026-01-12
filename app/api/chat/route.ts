import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { messages, documentContent } = await req.json();

        const apiKey = process.env.AIGRID_API_KEY;
        const baseURL = process.env.AIGRID_BASE_URL;

        if (!apiKey) {
            console.error('AIGRID_API_KEY is missing');
            return NextResponse.json(
                { error: 'AI API Key not found' },
                { status: 500 }
            );
        }

        const client = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL,
        });

        // Prepare messages and map roles for OpenAI compatibility
        let finalMessages = messages.map((m: any) => ({
            role: m.role === 'model' ? 'assistant' : m.role,
            content: m.content
        }));

        // Handle document content by appending it to the last user message
        if (documentContent) {
            const lastMessageIndex = finalMessages.length - 1;
            if (lastMessageIndex >= 0 && finalMessages[lastMessageIndex].role === 'user') {
                finalMessages[lastMessageIndex].content = `Based on the following document content:\n\n${documentContent}\n\nUser question: ${finalMessages[lastMessageIndex].content}`;
            }
        }

        // Add system message if not present
        if (!finalMessages.some((m: any) => m.role === 'system')) {
            finalMessages.unshift({
                role: "system",
                content: `You are OmniChat, a helpful AI assistant. 
                
If the user provides document content (prefixed with 'Based on the following document content:'), your primary task is to analyze that content and provide detailed feedback or answer questions based on it.

When users ask for videos or video tutorials, you should:
1. Provide a brief explanation or answer to their question.
2. Include a real, working YouTube URL that is relevant to their request.
3. Use the full YouTube URL format: https://www.youtube.com/watch?v=VIDEO_ID
4. IMPORTANT: Only provide URLs to videos that actually exist on YouTube. Do not make up video IDs.
5. If you don't know a specific real YouTube video URL, explain that you cannot provide video links but can help with text-based information instead.`
            });
        }

        // Limit conversation history to prevent token overflow
        // Keep system message + last 20 messages (10 exchanges)
        if (finalMessages.length > 21) {
            const systemMsg = finalMessages[0];
            const recentMessages = finalMessages.slice(-20);
            finalMessages = [systemMsg, ...recentMessages];
        }

        console.log(`[API] Processing request using model: openai/gpt-oss-20b`);
        console.log(`[API] Base URL: ${baseURL}`);
        console.log(`[API] Message count: ${finalMessages.length}`);

        const completion = await client.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: finalMessages,
            temperature: 0.1,
            max_tokens: 8000,
            // stream: false
        });

        console.log('[API] Received response headers/status from AI Grid');

        let text = completion.choices[0].message.content || "";

        // Post-process the response: convert **bold** to UPPERCASE and remove asterisks
        text = text.replace(/\*\*([^*]+)\*\*/g, (match, content) => content.toUpperCase());
        // Remove any remaining single asterisks
        text = text.replace(/\*/g, '');

        console.log(`[API] Response length: ${text.length}`);

        // Check if the user's message contains video-related keywords
        const lastUserMessage = finalMessages[finalMessages.length - 1];
        const videoKeywords = ['video', 'tutorial', 'watch', 'show me', 'youtube', 'learn'];
        const isVideoRequest = videoKeywords.some(keyword =>
            lastUserMessage.content.toLowerCase().includes(keyword)
        );

        // If it's a video request, search YouTube and append URL
        if (isVideoRequest) {
            try {
                console.log('[API] Detected video request, searching YouTube...');

                const host = req.headers.get('host');
                const protocol = host?.includes('localhost') ? 'http' : 'https';
                const youtubeResponse = await fetch(`${protocol}://${host}/api/youtube/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: lastUserMessage.content })
                });

                if (youtubeResponse.ok) {
                    const youtubeData = await youtubeResponse.json();

                    if (youtubeData.url) {
                        console.log(`[API] Found YouTube video: ${youtubeData.title}`);
                        text += `\n\nHere's a relevant video: ${youtubeData.url}`;
                    }
                } else {
                    console.error('[API] YouTube search failed');
                }
            } catch (error) {
                console.error('[API] Error calling YouTube API:', error);
                // Continue without video if search fails
            }
        }

        return NextResponse.json({ response: text });
    } catch (error: any) {
        console.error('[API] Error generating AI response:', error);
        console.error('[API] Error stack:', error.stack);
        return NextResponse.json(
            { error: 'Failed to generate response', details: error.message },
            { status: 500 }
        );
    }
}
