const express = require('express');
const bcrypt = require('bcryptjs');
const firebaseAdmin = require('firebase-admin');
const path = require('path');
const axios = require('axios');

const serviceAccount = require('./firebase-service-account.json');

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  databaseURL: 'https://database-for-mini.firebaseio.com' // Replace with your database URL
});

const db = firebaseAdmin.firestore();
const app = express();

// Set up EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));

// OMDB API key (replace with your own API key)
const OMDB_API_KEY = 'b9c7f0f3';

// Render Signup Page
app.get('/signup', (req, res) => {
  res.render('signup');
});

// Handle Signup
app.post('/signup', async (req, res) => {
  const { name, email, password, confirm_password, date_of_birth, phone_number } = req.body;

  if (password !== confirm_password) {
    return res.status(400).send('Passwords do not match');
  }

  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', email).get();

  if (!snapshot.empty) {
    return res.status(400).send('Email already in use');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await usersRef.add({
    name,
    email,
    password: hashedPassword,
    date_of_birth,
    phone_number,
  });

  res.redirect('/login');
});

// Render Login Page
app.get('/login', (req, res) => {
  res.render('login');
});

// Handle Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', email).get();

  if (snapshot.empty) {
    return res.status(400).send('Invalid email or password');
  }

  const user = snapshot.docs[0].data();

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(400).send('Invalid email or password');
  }

  res.redirect('/dashboard');
});

// Render Dashboard Page
app.get('/dashboard', (req, res) => {
  res.render('dashboard', { movie: null });
});

// Handle Movie Search on Dashboard
app.post('/dashboard', async (req, res) => {
  const { title } = req.body;

  try {
    const response = await axios.get(`http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_API_KEY}`);
    const movie = response.data;

    if (movie.Response === 'False') {
      return res.status(404).send('Movie not found');
    }

    res.render('dashboard', { movie });
  } catch (error) {
    console.error('Error fetching movie details:', error.response ? error.response.data : error.message);
    res.status(500).send(`An error occurred while fetching movie details: ${error.message}`);
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
