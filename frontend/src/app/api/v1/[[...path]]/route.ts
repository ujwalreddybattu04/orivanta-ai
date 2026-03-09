import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    const path = params.path.join('/');
    let backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    // Remove trailing slash if present
    backendUrl = backendUrl.replace(/\/$/, "");
    const targetUrl = `${backendUrl}/api/v1/${path}`;

    console.log(`[proxy] Proxying POST to: ${targetUrl}`);

    try {
        const body = await request.json();

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[proxy] Backend returned error ${response.status}: ${errorText}`);
            return new Response(errorText, { status: response.status });
        }

        // For streaming responses, we need to pass the stream through
        if (response.headers.get('content-type')?.includes('text/event-stream')) {
            return new Response(response.body, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error(`[proxy] Proxy failed: ${error.message}`);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle other methods if needed
export async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    const path = params.path.join('/');
    let backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    // Remove trailing slash if present
    backendUrl = backendUrl.replace(/\/$/, "");
    const targetUrl = `${backendUrl}/api/v1/${path}`;

    console.log(`[proxy] Proxying GET to: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl);
        const data = await response.json();
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
