import { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

export default function TeacherDashboard() {
  const { user } = useContext(AuthContext);
  const [assignments, setAssignments] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function fetchAssignments() {
      try {
        const res = await fetch('http://localhost:3001/api/assignments', {
          credentials: 'include',
        });

        if (!res.ok) throw new Error('Failed to fetch');

        const data = await res.json();
        setAssignments(data);
      } catch (err) {
        console.error(err);
        setErrorMsg('Could not load assignments.');
      }
    }

    fetchAssignments();
  }, []);

  const handleEvaluate = async (id, score) => {
    try {
      const res = await fetch(`http://localhost:3001/api/assignments/${id}/evaluate`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
      });

      if (!res.ok) throw new Error('Evaluation failed');

      setSuccessMsg('Score submitted!');
      setTimeout(() => setSuccessMsg(''), 3000);

      // Refresh assignments list
      const res2 = await fetch('http://localhost:3001/api/assignments', {
        credentials: 'include',
      });
      const data = await res2.json();
      setAssignments(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Error submitting score.');
    }
  };

  return (
    <div className="container mt-4">
      <h2>Welcome {user.name} 👋</h2>
      <p className="text-muted">Role: Teacher</p>

      <button className="btn btn-success mb-3">+ New Assignment</button>

      {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <table className="table table-bordered table-hover">
        <thead className="table-dark">
          <tr>
            <th>ID</th>
            <th>Question</th>
            <th>Status</th>
            <th>Group</th>
            <th>Answer</th>
            <th>Score</th>
            <th>Evaluate</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.question}</td>
              <td>{a.status}</td>
              <td>
                {a.student_names?.map((name, i) => (
                  <span key={i} className="badge bg-primary me-1">
                    {name}
                  </span>
                ))}
              </td>
              <td>{a.answer || '-'}</td>
              <td>{a.score ?? '-'}</td>
              <td>
                {a.status === 'open' && a.answer && (
                  <EvaluateForm assignmentId={a.id} onEvaluate={handleEvaluate} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvaluateForm({ assignmentId, onEvaluate }) {
  const [score, setScore] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const numericScore = parseInt(score);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > 30) {
      alert('Score must be between 0 and 30.');
      return;
    }

    onEvaluate(assignmentId, numericScore);
    setScore('');
  };

  return (
    <form className="d-flex" onSubmit={handleSubmit}>
      <input
        type="number"
        className="form-control me-2"
        placeholder="0–30"
        value={score}
        onChange={(e) => setScore(e.target.value)}
        style={{ width: '80px' }}
      />
      <button type="submit" className="btn btn-sm btn-outline-primary">Submit</button>
    </form>
  );
}
