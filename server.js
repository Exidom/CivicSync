
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
/*todo
app.use(cors({
  origin: [
    "https://domain.com"
  ],
  methods: ["GET","POST"]
}));
*/

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

app.get("/createGroups", (req, res) => {
  res.render("createGroups");
});

app.get("/createEvent", (req, res) => {
  res.render("createEvent");
});

app.get("/dashboard", (req, res) => {
  res.render("dashboard");
});

app.get("/dashboardLoggedIn", (req, res) => {
  res.render("dashboardLoggedIn"); 
});

app.get("/signUpEvents", (req, res) => {
  res.render("signUpEvents");
});

app.get("/userProfile", (req, res) => {
  res.render("userProfile");
});

app.get("/viewGroup", (req, res) => {
  res.render("viewGroup");
});

app.get("/viewOrganization", (req, res) => {
  res.render("viewOrganization");
});

app.get("/manageEvent", (req, res) => {
  res.render("manageEvent");
});

app.get("/signUpEvent", (req, res) => {
  res.render("signUpEvent");
});

app.get("/eventDetails", (req, res) => {
  res.render("eventDetails");
});

app.get("/group", (req, res) => {
  res.render("group");
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

//testing
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

//testing
app.post("/update-profile", checkAuth, async (req, res) => {
  try{
    const { first_name, last_name, phone_number } = req.body;
    const { uid } = req.user;

    console.log("Updating profile for: ", uid);
    console.log(req.body);

    await db.query(
      "UPDATE users SET first_name = $1, last_name = $2, phone_number = $3 WHERE uid = $4",
      [first_name, last_name, phone_number, uid]
    )

    res.json({ 
      success: true
    });

  } catch (error) {
    res.status(500).json({ error: "Internal server error "});
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
    res.status(401).json({ error: "routing error"});
  }
});


app.post("/delete-image", checkAuth, async (req, res) => {
  try {
    const { pid,spot,group} = req.body;

    const tables = {
      user: "users",
      org: "orgs"
    };

    if(group!=null){
      //todo check if user is admin
      const query = `
        UPDATE groups
        SET iLink${spot} = $1,
            pid${spot} = $2
        WHERE gid = $3 AND
        pid${spot} = $4
      `;
      await db.query(query, [null, null, group,pid]);
      await cloudinary.uploader.destroy(pid);
      return res.json({ success: true });
    }

    if (!pid.startsWith(`user_uploads/${req.user.uid}`)) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    await cloudinary.uploader.destroy(pid);

    let tableType = "user";
    let iLinkCol = `iLink${spot}`;
    let pidCol = `pid${spot}`;

    if (((3<spot)&&(spot<=6))) {
      tableType = "org";
      iLinkCol = `iLink${spot-3}`;
      pidCol = `pid${spot-3}`;
    }
    else if (!((0<spot)&&(spot<=3))) {
      return res.status(400).json({ error: "spot incorrect" });
    }

    const table = tables[tableType];

    const query = `
      UPDATE ${table}
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
    res.status(500).json({ error: "Delete failed "});
  }
});



app.post("/create-user",checkAuth, async (req, res) => {
  const { uid,email} = req.user;
  try {

    const result = await db.query(
      `INSERT INTO users (uid,display_name)
       VALUES ($1,$2)
       ON CONFLICT (uid) DO NOTHING
       RETURNING uid`,
      [uid,email]
    );
    res.json({ 
      uid: uid
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "database error "});
  }
});


//loged user set image number x
app.post("/set-ilink", checkAuth, async (req, res) => {
  const { x, iLink, pid, group } = req.body;
  const { uid } = req.user;

  const tables = {
      user: "users",
      org: "orgs"
  };



  try {

    if(group!=null){
      //todo check if user is admin
      const query = `
        UPDATE groups
        SET iLink${x} = $1,
            pid${x} = $2
        WHERE gid = $3
      `;

      await db.query(query, [iLink, pid, group]);

      return res.json({ success: true });
    
    }


    let tableType = "user";
    let iLinkCol = `iLink${x}`;
    let pidCol = `pid${x}`;

    if (((3<x)&&(x<=6))) {
      tableType = "org";
      iLinkCol = `iLink${x-3}`;
      pidCol = `pid${x-3}`;
    }
    else if (!((0<x)&&(x<=3))) {
      return res.status(400).json({ error: "spot incorrect" });
    }

    const table = tables[tableType];


    const query1 = `
      SELECT ${pidCol}
      FROM ${table}
      WHERE uid = $1
    `;

    prevRow = await db.query(query1, [uid]);
    prev = prevRow.rows[0][pidCol];


    if (prev!=null){
      await cloudinary.uploader.destroy(prev);
    }

    const query = `
      UPDATE ${table}
      SET ${iLinkCol} = $1,
          ${pidCol} = $2
      WHERE uid = $3
    `;

    await db.query(query, [iLink, pid, uid]);

    res.json({ success: true });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "database error "});
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
    res.status(500).json({ error: "database error " });
  }
});

// For Group Creation
app.post("/api/groups", checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const email = req.user.email;

    await db.query(
      `INSERT INTO users (uid, display_name)
       VALUES ($1, $2)
       ON CONFLICT (uid) DO NOTHING`,
      [uid, email]
    );

    const {
      group_name,
      intro_text
    } = req.body;

    const result = await db.query(
      `INSERT INTO groups (
        group_name, intro_text,
        founder_id, created_time
      )
      VALUES ($1,$2,$3,CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        group_name,
        intro_text,
        uid
      ]
    );

    const group = result.rows[0];

    // Adds group founder as admin in membership
    await db.query(
      `INSERT INTO membership (uid, gid, admin)
       VALUES ($1, $2, $3)`,
      [uid, group.gid, true]
    );

    res.json(group);

  } catch (err) {
    console.error("GROUP CREATION ERROR:", err);
    res.status(500).json({ error: "Failed to create group" });
  }
});

// For Group Joining
app.post("/api/join-group", checkAuth, async (req, res) => {
  try{
    const { invite_code } = req.body;
    const uid = req.user.uid;

    const groupInvite = await db.query(
      "SELECT * FROM groups WHERE invite_code = $1",
      [invite_code]
    );

    if (groupInvite.rows.length === 0) {
      return res.status(400).json({ error: "Invalid invite code" });
    }

    const group = groupInvite.rows[0];

    // Prevents users signing up for the same group twice
    const noRepeats = await db.query(
      "SELECT * FROM membership WHERE uid = $1 AND gid = $2",
      [uid, group.gid]
    );

    if (noRepeats.rows.length > 0) {
      return res.status(400).json({ error: "You are already in this group" });
    }

    await db.query(
      "INSERT INTO membership (uid, gid, admin) VALUES ($1, $2, $3)",
      [uid, group.gid, false]
    );

    res.json({ success: true });
    
  } catch (err) {
    console.error("GROUP JOIN ERROR", err);
    res.status(500).json({ error: "Failed to join group" });
  }
});

// TODO: Create an app.post function to change a users permissions to admin

// For Org Creation
app.post("/api/orgs", checkAuth, async (req, res) => {
  try {
    const { org_name, intro_text } = req.body;
    const uid = req.user.uid;

    // Failsafe to prevent users creating multiple orgs
    const onlyOne = await db.query(
      "SELECT * FROM orgs WHERE founder_id = $1",
      [uid]
    );

    if (onlyOne.rows.length > 0) {
      return res.status(400).json({ error: "User already has an organization"});
    }

    const result = await db.query(
      "INSERT INTO orgs (founder_id, org_name, intro_text) VALUES ($1, $2, $3) RETURNING *",
      [uid, org_name, intro_text]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("ORG CREATION ERROR", err);
    res.status(500).json({ error: "Failed to create org" });
  }
});


// For Event Creation
app.post("/api/events", checkAuth, async (req, res) => {
  try {
    const { event_name, event_date, event_descripton } = req.body;
    const uid = req.user.uid;

    // Ensure only orgs create events
    const orgData = await db.query(
      "SELECT * FROM orgs WHERE founder_id = $1",
      [uid]
    );

    if (orgData.rows.length === 0) {
      return res.status(403).json({ error: "You must own an organization to create events" });
    }

    const org = orgData.rows[0];

    const result = await db.query(
      "INSERT INTO services (service_name, oid, info_text, date) VALUES ($1, $2, $3, $4) RETURNING *",
      [event_name, org.oid, event_descripton, event_date]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("EVENT CREATION ERROR ", err);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// Gets org info for createEvent
app.get("/api/createEventData", checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;

    const orgResult = await db.query(
      "SELECT * FROM orgs WHERE founder_id = $1",
      [uid]
    );

    res.json({
      hasOrg: orgResult.rows.length > 0
    });

  } catch (err) {
    console.error("CREATE_EVENT ORG REQUIREMENT ERROR", err);
    res.status(500).json({ error: "Failed to load org data" });
  }
});

// Gets Group And Event Info For Event Signups
app.get("/api/eventsSignupData", checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;

    // Check groups
    const groupData = await db.query(
      "SELECT * FROM membership WHERE uid = $1",
      [uid]
    );

    const hasGroup = groupData.rows.length > 0;

    let events = [];

    if (hasGroup) {
      const eventResult = await db.query(
        "SELECT * FROM services"
      );

      events = eventResult.rows;
    }

    res.json({
      hasGroup,
      events
    });

  } catch (err) {
    console.error("EVENT SIGNUP LOADING ERROR: ", err);
    res.status(500).json({ error: "Failed to load events" });
  }
});

// Collects group info for the group creation page
app.get("/api/createGroupData", checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;

    const groupResult = await db.query(
      `SELECT g.*
       FROM groups g
       JOIN membership m ON g.gid = m.gid
       WHERE m.uid = $1`,
      [uid]
    );

    const groups = groupResult.rows;

    res.json({
      hasGroup: groups.length > 0,
      groups
    });

  } catch (err) {
    console.error("GROUP CREATION LOADING ERROR ", err);
    res.status(500).json({ error: "Failed to load group data" });
  }
});

