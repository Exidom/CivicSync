
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

app.get("/login", (req, res) => {
  res.render("login"); 
});



const checkAuth = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) return res.status(401).json({ error: "bad token" });

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error("Auth Error Code:", error.code);

        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: "bad token" });
        } else if (error.code === 'auth/argument-error') {
            return res.status(401).json({ error: "bad token" });
        }
        return res.status(403).json({ error: "invalid permissions" });
    }
};


app.get("/time", checkAuth, async (req, res) => {
  const result = await db.query("SELECT NOW()");
  res.json({
    time: result.rows,
    user: req.user.email
  });
});

app.post("/update-profile", checkAuth, async (req, res) => {

    const { username, picture } = req.body;
    const uid = req.user.uid;

    console.log(`User ${uid} wants to change theme to ${picture}`);

    res.json({ status: "Profile updated for " + req.user.email });
});


app.listen(3000, () => console.log("Server running on port 3000"));