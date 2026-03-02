
const db = require('./db');


const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.applicationDefault()//uses env
});

const express = require("express");
const app = express();
app.use(express.json());
app.use(express.static('public'));
app.set("view engine", "ejs");

const cors = require('cors');
app.use(cors());

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.get("/login", (req, res) => {
  res.render("login"); 
});



const checkAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Missing or invalid token format" });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const checkRevoked = false;//true for data clear?
        const decodedToken = await admin.auth().verifyIdToken(token, checkRevoked);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error("Auth Error:", error.code); 

        if (error.code === 'auth/id-token-revoked') {
            return res.status(401).json({ error: "Session revoked. Please login again." });
        }
        
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: "Session expired." });
        }

        return res.status(401).json({ error: "Authentication failed" });
    }
};

app.get("/time", checkAuth, async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.json({
      time: result.rows,
      user: req.user.email
    });
  } catch (dbError) {
    console.error("Database failure:", dbError);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/update-profile", checkAuth, async (req, res) => {
  try{
    const { username, picture } = req.body;
    const uid = req.user.uid;

    console.log(`User ${req.user.email} wants to change theme to ${picture}`);

    res.json({ 
      status: "Profile updated for " + req.user.email 
    });
  } catch (dbError) {
    console.error("Database failure:", dbError);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.listen(3000, () => console.log("Server running on port 3000"));