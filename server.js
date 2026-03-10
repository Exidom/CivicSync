
const db = require('./db');


const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.applicationDefault()//uses env
});

const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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

app.get("/imag", (req, res) => {
  res.render("imag"); 
});


//get user from token (or 401 status)
const checkAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Missing or invalid token format" });
    }
    
    const token = authHeader.split('Bearer ')[1];

    try {
        const checkRevoked = false;//may be old
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
//get user from token (or 401 status) (extra secure)
const checkAuthSec = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Missing or invalid token format" });
    }
    
    const token = authHeader.split('Bearer ')[1];

    try {
        const checkRevoked = true;//sec
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
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/update-profile", checkAuth, async (req, res) => {
  try{
    const { username, picture } = req.body;
    const {uid} = req.user;

    console.log(`User ${req.user.email} wants to change theme to ${picture}`);

    res.json({ 
      status: "Profile updated for " + req.user.email 
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});




//sig for user, to be stored as user's
app.post("/cloudinary-signature", checkAuth, async (req, res) => {
  try {

    const timestamp = Math.round(new Date().getTime() / 1000);

    const params = {
      timestamp,
      folder: `user_uploads/${req.user.uid}`,
      transformation: "w_1024,h_1024,c_fill,q_auto:good"
    };

    const signature = cloudinary.utils.api_sign_request(//encrypt
      params,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      timestamp,
      signature,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder: params.folder,
      transformation: params.transformation
    });

  } catch (error) {
    res.status(401).json({ error: "routing error" });
  }
});

app.post("/delete-image", checkAuth, async (req, res) => {
  try {
    const { pid,spot,group} = req.body;

    if (!pid.startsWith(`user_uploads/${req.user.uid}`)) {
      if(group!=null){
        //look for public id in group
        //check if user is admin
        //delete entry with public id in database
      }
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    await cloudinary.uploader.destroy(pid);

    //todo delete entry with public id in database org or user
    const iLinkCol = `iLink${spot}`;
    const pidCol = `pid${spot}`;

    const query = `
      UPDATE users
      SET ${iLinkCol} = $1,
          ${pidCol} = $2
      WHERE uid = $3 AND
      ${pidCol} = $4
    `;
    await db.query(query, [null, null, req.user.uid,pid]);
    res.json({ 
      success: true 
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Delete failed" });
  }

});



app.post("/create-user",checkAuth, async (req, res) => {
  const { uid } = req.user;
  try {

    const result = await db.query(
      `INSERT INTO users (uid)
       VALUES ($1)
       ON CONFLICT (uid) DO NOTHING
       RETURNING uid`,
      [uid]
    );
    res.json({ 
      uid: uid
    });

  } catch (error) {
    res.status(500).json({ error: "database error "+error});
  }
});

//loged user set image number x
app.post("/set-ilink", checkAuth, async (req, res) => {
  const { x, iLink, pid } = req.body;
  const { uid } = req.user;

  if (!uid || !x || !iLink || !pid) {
    return res.status(400).json({ error: "uid, x, iLink, pid required" });
  }

  if (![1,2,3].includes(Number(x))) {
    return res.status(400).json({ error: "x must be 1, 2, or 3" });
  }

  const iLinkCol = `iLink${x}`;
  const pidCol = `pid${x}`;

  try {
    const query = `
      UPDATE users
      SET ${iLinkCol} = $1,
          ${pidCol} = $2
      WHERE uid = $3
    `;

    await db.query(query, [iLink, pid, uid]);

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: "database error" });
  }
});

app.post("/get-user", checkAuth, async (req, res) => {
  const { uid } = req.body;

  try {
    const result = await db.query(
      "SELECT * FROM users WHERE uid = $1",
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);

  } catch (error) {
    res.status(500).json({ error: "database error" });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));