// TODO: Implement a leave-group feature


// Handles collecting user data from the database
app.get("/api/userProfileData", checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;

    const userData = await db.query(
      "SELECT * FROM users WHERE uid = $1",
      [uid]
    );

    const user = userData.rows[0];


    const groupData = await db.query(
      "SELECT g.* FROM groups g JOIN membership m ON g.gid = m.gid WHERE m.uid = $1",
      [uid]
    );

    const groups = groupData.rows;


    const orgData = await db.query(
      "SELECT * FROM orgs WHERE founder_id = $1",
      [uid]
    );

    const org = orgData.rows[0] || null;

    
    let events = [];
    // Only people in groups can sign up for events
    if (groups.length > 0) {
      const eventData = await db.query(
        "SELECT s.* FROM services s JOIN participation p ON s.sid = p.sid WHERE p.uid = $1",
        [uid]
      );
      events = eventData.rows;
    }

    res.json({
      ...user,
      hasGroup: groups.length > 0,
      hasOrg: !!org,
      hasEvent: events.length > 0,
      groups,
      org,
      events
    });

  } catch (err) {
    console.error("PROFILE INFO ERROR: ", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

// Get organization
app.get("/api/getOrganizationData", checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;  // UID from authentication

    // Query orgs where this user is the founder
    const orgData = await db.query(
      "SELECT org_name, intro_text FROM orgs WHERE founder_id = $1",
      [uid]
    );

    const org = orgData.rows[0] || null;

    if (!org) {
      return res.status(404).json({ error: "User has no organization" });
    }

    res.json(org);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create Event/Service
app.post("/api/services", checkAuth, async (req, res) => {
  const { service_name, info_text, time_start, estimated_volunteers, estimated_hours, visibility_public, applications_open } = req.body;
  const uid = req.user.uid;

  try {
    // Get the org ID for this user
    const orgData = await db.query(
      "SELECT oid FROM orgs WHERE founder_id = $1",
      [uid]
    );

    if (!orgData.rows[0]) {
      return res.status(403).json({ error: "User has no organization" });
    }

    const oid = orgData.rows[0].oid;

    // Insert the service
    const result = await db.query(
      `INSERT INTO services (service_name, oid, info_text, visibility_public, applications_open, estimated_volunteers, estimated_hours, created_time, finalized_time, time_start)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8)
       RETURNING *`,
      [service_name, oid, info_text, visibility_public, applications_open, estimated_volunteers, estimated_hours, time_start]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error creating service:", err);
    res.status(500).json({ error: "Failed to create service" });
  }
});

// Get Current Events
app.get("/api/services", checkAuth, async (req, res) => {
  const uid = req.user.uid;

  try {
    const orgData = await db.query(
      "SELECT oid FROM orgs WHERE founder_id = $1",
      [uid]
    );

    if (!orgData.rows[0]) {
      return res.status(404).json({ error: "User has no organization" });
    }

    const oid = orgData.rows[0].oid;

    const result = await db.query(
      "SELECT * FROM services WHERE oid = $1 ORDER BY time_start ASC",
      [oid]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching services:", err);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

// Edits current events
app.put("/api/services/:sid", checkAuth, async (req, res) => {
  const { sid } = req.params;
  const { service_name, info_text, time_start, estimated_volunteers, estimated_hours, visibility_public, applications_open } = req.body;
  const uid = req.user.uid;

  try {
    // Make sure this service belongs to the user's org
    const orgData = await db.query("SELECT oid FROM orgs WHERE founder_id = $1", [uid]);
    if (!orgData.rows[0]) return res.status(403).json({ error: "No organization found" });
    const oid = orgData.rows[0].oid;

    const result = await db.query(
      `UPDATE services SET service_name=$1, info_text=$2, time_start=$3, estimated_volunteers=$4, estimated_hours=$5, visibility_public=$6, applications_open=$7
       WHERE sid=$8 AND oid=$9 RETURNING *`,
      [service_name, info_text, time_start, estimated_volunteers, estimated_hours, visibility_public, applications_open, sid, oid]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Event not found or unauthorized" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating service:", err);
    res.status(500).json({ error: "Failed to update service" });
  }
});

// Deletes Current Events
app.delete("/api/services/:sid", checkAuth, async (req, res) => {
  const { sid } = req.params;
  const uid = req.user.uid;

  try {
    const orgData = await db.query("SELECT oid FROM orgs WHERE founder_id = $1", [uid]);
    if (!orgData.rows[0]) return res.status(403).json({ error: "No organization found" });
    const oid = orgData.rows[0].oid;

    // Removes any participants before deleting to avoid errors
    await db.query ("DELETE FROM participation WHERE sid = $1 RETURNING *", [sid]);

    const result = await db.query(
      "DELETE FROM services WHERE sid=$1 AND oid=$2 RETURNING *",
      [sid, oid]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Event not found or unauthorized" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting service:", err);
    res.status(500).json({ error: "Failed to delete service" });
  }
});

// Edit Orgs Functionality
app.put("/api/orgs", checkAuth, async (req, res) => {
  const { org_name, intro_text } = req.body;
  const uid = req.user.uid;

  try {
    const result = await db.query(
      "UPDATE orgs SET org_name=$1, intro_text=$2 WHERE founder_id=$3 RETURNING *",
      [org_name, intro_text, uid]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Organization not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating organization:", err);
    res.status(500).json({ error: "Failed to update organization" });
  }
});

// Get all applications for the org's events
app.get("/api/applications", checkAuth, async (req, res) => {
  const uid = req.user.uid;

  try {
    const orgData = await db.query("SELECT oid FROM orgs WHERE founder_id = $1", [uid]);
    if (!orgData.rows[0]) return res.status(404).json({ error: "No organization found" });
    const oid = orgData.rows[0].oid;

    const result = await db.query(
      `SELECT p.uid, p.sid, p.hours, p.status,
              s.service_name, s.estimated_volunteers,
              u.display_name, u.first_name, u.last_name
       FROM participation p
       JOIN services s ON p.sid = s.sid
       JOIN users u ON p.uid = u.uid
       WHERE s.oid = $1
       ORDER BY s.sid, p.status`,
      [oid]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching applications:", err);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// Approve or reject an application
app.put("/api/applications/:sid/:uid", checkAuth, async (req, res) => {
  const { sid, uid: applicantUid } = req.params;
  const { status } = req.body; // "approve" or "reject"
  const uid = req.user.uid;

  try {
    const orgData = await db.query("SELECT oid FROM orgs WHERE founder_id = $1", [uid]);
    if (!orgData.rows[0]) return res.status(403).json({ error: "No organization found" });
    const oid = orgData.rows[0].oid;

    // Update the application status
    const result = await db.query(
      `UPDATE participation SET status = $1
       WHERE sid = $2 AND uid = $3
       RETURNING *`,
      [status, sid, applicantUid]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Application not found" });

    // If approving, check if capacity has been hit
    if (status === "accepted") {
      const approvedCount = await db.query(
        "SELECT COUNT(*) FROM participation WHERE sid = $1 AND status = 'accepted'",
        [sid]
      );

      const serviceData = await db.query(
        "SELECT estimated_volunteers FROM services WHERE sid = $1 AND oid = $2",
        [sid, oid]
      );

      const approved = parseInt(approvedCount.rows[0].count);
      const max = serviceData.rows[0].estimated_volunteers;

      if (approved >= max) {
        // Reject all remaining pending applications
        await db.query(
          `UPDATE participation SET status = 'rejected'
          WHERE sid = $1 AND status = 'pending'`,
          [sid]
        );

        // Hide the event from public listing
        await db.query(
          "UPDATE services SET visibility_public = false WHERE sid = $1",
          [sid]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error updating application:", err);
    res.status(500).json({ error: "Failed to update application" });
  }
});

// User signs up for an event
app.post("/api/applications", checkAuth, async (req, res) => {
  const { sid, gid } = req.body;
  const uid = req.user.uid;

  try {
    // Get hours from the service
    const serviceData = await db.query(
      "SELECT estimated_hours FROM services WHERE sid = $1",
      [sid]
    );

    if (!serviceData.rows[0]) return res.status(404).json({ error: "Event not found" });
    const hours = serviceData.rows[0].estimated_hours;

    // Check if already applied
    const existing = await db.query(
      "SELECT * FROM participation WHERE uid = $1 AND sid = $2",
      [uid, sid]
    );

    if (existing.rows[0]) return res.status(400).json({ error: "Already applied to this event" });

    const result = await db.query(
      `INSERT INTO participation (uid, sid, hours, gid, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [uid, sid, hours, gid]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error creating application:", err);
    res.status(500).json({ error: "Failed to apply to event" });
  }
});

// Get all public events for signUpEvents page
app.get("/api/public-events", checkAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.sid, s.service_name, s.info_text, s.time_start, s.estimated_hours,
              o.org_name
       FROM services s
       JOIN orgs o ON s.oid = o.oid
       WHERE s.visibility_public = true
       ORDER BY s.time_start ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching public events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Get a single event by sid
app.get("/api/events/:sid", checkAuth, async (req, res) => {
  const { sid } = req.params;
  try {
    const result = await db.query(
      `SELECT s.sid, s.service_name, s.info_text, s.time_start, s.estimated_hours,
              s.estimated_volunteers, s.visibility_public, s.applications_open,
              o.org_name
       FROM services s
       JOIN orgs o ON s.oid = o.oid
       WHERE s.sid = $1`,
      [sid]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Event not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching event:", err);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// Get single event details for org
app.get("/api/manage-event/:sid", checkAuth, async (req, res) => {
  const { sid } = req.params;
  const uid = req.user.uid;

  try {
    const orgData = await db.query("SELECT oid FROM orgs WHERE founder_id = $1", [uid]);
    if (!orgData.rows[0]) return res.status(403).json({ error: "No organization found" });
    const oid = orgData.rows[0].oid;

    const result = await db.query(
      `SELECT s.sid, s.service_name, s.info_text, s.time_start, s.estimated_hours,
              s.estimated_volunteers, s.visibility_public, s.applications_open
       FROM services s
       WHERE s.sid = $1 AND s.oid = $2`,
      [sid, oid]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Event not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching event:", err);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// Get all participants for a specific event
app.get("/api/manage-event/:sid/participants", checkAuth, async (req, res) => {
  const { sid } = req.params;
  const uid = req.user.uid;

  try {
    const orgData = await db.query("SELECT oid FROM orgs WHERE founder_id = $1", [uid]);
    if (!orgData.rows[0]) return res.status(403).json({ error: "No organization found" });
    const oid = orgData.rows[0].oid;

    const result = await db.query(
      `SELECT p.uid, p.hours, p.status,
              u.display_name, u.first_name, u.last_name
       FROM participation p
       JOIN users u ON p.uid = u.uid
       JOIN services s ON p.sid = s.sid
       WHERE p.sid = $1 AND s.oid = $2
       ORDER BY p.status`,
      [sid, oid]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching participants:", err);
    res.status(500).json({ error: "Failed to fetch participants" });
  }
});

// Kick a participant
app.put("/api/manage-event/:sid/kick/:participantUid", checkAuth, async (req, res) => {
  const { sid, participantUid } = req.params;
  const uid = req.user.uid;

  try {
    const orgData = await db.query("SELECT oid FROM orgs WHERE founder_id = $1", [uid]);
    if (!orgData.rows[0]) return res.status(403).json({ error: "No organization found" });
    const oid = orgData.rows[0].oid;

    // Set participant status to reject
    await db.query(
      "UPDATE participation SET status = 'rejected' WHERE sid = $1 AND uid = $2",
      [sid, participantUid]
    );

    // Check current approved count vs capacity
    const approvedCount = await db.query(
      "SELECT COUNT(*) FROM participation WHERE sid = $1 AND status = 'accepted'",
      [sid]
    );

    const serviceData = await db.query(
      "SELECT estimated_volunteers, visibility_public FROM services WHERE sid = $1 AND oid = $2",
      [sid, oid]
    );

    const approved = parseInt(approvedCount.rows[0].count);
    const max = serviceData.rows[0].estimated_volunteers;

    // If was previously full, relist the event
    if (approved < max && !serviceData.rows[0].visibility_public) {
      await db.query(
        "UPDATE services SET visibility_public = true WHERE sid = $1",
        [sid]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error kicking participant:", err);
    res.status(500).json({ error: "Failed to kick participant" });
  }
});



app.post("/api/messageSend", checkAuth, async (req, res) => {//types (0=service,1=group,2=user,3=org,4=groupAdmins)
  //group and service ref type is invite code
  //sendId can be null unless sendType=1
  const { sendId, sendType, destId, destType, refId, refType} = req.params;
  const uid = req.user.uid;

  try{

    let toSendId = uid;
    let toSendType = "user";
    let toRefId = uid;
    let toRefType = "user";
    let toDestType = "groupAdmins";

    if(sendType==3){
      const orgData = await db.query("SELECT oid FROM orgs WHERE founder_id = $1", [uid]);
      if (!orgData.rows[0]) return res.status(403).json({ error: "No organization found" });
      toSendId = orgData.rows[0].oid;
      toSendType = "org";
    }
    
    if(sendType==1){
      const groupData = await db.query("SELECT admin FROM membership INNER JOIN groups on membership.gid = groups.gid WHERE invite_code = $1 AND uid = $2", [sendID,uid]);//sanatize?
      if (!groupData.rows[0]) return res.status(403).json({ error: "no position found" });
      if (!groupData.rows[0].admin) return res.status(403).json({ error: "no admin position found" });
      toSendId = sendId;
      toSendType = "group";
    }

    //sanatize?
    if(refType==0){
      //check refId is real service
      const serviceData = await db.query("SELECT sid FROM services WHERE invite_code = $1", [refId]);
      if (!serviceData.rows[0]) return res.status(403).json({ error: "no service found" });
    }
    if(destType==2){
      //check destId is real user
      const userData = await db.query("SELECT uid FROM users WHERE uid = $1", [destId]);
      if (!userData.rows[0]) return res.status(403).json({ error: "no user found" });
    }
    if(destType==4){
      //check destId is real group invite
       const adminData = await db.query("SELECT gid FROM groups WHERE invite_code = $1", [destId]);
      if (!adminData.rows[0]) return res.status(403).json({ error: "no group found" });
    }


    
    if(((toSendType == "org")||(toSendType == "user")) && ( ((destType==4)) && (refType==0))){//send services to groupAdmin
      toRefId = refId;
      toRefType = "service";

      const result = await db.query(
        `INSERT INTO messages (from_id,from_type,to_id,to_type,reference_id,reference_type)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [toSendId,toSendType,destId,toDestType,toRefId,toRefType]
      );
      res.json(result.rows[0]);
    }

    else if((toSendType == "user") && ( ((destType==4)) && (refType==2))){//apply to group admins
      
      const result = await db.query(
        `INSERT INTO messages (from_id,from_type,to_id,to_type,reference_id,reference_type)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [toSendId,toSendType,destId,toDestType,toRefId,toRefType]
      );
      res.json(result.rows[0]);
    }

    else if((toSendType == "group") && ( ((destType==2)) && (refType==1))){//invite users
      toRefId=sendId;
      toRefType = "group";
      toDestType = "user";

      const result = await db.query(
        `INSERT INTO messages (from_id,from_type,to_id,to_type,reference_id,reference_type)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [toSendId,toSendType,destId,toDestType,toRefId,toRefType]
      );
      res.json(result.rows[0]);
    }

    else if((toSendType == "group") && ( ((destType==1)) && (refType==0))){//share in group service
      if(destId!=sendId){
        return res.status(403).json({ error: "invalid message" });
      }
      else{
        toRefId=refId;
        toRefType = "service";
        toDestType = "group";
      }

      const result = await db.query(
        `INSERT INTO messages (from_id,from_type,to_id,to_type,reference_id,reference_type)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [toSendId,toSendType,destId,toDestType,toRefId,toRefType]
      );
      res.json(result.rows[0]);
    }

    return res.status(403).json({ error: "invalid message" });

  }
  catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Failed to send message" });
  }

});

app.get("/api/messageGetAdmin", checkAuth, async (req, res) => {
  const { gid } = req.params;
  const uid = req.user.uid;

  try{
    const groupData = await db.query("SELECT admin FROM membership WHERE gid = $1 AND uid = $2", [gid,uid]);//sanatize?
    if (!groupData.rows[0]) return res.status(403).json({ error: "no position found" });
    if (!groupData.rows[0].admin) return res.status(403).json({ error: "no admin position found" });

    const inviteData = await db.query("SELECT invite_code FROM groups WHERE gid = $1", [gid]);
    if (!inviteData.rows[0]) return res.status(403).json({ error: "no group found" });
    const inviteCode = inviteData.rows[0].invite_code;

    const result = await db.query(
      `SELECT FROM messages WHERE to_id = $1 AND to_type = "groupAdmins"`,
      [inviteCode]
    );
    res.json(result.rows);
  }
  catch (err) {
    console.error("Error getting messages:", err);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

app.get("/api/messageGetGroup", checkAuth, async (req, res) => {
  const { gid } = req.params;
  const uid = req.user.uid;

  try{
    const groupData = await db.query("SELECT admin FROM membership WHERE gid = $1 AND uid = $2", [gid,uid]);//sanatize?
    if (!groupData.rows[0]) return res.status(403).json({ error: "no position found" });

    const inviteData = await db.query("SELECT invite_code FROM groups WHERE gid = $1", [gid]);
    if (!inviteData.rows[0]) return res.status(403).json({ error: "no group found" });
    const inviteCode = inviteData.rows[0].invite_code;

    const result = await db.query(
      `SELECT FROM messages WHERE to_id = $1 AND to_type = "group"`,
      [inviteCode]
    );
    res.json(result.rows);
  }
  catch (err) {
    console.error("Error getting messages:", err);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

app.delete("/api/messageDelete", checkAuth, async (req, res) => {
  const { mid } = req.params;
  const uid = req.user.uid;

  try{
    const messageData = await db.query("SELECT * FROM messages WHERE mid = $1", [mid]);//sanatize?
    if (!messageData.rows[0]) return res.status(403).json({ error: "no message found" });

    if (messageData.rows[0].to_type=="user"){
      if(messageData.rows[0].to_id==uid){
        const result = await db.query(
          "DELETE FROM services WHERE mid=$1 RETURNING *",
          [mid]
        );
        if (!result.rows[0]) return res.status(404).json({ error: "Event not found or unauthorized" });
        res.json({ success: true });
      }
    }
    else if ((messageData.rows[0].to_type=="group")||(messageData.rows[0].to_type=="groupAdmin")){
      const groupData = await db.query("SELECT admin FROM membership INNER JOIN groups on membership.gid = groups.gid WHERE invite_code = $1 AND uid = $2", [messageData.rows[0].destId,uid]);
      if (!groupData.rows[0]) return res.status(403).json({ error: "no position found" });
      if (!groupData.rows[0].admin) return res.status(403).json({ error: "no admin position found" });

      const result = await db.query(
        "DELETE FROM services WHERE mid=$1 RETURNING *",
        [mid]
      );
      if (!result.rows[0]) return res.status(404).json({ error: "Event not found or unauthorized" });
      res.json({ success: true });
    }


    return res.status(403).json({ error: "invalid message delete" });
  }
  catch (err) {
    console.error("Error deleting message:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }

});


app.post("/api/baseGroupPermissions", checkAuth, async (req, res) => {
  const { gid } = req.body;
  const uid = req.user.uid;


  try{
    const groupData = await db.query("SELECT admin FROM membership WHERE gid = $1 AND uid = $2", [gid,uid]);//sanatize?
      if (!groupData.rows[0]) return res.json({ role: "none" });
      if (!groupData.rows[0].admin) return res.json({ role: "member" });
      return res.json({ role: "admin" });
  }
  catch (err) {
    console.error("Error deleting message:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});


app.post("/api/getGroupData", checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;  // UID from authentication
    const { gid } = req.body;


    const groupData = await db.query(
      "SELECT * FROM groups WHERE gid = $1",
      [gid]
    );

    const group = groupData.rows[0] || null;

    if (!group) {
      return res.status(404).json({ error: "No group found" });
    }

    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/groupUpdate", checkAuth, async (req, res) => {
  try {
    const { group_name, intro_text , gid} = req.body;
    const uid = req.user.uid;
  
    const groupData = await db.query("SELECT admin FROM membership WHERE gid = $1 AND uid = $2", [gid,uid]);//sanatize?
    if (!groupData.rows[0]) return res.status(404).json({ error: "found no permission" });
    if (!groupData.rows[0].admin) return res.status(404).json({ error: "found no permission" });

    const result = await db.query(
      "UPDATE groups SET group_name=$1, intro_text=$2 WHERE gid=$3 RETURNING *",
      [group_name, intro_text, gid]
    );


    res.json(result.rows[0]);

  } catch (err) {
    console.error("Group update ERROR", err);
    res.status(500).json({ error: "Failed to update group" });
  }
});

app.post("/api/getGroupMemberData", checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;  // UID from authentication
    const { gid } = req.body;

    const memberData = await db.query(
      "SELECT * FROM membership INNER JOIN users ON membership.uid = users.uid WHERE gid = $1",
      [gid]
    );

    const members = memberData.rows || null;

    if (!members) {
      return res.status(404).json({ error: "No members found" });
    }

    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/groupPromote", checkAuth, async (req, res) => {
  try {
    const { targetUid, gid} = req.body;
    const uid = req.user.uid;
  
    const groupData = await db.query("SELECT admin FROM membership WHERE gid = $1 AND uid = $2", [gid,uid]);//sanatize?
    if (!groupData.rows[0]) return res.status(404).json({ error: "found no permission" });
    if (!groupData.rows[0].admin) return res.status(404).json({ error: "found no permission" });

    const result = await db.query(
      "UPDATE membership SET admin=TRUE WHERE gid=$1 and uid = $2 RETURNING *",
      [gid, targetUid]
    );


    res.json(result.rows[0]);

  } catch (err) {
    console.error("Group promote ERROR", err);
    res.status(500).json({ error: "Failed to promote in group" });
  }
});

app.put("/api/groupKick", checkAuth, async (req, res) => {
  try {
    const { targetUid, gid} = req.body;
    const uid = req.user.uid;
  
    const groupData = await db.query("SELECT admin FROM membership WHERE gid = $1 AND uid = $2", [gid,uid]);//sanatize?
    if (!groupData.rows[0]) return res.status(404).json({ error: "found no permission" });
    if (!groupData.rows[0].admin) return res.status(404).json({ error: "found no permission" });

    const groupData2 = await db.query("SELECT admin FROM membership WHERE gid = $1 AND uid = $2", [gid,targetUidid]);//sanatize?
    if (!groupData2.rows[0]) return res.status(404).json({ error: "found no user" });
    if (groupData.rows[0].admin) return res.status(404).json({ error: "found user admin permission" });

    const result = await db.query(
      "UPDATE membership SET admin=TRUE WHERE gid=$1 and uid = $2 RETURNING *",
      [gid, targetUid]
    );


    res.json(result.rows[0]);

  } catch (err) {
    console.error("Group kick ERROR", err);
    res.status(500).json({ error: "Failed to kick from group" });
  }
});

app.post("/api/groupMedalCreate", checkAuth, async (req, res) => {
  try {
    const {hours, gid} = req.body;
    const uid = req.user.uid;
  
    const groupData = await db.query("SELECT admin FROM membership WHERE gid = $1 AND uid = $2", [gid,uid]);//sanatize?
    if (!groupData.rows[0]) return res.status(404).json({ error: "found no permission" });
    if (!groupData.rows[0].admin) return res.status(404).json({ error: "found no permission" });

    const medalData = await db.query("SELECT streak,deadline_date,complete FROM medals WHERE gid = $1 ORDER BY deadline_date DESC", [gid,uid]);
    const today = new Date().setHours(0,0,0,0);
    let streak = 0;
    if (!medalData.rows[0] ){
      const deadDate = new Date(medalData.rows[0].deadline_date).setHours(0,0,0,0);
      if (today<=deadDate){
        return res.status(404).json({ error: "already active medal" });
      }
      else{
        const streakDate = deadDate;
        streakDate.setDate(streakDate.getDate()+1);
        if ((today<=streakDate)&&medalData.rows[0].complete){
          streak=medalData.rows[0].streak+1;
        }
      }

    }
    const monthFuture = today;
    const expectedMonth = (monthFuture.getMonth() + 1) % 12;
    monthFuture.setMonth(monthFuture.getMonth() + 1); 
    if ((monthFuture.getMonth() !== expectedMonth)) {
        monthFuture.setDate(0);//last day of previous
    }


    const result = await db.query(
        `INSERT INTO medals (gid,hours,complete,streak,created_date,deadline_date)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [gid,hours,false,streak,today,monthFuture]
      );
      res.json(result.rows[0]);

  } catch (err) {
    console.error("Group kick ERROR", err);
    res.status(500).json({ error: "Failed to kick from group" });
  }
});


// Mark hours as completed for tracking
app.put("/api/participation/complete", checkAuth, async (req, res) => {
  const { uid, sid, hours } = req.body;

  try {
    await db.query(
      `UPDATE participation
       SET status = 'completed',
           hours = $1,
           credited_at = NOW()
       WHERE uid = $2 AND sid = $3`,
      [hours, uid, sid]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Complete participation error:", err);
    res.status(500).json({ error: "Failed to mark completed" });
  }
});

// Tracks a users completed hours instead of storing in the database
app.get("/api/user-hours", checkAuth, async (req, res) => {
  const uid = req.user.uid;

  try{
    const result = await db.query(
      `SELECT COALESCE(SUM(hours), 0) AS total
      FROM participation
      WHERE uid = $1 AND status = 'completed'`,
      [uid]
    );

    res.json({ total: result.rows[0].total });
  } catch (err) {
    console.error("Error finding completed user hours:", err);
    res.status(500).json({ error: "Failed to calculate users hours"});
  }
});

// Tracks the total number of hours completed by all users in a group
app.get("/api/group-hours", checkAuth, async (req, res) => {
  const uid = req.user.uid;

  try{
    const result = await db.query(
      `SELECT p.gid, COALESCE(SUM(p.hours), 0) AS total
      FROM participation p
      WHERE p.status = 'completed' AND p.gid IN (SELECT gid FROM membership WHERE uid = $1)
      GROUP BY p.gid`,
      [uid]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error finding completed group hours:", err);
    res.status(500).json({ error: "Failed to calculate groups hours"});
  }
});

app.use(express.static("public"));


app.listen(3000, () => console.log("Server running on port 3000"));
console.log("Server running on: http://localhost:3000/login");