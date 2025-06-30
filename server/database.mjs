import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Database {
  constructor() {
    this.db = new sqlite3.Database(join(__dirname, 'assignments.db'));
    this.init();
  }

  init() {
    // Create tables
    this.db.serialize(() => {
      // Users table (teachers and students)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT CHECK(role IN ('teacher', 'student')) NOT NULL
        )
      `);

      // Assignments table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          question TEXT NOT NULL,
          answer TEXT,
          score INTEGER,
          status TEXT CHECK(status IN ('open', 'closed')) DEFAULT 'open',
          teacher_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (teacher_id) REFERENCES users(id)
        )
      `);

      // Assignment groups table (many-to-many between assignments and students)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS assignment_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          assignment_id INTEGER NOT NULL,
          student_id INTEGER NOT NULL,
          FOREIGN KEY (assignment_id) REFERENCES assignments(id),
          FOREIGN KEY (student_id) REFERENCES users(id),
          UNIQUE(assignment_id, student_id)
        )
      `);

      // Initialize with test data
      this.initializeTestData();
    });
  }

  async initializeTestData() {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);
  
    // Check if data already exists
    this.db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
      if (err || row.count > 0) return;
  
      // Insert teachers
      const teacherStmt = this.db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)');
      teacherStmt.run('teacher1', hashedPassword, 'Prof. Smith', 'teacher');
      teacherStmt.run('teacher2', hashedPassword, 'Prof. Johnson', 'teacher');
      teacherStmt.finalize();
  
      // Insert 20 students
      const studentStmt = this.db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)');
      const studentNames = [
        'Alice Brown', 'Bob Wilson', 'Carol Davis', 'David Miller', 'Emma Garcia',
        'Frank Rodriguez', 'Grace Martinez', 'Henry Anderson', 'Ivy Taylor', 'Jack Thomas',
        'Kate Jackson', 'Liam White', 'Mia Harris', 'Noah Martin', 'Olivia Thompson',
        'Peter Garcia', 'Quinn Lee', 'Ruby Walker', 'Sam Hall', 'Tessa Allen'
      ];
  
      studentNames.forEach((name, index) => {
        const lastName = name.split(' ')[1]; // Extract last name (Brown, Wilson, Davis, etc.)
        studentStmt.run(lastName, hashedPassword, name, 'student');
      });
      studentStmt.finalize();
  
      // Create some initial assignments after a delay to ensure users are created
      setTimeout(() => {
        this.createInitialAssignments();
      }, 100);
    });
  }

  createInitialAssignments() {
    // Create assignments for teacher1 (id: 1)
    this.db.run(`
      INSERT INTO assignments (question, answer, score, status, teacher_id) 
      VALUES ('What are the main principles of object-oriented programming?', 
              'Encapsulation, Inheritance, Polymorphism, and Abstraction are the four main principles of OOP.',
              25, 'closed', 1)
    `, function(err) {
      if (!err) {
        const assignmentId = this.lastID;
        // Add students 1, 2, 3 to this assignment
        const db = this.db;
        const groupStmt = db.prepare('INSERT INTO assignment_groups (assignment_id, student_id) VALUES (?, ?)');
        [3, 4, 5].forEach(studentId => { // students have ids starting from 3
          groupStmt.run(assignmentId, studentId);
        });
        groupStmt.finalize();
      }
    });

    this.db.run(`
      INSERT INTO assignments (question, status, teacher_id) 
      VALUES ('Explain the concept of inheritance in programming with examples.', 'open', 1)
    `, function(err) {
      if (!err) {
        const assignmentId = this.lastID;
        // Add students 4, 5, 6, 7 to this assignment
        const db = this.db;
        const groupStmt = db.prepare('INSERT INTO assignment_groups (assignment_id, student_id) VALUES (?, ?)');
        [6, 7, 8, 9].forEach(studentId => {
          groupStmt.run(assignmentId, studentId);
        });
        groupStmt.finalize();
      }
    });
  }

  // User methods
  getUserByUsername(username) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getUserById(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT id, username, name, role FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getAllStudents() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT id, username, name FROM users WHERE role = "student" ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Assignment methods
  checkGroupConstraint(studentIds, teacherId) {
    return new Promise((resolve, reject) => {
      // Check if any pair of students has been together in 2+ assignments
      const query = `
        SELECT s1.student_id as student1, s2.student_id as student2, COUNT(*) as count
        FROM assignment_groups s1
        JOIN assignment_groups s2 ON s1.assignment_id = s2.assignment_id AND s1.student_id < s2.student_id
        JOIN assignments a ON s1.assignment_id = a.id
        WHERE s1.student_id IN (${studentIds.map(() => '?').join(',')})
          AND s2.student_id IN (${studentIds.map(() => '?').join(',')})
          AND a.teacher_id = ?
        GROUP BY s1.student_id, s2.student_id
        HAVING COUNT(*) >= 2
      `;
      
      this.db.all(query, [...studentIds, ...studentIds, teacherId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.length === 0); // Can create group if no pairs have 2+ assignments together
      });
    });
  }

  createAssignment(question, studentIds, teacherId) {
    return new Promise((resolve, reject) => {
      this.db.run('INSERT INTO assignments (question, teacher_id) VALUES (?, ?)', 
        [question, teacherId], 
        function(err) {
          if (err) {
            reject(err);
          } else {
            const assignmentId = this.lastID;
            const db = this.db;
            
            // Add students to assignment group
            const groupStmt = db.prepare('INSERT INTO assignment_groups (assignment_id, student_id) VALUES (?, ?)');
            studentIds.forEach(studentId => {
              groupStmt.run(assignmentId, studentId);
            });
            groupStmt.finalize();
            
            resolve(assignmentId);
          }
        }
      );
    });
  }

  getTeacherAssignments(teacherId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          a.*,
          GROUP_CONCAT(u.name) as student_names,
          GROUP_CONCAT(u.id) as student_ids
        FROM assignments a
        LEFT JOIN assignment_groups ag ON a.id = ag.assignment_id
        LEFT JOIN users u ON ag.student_id = u.id
        WHERE a.teacher_id = ?
        GROUP BY a.id
        ORDER BY a.created_at DESC
      `;
      
      this.db.all(query, [teacherId], (err, rows) => {
        if (err) reject(err);
        else {
          const assignments = rows.map(row => ({
            ...row,
            student_names: row.student_names ? row.student_names.split(',') : [],
            student_ids: row.student_ids ? row.student_ids.split(',').map(Number) : []
          }));
          resolve(assignments);
        }
      });
    });
  }

  getAssignmentById(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM assignments WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  evaluateAssignment(assignmentId, score) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE assignments SET score = ?, status = "closed" WHERE id = ?', 
        [score, assignmentId], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });
  }

  getClassStatus(teacherId, sortBy) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          u.id,
          u.name,
          COUNT(CASE WHEN a.status = 'open' THEN 1 END) as open_assignments,
          COUNT(CASE WHEN a.status = 'closed' THEN 1 END) as closed_assignments,
          COUNT(a.id) as total_assignments,
          CASE 
            WHEN COUNT(CASE WHEN a.status = 'closed' THEN 1 END) > 0 
            THEN ROUND(
              SUM(CASE WHEN a.status = 'closed' THEN 
                CAST(a.score AS FLOAT) / (
                  SELECT COUNT(*) FROM assignment_groups ag2 WHERE ag2.assignment_id = a.id
                )
              END) / COUNT(CASE WHEN a.status = 'closed' THEN 1 END), 2
            )
            ELSE NULL 
          END as average_score
        FROM users u
        LEFT JOIN assignment_groups ag ON u.id = ag.student_id
        LEFT JOIN assignments a ON ag.assignment_id = a.id AND a.teacher_id = ?
        WHERE u.role = 'student'
        GROUP BY u.id, u.name
      `;

      let orderBy = 'u.name';
      if (sortBy === 'assignments') orderBy = 'total_assignments DESC';
      else if (sortBy === 'average') orderBy = 'average_score DESC';

      this.db.all(query + ` ORDER BY ${orderBy}`, [teacherId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Student methods
  getStudentAssignments(studentId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          a.*,
          GROUP_CONCAT(u.name) as group_members,
          ut.name as teacher_name
        FROM assignments a
        JOIN assignment_groups ag ON a.id = ag.assignment_id
        LEFT JOIN assignment_groups ag2 ON a.id = ag2.assignment_id
        LEFT JOIN users u ON ag2.student_id = u.id
        LEFT JOIN users ut ON a.teacher_id = ut.id
        WHERE ag.student_id = ?
        GROUP BY a.id
        ORDER BY a.created_at DESC
      `;
      
      this.db.all(query, [studentId], (err, rows) => {
        if (err) reject(err);
        else {
          const assignments = rows.map(row => ({
            ...row,
            group_members: row.group_members ? row.group_members.split(',') : []
          }));
          resolve(assignments);
        }
      });
    });
  }

  submitAnswer(assignmentId, answer) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE assignments SET answer = ? WHERE id = ?', 
        [answer, assignmentId], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });
  }

  getStudentScores(studentId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          a.*,
          GROUP_CONCAT(u.name) as group_members,
          ut.name as teacher_name,
          CAST(a.score AS FLOAT) / (
            SELECT COUNT(*) FROM assignment_groups ag2 WHERE ag2.assignment_id = a.id
          ) as individual_score
        FROM assignments a
        JOIN assignment_groups ag ON a.id = ag.assignment_id
        LEFT JOIN assignment_groups ag2 ON a.id = ag2.assignment_id
        LEFT JOIN users u ON ag2.student_id = u.id
        LEFT JOIN users ut ON a.teacher_id = ut.id
        WHERE ag.student_id = ? AND a.status = 'closed'
        GROUP BY a.id
        ORDER BY a.created_at DESC
      `;
      
      this.db.all(query, [studentId], (err, rows) => {
        if (err) reject(err);
        else {
          const scores = rows.map(row => ({
            ...row,
            group_members: row.group_members ? row.group_members.split(',') : []
          }));
          resolve(scores);
        }
      });
    });
  }
}