// All the code involving the server side of the website

// Using express
const express = require('express');

// using express-session
const session = require('express-session');

const connectMongo = require('connect-mongo');


const { MongoClient } = require('mongodb');

const bcrypt = require('bcrypt');

const Joi = require('joi');

// importing dotenv to load environment variables from env file
const dotenv = require('dotenv');

// Loading environment variables from the .env file
dotenv.config();

const app = express();

// The port for this application
const port = 3000;

// setting up the database connection

const mongoUrl = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST}/${process.env.MONGODB_DATABASE}?retryWrites=true&w=majority&appName=Assignment2cluster`;

const client = new MongoClient(mongoUrl);

// connection to the database
async function connectDB(){
    try{
        await client.connect();
        console.log("Connected to the database");
      //  console.log("Connection String:",   mongoUrl); // Print the connection string for debugging
    } catch(error){
        console.log("Database connection failed.")
    }
}

connectDB();

const db = client.db(process.env.MONGODB_DATABASE);

// Collection for user accounts on the website
const usersCollection = db.collection('users');

// Collection for sessions on the website
const sessionCollection = db.collection('sessions');

// Coding the middleware of the website



app.use(express.urlencoded({ extended: true }));

// Serving static files from the 'public' directory
app.use(express.static('public'));


// Set EJS as the view engine
// Allows easy rendering of EJS templates without specifying the full path each time

app.set('view engine', 'ejs');

// Setting up the session configuration

app.use(session({
    // Secret for signing the session ID cookie
    secret: process.env.MONGODB_SESSION_SECRET, 
    
    // Don't force a session to be saved back to the session store
    resave: false, 

    // Don't create a session until something is stored
    saveUninitialized: false, 

    // Store sessions in MongoDB
    store: connectMongo.create({ client: client, dbName: process.env.MONGODB_DATABASE }),  
    cookie: {

        // Session expires after 1 hour (in milliseconds) 
      maxAge: 60 * 60 * 1000, 
    },
  }));

  // All of the routes of the website


  // The Home Page

  app.get('/', (req, res) => {
    if (req.session.user) {
      // If the user is logged in User is logged in the home page is shown
      res.render('index', {
        name: req.session.user.name,
        loggedIn: true,
      });
    } else {
      // If the user is not logged in the home page is shown with log in or sign up options 
      res.render('index', {
        loggedIn: false,
      });
    }
  });

  // The Sign Up Page

  app.get('/signup', (req, res) => {
    res.render('signup', { errorMessage: undefined });  // Render the signup form 
  });
  
  app.post('/signup', async (req, res) => {
    // Validate user input 
    const schema = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    });
  
    try {
      await schema.validateAsync(req.body);
    } catch (errorMessage) {
      return res.status(400).send(error.details[0].message +
         '<br><a href="/signup">Try again</a>'

      ); 
    }
  
    const { name, email, password } = req.body;
  
    try {
      // Hash the password 
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Insert the user into the database
      await usersCollection.insertOne({
        name,
        email,
        password: hashedPassword,
      });
  
      // Create a session 
      req.session.user = { name, email };
  
      res.redirect('/members'); // Redirect to members area 
    } catch (error) {
      console.error('Error during signup:', error);
      res.status(500).send('Error signing up. Please try again.');
    }
  });


  // The Login page

  app.get('/login', (req, res) => {
    res.render('login', { errorMessage: undefined }); // Render the login form 
  });
  
  app.post('/login', async (req, res) => {
    // Validate user input 
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    });
  
    try {
      await schema.validateAsync(req.body);
    } catch (error) {
      return res.status(400).send(error.details[0].message + '<br><a href="/login">Try again</a>');
    }
  
    const { email, password } = req.body;
  
    try {
      // Check if the user exists 
      const user = await usersCollection.findOne({ email });
  
      if (user && await bcrypt.compare(password, user.password)) {
        // If passwords match, create a session 
        // User is then redirected to the Members Page
        req.session.user = { name: user.name, email: user.email };
        return res.redirect('/members'); 
      } else {

        // Invalid credentials 
        return res.status(401).send('Invalid email/password combination.<br><a href="/login">Try again</a>');
      }
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).send('Error logging in. Please try again.');
    }
  });

  // The logout page

  app.get('/logout', (req, res) => {

    // Destroy the session
    req.session.destroy((err) => { 
      if (err) {
        console.error('Error destroying session:', err);
        return res.redirect('/');
      }
      // Redirect to home page
      res.redirect('/'); 
    });
  });

  

  // The Members Page   

  // Array of image filenames

  const images = ['welcome_1.jpg', 'welcome_2.jpg', 'welcome_3.jpg'];

  // Checking if the user is logged in

  const requireLogin = (req, res, next) => {
    if (!req.session.user) {
      // Return to Home Page if not logged in
      return res.redirect('/');
    }
    // If the user exists the next function is called
    // allowing the request to proceed to the route handler
    // for /members
    next();
  };

  app.get('/members', requireLogin, (req, res) => {
    try {
      const randomIndex = Math.floor(Math.random() * images.length);
      const randomImage = images[randomIndex];
      
      res.render('members', {
        user: req.session.user,
        randomImage: randomImage,
      });
    } catch (error) {
      console.error('Error rendering members page:', error);
      res.status(500).send('Error loading members page');
    }
  });


  // The 404 Error page

  app.use((req, res) => {

    // If any route is unmatched display the 404 page
    res.status(404).render('404'); 
  });

  // Starting the Server

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  