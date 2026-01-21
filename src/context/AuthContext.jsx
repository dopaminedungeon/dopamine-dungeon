// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authStatus, setAuthStatus] = useState("loading");
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 🔥 MOCKED AUTH — THIS IS STEP 1 🔥
    // Pretend the user is logged in
    const fakeUser = {
      uid: "dev-user",
      email: "magda@dm.test",
      displayName: "Magda (Dev)",
      
    };
    console.log("[AuthProvider] setting fake user + authed");

    setUser(fakeUser);
    setAuthStatus("authed");
  }, []);

  return (
    <AuthContext.Provider value={{ user, authStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}