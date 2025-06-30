// server/index.mjs
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { Database } from './database.mjs';

const app = express();
const db = new Database();

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true if using https
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
};

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.getUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Don't send password to client
    const { password: _, ...userWithoutPassword } = user;
    req.session.user = userWithoutPassword;
    
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Session check endpoint
app.get('/api/session', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ message: 'No active session' });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out successfully' });
});

// Get all students (teachers only)
app.get('/api/students', isAuthenticated, async (req, res) => {
  if (req.session.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const students = await db.getAllStudents();
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create assignment (teachers only)
app.post('/api/assignments', isAuthenticated, async (req, res) => {
  if (req.session.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const { question, studentIds } = req.body;
    const teacherId = req.session.user.id;
    
    // Check group constraints
    const isValidGroup = await db.checkGroupConstraint(studentIds, teacherId);
    if (!isValidGroup) {
      return res.status(400).json({ message: 'Group constraint violation' });
    }
    
    const assignmentId = await db.createAssignment(question, studentIds, teacherId);
    res.json({ id: assignmentId });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get teacher's assignments
app.get('/api/assignments', isAuthenticated, async (req, res) => {
  if (req.session.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const teacherId = req.session.user.id;
    const assignments = await db.getTeacherAssignments(teacherId);
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching teacher assignments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Evaluate assignment (teachers only)
app.put('/api/assignments/:id/evaluate', isAuthenticated, async (req, res) => {
  if (req.session.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const { id } = req.params;
    const { score } = req.body;
    
    // Validate score
    if (score < 0 || score > 30) {
      return res.status(400).json({ message: 'Score must be between 0 and 30' });
    }
    
    await db.evaluateAssignment(id, score);
    res.json({ message: 'Assignment evaluated successfully' });
  } catch (error) {
    console.error('Error evaluating assignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get class status (teachers only)
app.get('/api/class-status', isAuthenticated, async (req, res) => {
  if (req.session.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const teacherId = req.session.user.id;
    const { sortBy = 'name' } = req.query;
    const classStatus = await db.getClassStatus(teacherId, sortBy);
    res.json(classStatus);
  } catch (error) {
    console.error('Error fetching class status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student assignments
app.get('/api/my-assignments', isAuthenticated, async (req, res) => {
  if (req.session.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const studentId = req.session.user.id;
    const assignments = await db.getStudentAssignments(studentId);
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching student assignments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit assignment answer (students only)
app.put('/api/assignments/:id/answer', isAuthenticated, async (req, res) => {
  if (req.session.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const { id } = req.params;
    const { answer } = req.body;
    
    await db.submitAnswer(id, answer);
    res.json({ message: 'Answer submitted successfully' });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student scores
app.get('/api/my-scores', isAuthenticated, async (req, res) => {
  if (req.session.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const studentId = req.session.user.id;
    const scores = await db.getStudentScores(studentId);
    res.json(scores);
  } catch (error) {
    console.error('Error fetching student scores:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});