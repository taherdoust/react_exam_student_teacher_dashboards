import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

export default function LoginPage() {
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setErrorMsg('Invalid credentials. Please try again.');
        return;
      }

      const user = await res.json();
      setUser(user);
      navigate(`/${user.role}/dashboard`);
    } catch (err) {
      console.error('Login failed:', err);
      setErrorMsg('Server error.');
    }
  };

  return (
    <div className="container mt-5">
      <h1 className="mb-4">Class Assignment System</h1>
      <p><strong>Ali Taherdoust</strong> | Student ID: <strong>s310548</strong></p>

      <form onSubmit={handleLogin} className="mt-3">
        <div className="mb-3">
          <label className="form-label">Username</label>
          <input
            className="form-control"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
        <button className="btn btn-primary" type="submit">Login</button>
      </form>

      <hr />
      <p><strong>Sample credentials:</strong></p>
      <ul>
        <li><strong>Teacher</strong>: <code>teacher1</code> / <code>password123</code></li>
        <li><strong>Student</strong>: <code>Brown</code> / <code>password123</code></li>
      </ul>
    </div>
  );
}
