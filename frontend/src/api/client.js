const apiOrigin = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');

export async function apiRequest(path, options = {}) {
  if (!apiOrigin) {
    throw new Error('API URL is not configured. Set VITE_API_URL and rebuild the frontend.');
  }
  if (!path.startsWith('/api/')) {
    throw new Error('API request paths must start with /api/.');
  }

  let response;
  try {
    response = await fetch(`${apiOrigin}${path}`, options);
  } catch {
    throw new Error(`Cannot reach ${apiOrigin}. Check your connection and backend status.`);
  }

  if (response.status === 204) return {};

  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`The API returned HTML instead of JSON (HTTP ${response.status}). The backend URL or route may be wrong.`);
  }

  let result;
  try {
    result = JSON.parse(rawText);
  } catch {
    throw new Error(`The API returned invalid JSON (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(result.error || `API request failed (HTTP ${response.status}).`);
  }
  return result;
}