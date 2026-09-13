const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('turnal_token');
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('turnal_token', token);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('turnal_token');
  localStorage.removeItem('turnal_user');
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const text = await res.text();
    try {
      const body = JSON.parse(text);
      return body;
    } catch {
      if (!res.ok) {
        return {
          success: false,
          error: { code: 'SERVER_ERROR', message: `Server error (${res.status}): ${res.statusText}` },
        };
      }
      return {
        success: false,
        error: { code: 'INVALID_RESPONSE', message: 'Unexpected response from server' },
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: err.message || 'Network request failed' },
    };
  }
}
