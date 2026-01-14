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

        // Create the completion with streaming enabled
        const stream = await client.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: finalMessages,
            temperature: 0.1,
            max_tokens: 8000,
            stream: true,
        });

        // Check if the user's message contains video-related keywords
        const lastUserMessage = finalMessages[finalMessages.length - 1];
        const videoKeywords = ['video', 'tutorial', 'watch', 'show me', 'youtube', 'learn'];
        const isVideoRequest = videoKeywords.some(keyword =>
            lastUserMessage.content.toLowerCase().includes(keyword)
        );

        // Create a ReadableStream to stream the response back to the client
        const readableStream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                let fullText = "";

                try {
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content || "";
                        if (content) {
                            fullText += content;
                            // Pre-process content to keep consistency with previous requirements if needed
                            // However, bold-to-uppercase is destructive for Markdown, so we'll skip it in streaming for now
                            // or apply it to the final text if it was a hard requirement.
                            // The user requested preserved line breaks and clean reading experience, so Markdown is better.
                            controller.enqueue(encoder.encode(content));
                        }
                    }

                    // If it's a video request, try to find a video and append it at the end
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
                                    const videoText = `\n\nHere's a relevant video: ${youtubeData.url}`;
                                    controller.enqueue(encoder.encode(videoText));
                                }
                            }
                        } catch (error) {
                            console.error('[API] Error calling YouTube API:', error);
                        }
                    }

                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            },
        });

        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            },
        });

    } catch (error: any) {
        console.error('[API] Error generating AI response:', error);
        console.error('[API] Error stack:', error.stack);
        return NextResponse.json(
            { error: 'Failed to generate response', details: error.message },
            { status: 500 }
        );
    }
}
