const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function isJwtExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (payload.exp && typeof payload.exp === 'number') {
      return payload.exp * 1000 <= Date.now();
    }
    return false;
  } catch {
    return true;
  }
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('medassist_token');
    if (token && isJwtExpired(token)) {
      localStorage.removeItem('medassist_token');
      localStorage.removeItem('medassist_user');
      window.dispatchEvent(new CustomEvent('medassist:auth_expired'));
      return null;
    }
    return token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: 'Request failed' }));
      const detail = errorData.detail;
      let msg = 'Request failed';
      if (Array.isArray(detail)) {
        msg = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      } else if (typeof detail === 'string') {
        msg = detail;
      } else if (detail && typeof detail === 'object') {
        msg = JSON.stringify(detail);
      } else if (errorData.message) {
        msg = errorData.message;
      } else {
        msg = `HTTP ${res.status}`;
      }

      // Proactively handle 401 Unauthorized (expired or invalid token)
      if (res.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('medassist_token');
        localStorage.removeItem('medassist_user');
        window.dispatchEvent(new CustomEvent('medassist:auth_expired'));
        if (window.location.pathname !== '/') {
          window.location.replace('/');
        }
      }

      const err: any = new Error(msg);
      err.detail = detail;
      err.status = res.status;
      err.response = errorData;
      throw err;
    }

    // Handle empty responses (204, etc.)
    const text = await res.text();
    if (!text) return null as T;
    return JSON.parse(text);
  }

  async get<T = any>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T = any>(path: string, data?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(path: string, data?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  async upload<T = any>(path: string, formData: FormData): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: formData,
    });
  }

  async downloadBlob(path: string): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('medassist_token');
        localStorage.removeItem('medassist_user');
        window.dispatchEvent(new CustomEvent('medassist:auth_expired'));
        if (window.location.pathname !== '/') {
          window.location.replace('/');
        }
      }
      const errorData = await res.json().catch(() => ({ detail: `Download failed (${res.status})` }));
      throw new Error(errorData.detail || `Download failed (${res.status})`);
    }
    return await res.blob();
  }
}

export const api = new ApiClient();
export { API_BASE };
