import { createContext, useState, useEffect } from 'react';

// Step 1: Create the AuthContext — like a global pipe to share login data
const AuthContext = createContext();

// Step 2: Create the Provider component
function AuthProvider(props) {
  // Step 3: Create state to hold the logged-in user
  // undefined = still loading; null = not logged in; object = logged in
  const [user, setUser] = useState(undefined);

  // Step 4: Check for active session on initial load (only once)
  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch('http://localhost:3001/api/session', {
          credentials: 'include', // include cookies with request
        });

        if (!response.ok) {
          // No active session found
          setUser(null);
          return;
        }

        const userData = await response.json();
        setUser(userData); // Store user info globally
      } catch (error) {
        console.error('Session check failed:', error);
        setUser(null); // Treat as not logged in
      }
    }

    checkSession();
  }, []); // Runs only once on mount

  // Step 5: Share user + setUser with all children
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {props.children}
    </AuthContext.Provider>
  );
}

// Step 6: Export both the Context and the Provider
export { AuthContext, AuthProvider };
