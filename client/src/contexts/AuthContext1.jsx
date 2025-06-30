import { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    fetch('http://localhost:3001/api/session', {
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('No session');
        return res.json();
      })
      .then(data => setUser(data))
      .catch(() => setUser(null)); // not logged in
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
