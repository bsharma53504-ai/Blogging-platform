import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback((data) => {
    localStorage.setItem("inkwell-token", data.token);
    setUser(data.user);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("inkwell-token")) {
      setLoading(false);
      return;
    }
    api.get("/auth/me")
      .then(({ data }) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem("inkwell-token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    signIn: async (credentials) => setSession((await api.post("/auth/login", credentials)).data),
    signUp: async (details) => setSession((await api.post("/auth/register", details)).data),
    signOut: () => {
      localStorage.removeItem("inkwell-token");
      setUser(null);
    },
    updateUser: (updatedUser) => setUser(updatedUser),
    setSession,
  }), [user, loading, setSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
