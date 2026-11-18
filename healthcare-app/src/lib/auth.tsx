'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from './api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'patient' | 'doctor';
  assigned_doctor_id?: string;
  assigned_doctor_name?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, password: string, role: string, extra?: Record<string, unknown>) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function isTokenExpired(token: string | null): boolean {
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

function getInitialToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('medassist_token');
  if (token && isTokenExpired(token)) {
    localStorage.removeItem('medassist_token');
    localStorage.removeItem('medassist_user');
    return null;
  }
  return token;
}

function getInitialUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('medassist_token');
  if (token && isTokenExpired(token)) {
    localStorage.removeItem('medassist_token');
    localStorage.removeItem('medassist_user');
    return null;
  }
  const storedUser = localStorage.getItem('medassist_user');
  if (storedUser) {
    try {
      return JSON.parse(storedUser);
    } catch {
      localStorage.removeItem('medassist_user');
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);
  const [token, setToken] = useState<string | null>(getInitialToken);
  const [loading] = useState(false);

  useEffect(() => {
    const handleAuthExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('medassist:auth_expired', handleAuthExpired);
    return () => window.removeEventListener('medassist:auth_expired', handleAuthExpired);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await api.post('/api/auth/login', { email, password });
    const { access_token, user: userData } = res;
    localStorage.setItem('medassist_token', access_token);
    localStorage.setItem('medassist_user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, role: string, extra?: Record<string, unknown>): Promise<AuthUser> => {
    const payload = {
      name: name.trim(),
      full_name: name.trim(),
      email: email.trim(),
      password,
      role,
      ...(role === 'doctor' ? { specialty: 'General Medicine', specialization: 'General Medicine' } : {}),
      ...(extra || {}),
    };
    const res = await api.post('/api/auth/register', payload);
    const { access_token, user: userData } = res;
    localStorage.setItem('medassist_token', access_token);
    localStorage.setItem('medassist_user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('medassist_token');
    localStorage.removeItem('medassist_user');
    setToken(null);
    setUser(null);
    window.location.replace('/');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
