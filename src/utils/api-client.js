// ============================================================
// api-client.js — Cloudflare Worker API Fetcher
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // For local development mock auth
  if (import.meta.env.DEV) {
    const mockUser = localStorage.getItem('mockUser');
    if (mockUser) {
      headers.set('X-Mock-User', mockUser);
    }
  }

  const authToken = localStorage.getItem('authToken');
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const fetchOptions = {
    ...options,
    headers,
    credentials: 'omit', // No longer need 'include' since we use Bearer token
    cache: 'no-store'
  };

  const response = await fetch(url, fetchOptions);
  
  if (!response.ok) {
    let errorMsg = 'Lỗi kết nối';
    try {
      const errData = await response.json();
      errorMsg = errData.error || errorMsg;
    } catch(e) {}
    throw new Error(errorMsg);
  }

  return response.json();
}
