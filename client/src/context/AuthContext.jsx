import { createContext, useContext, useEffect, useMemo, useState } from "react";

// Use relative /api in development so Vite proxy keeps cookies same-origin.
// In production, honor VITE_API_DOMAIN if provided.
const API_BASE =
  (import.meta.env.MODE === "production" && import.meta.env.VITE_API_DOMAIN)
    ? import.meta.env.VITE_API_DOMAIN
    : "";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("auth:user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const persistUser = (u) => {
    if (u) {
      localStorage.setItem("auth:user", JSON.stringify(u));
    } else {
      localStorage.removeItem("auth:user");
    }
  };

  const verify = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/auth/verify`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        setUser(null);
        persistUser(null);
        return { success: false };
      }
      const data = await res.json().catch(() => ({}));
      if (data?.user) {
        setUser(data.user);
        persistUser(data.user);
      }
      return { success: data?.success === true, user: data?.user || null };
    } catch (err) {
      setUser(null);
      persistUser(null);
      return { success: false, error: err?.message || "Verify failed" };
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || "Login failed");
      }
      const data = await res.json();
      setUser(data.user);
      persistUser(data.user);
      await verify();
      return data.user;
    } catch (err) {
      setError(err.message || "Login error");
      setUser(null);
      persistUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || "Signup failed");
      }
      const data = await res.json();
      setUser(data.user);
      persistUser(data.user);
      await verify();
      return data.user;
    } catch (err) {
      setError(err.message || "Signup error");
      setUser(null);
      persistUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
    } catch {
      // ignore network errors; still clear locally
    } finally {
      setUser(null);
      persistUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await verify();
        if (!mounted) return;
        if (!result.success && !user) {
          // remain signed out
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      signup,
      logout,
      verify,
      setError,
    }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);