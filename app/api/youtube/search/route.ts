import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { query } = await req.json();

        if (!query || !query.trim()) {
            return NextResponse.json(
                { error: 'Search query is required' },
                { status: 400 }
            );
        }

        const apiKey = process.env.YOUTUBE_API_KEY;

        if (!apiKey) {
            console.error('YOUTUBE_API_KEY is missing');
            return NextResponse.json(
                { error: 'YouTube API key not configured' },
                { status: 500 }
            );
        }

        console.log(`[YouTube API] Searching for: ${query}`);

        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${apiKey}`
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[YouTube API] Error:', errorData);
            return NextResponse.json(
                { error: 'YouTube API request failed', details: errorData },
                { status: response.status }
            );
        }

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            console.log('[YouTube API] No results found');
            return NextResponse.json({
                videoId: null,
                url: null,
                title: null,
                message: 'No videos found for this query'
            });
        }

        const videoId = data.items[0].id.videoId;
        const title = data.items[0].snippet.title;
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        console.log(`[YouTube API] Found video: ${title} (${videoId})`);

        return NextResponse.json({
            videoId,
            url,
            title
        });

    } catch (error: any) {
        console.error('[YouTube API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to search YouTube', details: error.message },
            { status: 500 }
        );
    }
}
