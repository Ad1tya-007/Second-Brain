import { cancel, onUrl, start } from "@fabianlars/tauri-plugin-oauth";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
};

/** Shape returned by every Rust auth command. */
type AuthResult = {
  token: string;
  user_id: string;
  email: string;
  name?: string;
  avatar_url?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_KEY = "lsb:auth-token";

// ---------------------------------------------------------------------------
// JWT helpers (client-side only — no signature verification needed)
// ---------------------------------------------------------------------------

type JwtPayload = {
  sub: string;
  email: string;
  name?: string;
  avatar_url?: string;
  exp: number;
};

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function restoreUser(): AuthUser | null {
  try {
    const token = localStorage.getItem(SESSION_KEY);
    if (!token) return null;
    const payload = decodeJwt(token);
    if (!payload) return null;
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.avatar_url,
    };
  } catch {
    return null;
  }
}

function saveToken(token: string): AuthUser | null {
  localStorage.setItem(SESSION_KEY, token);
  return restoreUser();
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => restoreUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialise the MongoDB connection once on mount.
  useEffect(() => {
    const uri = import.meta.env.VITE_MONGO_CONNECTION_STRING as string | undefined;
    if (!uri) return;
    invoke<void>("setup_db", { connectionString: uri }).catch((e) => {
      console.error("setup_db failed:", e);
    });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // ---------------------------------------------------------------------------
  // Email / Password
  // ---------------------------------------------------------------------------

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<AuthResult>("auth_login", { email, password });
      const restored = saveToken(result.token);
      setUser(restored);
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const registerWithEmail = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<AuthResult>("auth_register", { email, password });
      const restored = saveToken(result.token);
      setUser(restored);
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Google OAuth — opens browser, captures code, exchanges via Rust
  // ---------------------------------------------------------------------------

  const loginWithGoogle = useCallback(async () => {
    setLoading(true);
    setError(null);

    let port: number | null = null;
    let unlisten: (() => void) | undefined;

    try {
      port = await start();

      let resolveCode!: (code: string) => void;
      let rejectCode!: (err: Error) => void;
      const codePromise = new Promise<string>((res, rej) => {
        resolveCode = res;
        rejectCode = rej;
      });

      unlisten = await onUrl((callbackUrl) => {
        try {
          const url = new URL(callbackUrl);
          const code = url.searchParams.get("code");
          if (code) {
            resolveCode(code);
          } else {
            rejectCode(new Error(url.searchParams.get("error") ?? "Google did not return a code."));
          }
        } catch {
          rejectCode(new Error("Could not parse OAuth callback URL."));
        }
      });

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
      const redirectUri = `http://127.0.0.1:${port}`;
      const scope = encodeURIComponent("openid email profile");
      const googleUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${scope}` +
        `&access_type=offline` +
        `&prompt=consent`;

      await openUrl(googleUrl);

      const code = await Promise.race([
        codePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Google sign-in timed out.")), 5 * 60 * 1000),
        ),
      ]);

      // Rust handles the token exchange and MongoDB upsert
      const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string;
      const result = await invoke<AuthResult>("auth_google_exchange", {
        code,
        redirectUri,
        clientId,
        clientSecret,
      });

      const restored = saveToken(result.token);
      setUser(restored);
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      if (unlisten) unlisten();
      if (port !== null) await cancel(port).catch(() => {});
      setLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setError(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AuthContext.Provider
      value={{ user, loading, error, loginWithEmail, registerWithEmail, loginWithGoogle, logout, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
