import { NextRequest, NextResponse } from 'next/server';

const API_BACKEND = process.env.INTERNAL_API_URL || 'http://127.0.0.1:4000';

async function proxyRequest(req: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const subPath = params.path.join('/');
    const url = new URL(req.url);
    const targetUrl = `${API_BACKEND}/api/${subPath}${url.search}`;

    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => {
      // Don't forward host header to avoid collision
      if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'content-length') {
        headers[key] = val;
      }
    });

    const init: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const bodyText = await req.text();
        init.body = bodyText;
      } else {
        const arrayBuf = await req.arrayBuffer();
        init.body = arrayBuf;
      }
    }

    const backendRes = await fetch(targetUrl, init);

    const resHeaders = new Headers();
    backendRes.headers.forEach((val, key) => {
      resHeaders.set(key, val);
    });

    const resBuffer = await backendRes.arrayBuffer();

    return new NextResponse(resBuffer, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    });
  } catch (err: any) {
    console.error('[API Proxy Error]:', err);
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: err.message || 'Failed to connect to API backend' } },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
