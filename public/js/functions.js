import { fetchWithAuth } from "/js/auth.js";
import {uploadImage,deleteImage} from "/js/clin.js";

// Loads the user's profile when entering a page, and updates it if submitted
export async function initUserProfile() {
  const user = await loadUserProfile();
  if (!user) return;

  const form = document.getElementById("profileForm");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const inputPhone = document.getElementById("phone").value

      // Removes any extra characters like "()" or "-"
      let formattedPhone = inputPhone.replace(/\D/g, "");

      // Adds a +1 if it is 10 digits
      if (formattedPhone.length == 10) {
        formattedPhone = "+1" + formattedPhone;
      }

      // If it already has a US country code
      else if (formattedPhone.length === 11 && formattedPhone.startsWith("1")) {
        formattedPhone = "+" + formattedPhone;
      }
      else {
        formattedPhone = null;
      }

      const profileData = {
        first_name: document.getElementById("firstName").value,
        last_name: document.getElementById("lastName").value,
        phone_number: formattedPhone,
        user_description: document.getElementById("userDescription").value
      };

      try {
        await fetchWithAuth("/update-profile", "POST", profileData);
        alert("Profile updated!");
        location.reload();
      } catch (err) {
        console.error(err);
        alert("Update failed", err.message);
      }
    });
  }
}

// Loads the users profile from the database
export async function loadUserProfile() {
  try {
    const user = await fetchWithAuth("/api/userProfileData");

    document.getElementById("email").value = user.display_name;
    document.getElementById("firstName").value = user.first_name || "";
    document.getElementById("lastName").value = user.last_name || "";
    document.getElementById("phone").value = user.phone_number || "";
    document.getElementById("userDescription").value = user.user_description || "";


    const groupSection = document.getElementById("groupSection");
    const noGroupSection = document.getElementById("noGroupSection");
    const groupList = document.getElementById("groupList");

    if (user.hasGroup) {
      groupSection.style.display = "inline-block";
      noGroupSection.style.display = "none";

      const groupHours = await fetchWithAuth("/api/group-hours");

      const hoursMap = {};
      if (groupHours && Array.isArray(groupHours)) {
        groupHours.forEach(g => {
          hoursMap[g.gid] = g.total;
        });
      }

      user.groups.sort((a, b) => (hoursMap[b.gid] || 0) - (hoursMap[a.gid] || 0));
      
      groupList.innerHTML = "";
      user.groups.forEach(g => {
        const div = document.createElement("div");
        div.className = "card";
        div.style = "border-radius: 8px; border: 1px solid #086375; margin-bottom: 20px;"

        const totalHours = hoursMap[g.gid] ?? 0;

        div.innerHTML = `
          <h3>${g.group_name}</h3>
          <p>Total Group Hours: ${totalHours}</p>
        `;

        groupList.appendChild(div);
      });

    } else {
      groupSection.style.display = "none";
      noGroupSection.style.display = "inline-block";
    }


    const orgSection = document.getElementById("orgSection");
    const noOrgSection = document.getElementById("noOrgSection");

    if (user.hasOrg) {
      orgSection.style.display = "inline-block";
      noOrgSection.style.display = "none";

      document.getElementById("orgName").innerText = user.org.org_name;

    } else {
      orgSection.style.display = "none";
      noOrgSection.style.display = "inline-block";
    }


    const eventSection = document.getElementById("eventSection");
    const noEventSection = document.getElementById("noEventSection");
    const eventList = document.getElementById("eventList");

    if (user.hasEvent) {
      eventSection.style.display = "inline-block";
      noEventSection.style.display = "none";

      eventList.innerHTML = user.events.map(event => `
      <div class="event-card" style="margin-bottom: 20px; max-width: 450px;">
        <h3>${event.service_name}</h3>
        <p>${event.org_name}</p>
        <p>Start date: ${new Date(event.time_start).toLocaleString()}</p>
        <p>Description: ${event.info_text || ""}</p>
        <p>Hours: ${event.estimated_hours}</p>
        <p>Status: ${event.status.charAt(0).toUpperCase() + event.status.slice(1)}</p>
        <button class="view-event-btn" data-sid="${event.sid}">View Event</button>
      </div>
    `).join("");

    } else if (user.hasGroup) {
      eventSection.style.display = "none";
      noEventSection.style.display = "inline-block";

    } else {
      eventSection.style.display = "none";
      noEventSection.style.display = "none";
    }

    const userHours = await fetchWithAuth("/api/user-hours");
    document.getElementById("totalHours").innerText = "You have " + (userHours.total || 0) + " completed service hours";

    return user;

  } catch (err) {
    console.error("Failed to load profile: " + err);
    return null;
  }
}

// Creates organizations
export function initCreateOrg() {
  const form = document.getElementById("createOrgForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const org_name = document.getElementById("orgNameInput").value.trim();
    const intro_text = document.getElementById("orgIntroInput").value.trim();

    if (!org_name) {
      alert("Organization name is required");
      return;
    }

    try {
      await fetchWithAuth("/api/orgs", "POST", {
        org_name,
        intro_text
      });

      alert("Organization created!");
      location.reload();

    } catch (err) {
      console.error("INIT CREATE ORG ERROR", err);
      alert("Failed to create organization");
    }
  });
}

// Handles users joining existing groups
export function initJoinGroup() {
  const button = document.getElementById("groupCodeSubmit");
  if (!button) return;

  button.addEventListener("click", async () => {
    const code = document.getElementById("groupCode").value.trim();
  
    if (!code) {
      alert("Enter an invite code");
      return;
    }

    try {
      await fetchWithAuth("/api/join-group", "POST", {
        invite_code: code
      });

      alert("Joined group!");
      location.reload();

    } catch (err) {
      console.error("INIT JOIN GROUP ERROR", err)
      alert("Invalid code, or user already in this group");
    }
  });
}

// Loads the active medals belonging to a user's groups
export async function loadMedals() {
  try {
    const medals = await fetchWithAuth("/api/userMedals");
    const container = document.getElementById("medalsList");

    if (!container) return;

    if (!medals || medals.length === 0) {
      container.innerHTML = "<p>No active medals.</p>";
      return;
    }

    container.innerHTML = medals.map(m => {

      const progress = m.group_total_hours;
      const goal = m.hours;

      const percent = Math.min((progress / goal) * 100, 100);

      return `
        <div class="card" style="margin-bottom: 20px;">
          <h3>${m.group_name}</h3>

          <p><strong>Goal:</strong> ${goal} hours</p>
          <p><strong>Group Progress:</strong> ${progress} / ${goal}</p>
          <p><strong>Your Contribution:</strong> ${m.user_hours}</p>

          <p><strong>Deadline:</strong> ${new Date(m.deadline_date).toLocaleDateString()}</p>
          <p><strong>Streak:</strong> ${m.streak}</p>
          <p><strong>Status:</strong> ${m.complete ? "Completed!" : "In Progress"}</p>

          <div style="background:#ddd; height:10px; border-radius:5px;">
            <div style="width:${percent}%; background:#086375; height:10px; border-radius:5px;"></div>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("Failed to load medals:", err);
  }
}

// Combines create event page functions
export function initCreateEvent() {
  loadCreateEvent();
  createEventSubmit();
}

// Determines the create event page layout depending on org ownership
async function loadCreateEvent() {
  try {
    const data = await fetchWithAuth("/api/createEventData");

    const formSection = document.getElementById("eventFormSection");
    const noOrgSection = document.getElementById("noOrgEventSection");

    if (data.hasOrg) {
      formSection.style.display = "block";
      noOrgSection.style.display = "none";
    } else {
      formSection.style.display = "none";
      noOrgSection.style.display = "block";
    }

  } catch (err) {
    console.error("Failed to load create event page", err);
  }
}

// Handles the submission of new events
function createEventSubmit() {
  const form = document.getElementById("createEventForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const eventData = {
      event_name: document.getElementById("event_name").value,
      event_date: document.getElementById("event_date").value,
      event_description: document.getElementById("event_description").value
    };

    try {
      await fetchWithAuth("/api/events", "POST", eventData);

      alert("Event Created!");
      form.reset();

    } catch (err) {
      console.error("SUBMIT EVENT ERROR ", err)
      alert("Failed to create event");
    }
  });
}

// Combines create group page functions
export function initCreateGroups() {
  loadCreateGroup();
  submitNewGroup();
  initJoinGroup(); 
}

// Displays a users groups if they are a part of any:
async function loadCreateGroup() {
  try {
    const data = await fetchWithAuth("/api/createGroupData");

    const hasGroupSection = document.getElementById("hasGroupSection");
    const noGroupSection = document.getElementById("noGroupSection");
    const groupList = document.getElementById("groupList");

    if (data.hasGroup) {
      hasGroupSection.style.display = "block";
      noGroupSection.style.display = "block"; 

      groupList.innerHTML = "";

      data.groups.forEach(g => {
        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `<h2>${g.group_name}</h2>`;

        groupList.appendChild(div);
      });

    } else {
      hasGroupSection.style.display = "none";
      noGroupSection.style.display = "block";
    }

  } catch (err) {
    console.error("Failed to load create groups page", err);
  }
}

// Creates New Groups  
function submitNewGroup() {
  const form = document.getElementById("createGroupForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const groupData = {
      group_name: document.getElementById("group_name").value,
      intro_text: document.getElementById("group_intro_text").value
    };

    try {
      // Use fetchWithAuth to get Firebase token
      await fetchWithAuth("/api/groups", "POST", groupData);

      alert("Group Created!");
      location.reload();

    } catch (err) {
      console.error("SUBMIT NEW GROUP ERROR ", err);
      alert("Failed to create group")
    }
  });
}

// Loads organization information
export async function loadOrganization() {
  try {
    console.log("Fetching org...");

    // Using auth helper instead of fetch
    const data = await fetchWithAuth("/api/getOrganizationData", "GET");

    if (!data) {
      document.getElementById("org-name").textContent = "No organization found";
      document.getElementById("org-description").textContent = "";
      return;
    }

    document.getElementById("org-name").textContent = data.org_name;
    document.getElementById("org-description").textContent = data.intro_text;

  } catch (err) {
    console.error(err);
    document.getElementById("org-name").textContent = "You are not in an Organization";
    document.getElementById("org-description").textContent = "";
  }
}

// Adds additional tab functionality
function openTab(tabName, button) {
  const tabContents = document.querySelectorAll(".tabcontent");
  tabContents.forEach(tc => tc.style.display = "none");

  const tabButtons = document.querySelectorAll(".tab-vertical-buttons button");
  tabButtons.forEach(btn => btn.classList.remove("active"));

  document.getElementById(tabName).style.display = "block";
  button.classList.add("active");
}

document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll(".tab-vertical-buttons button");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      openTab(btn.dataset.tab, btn);
    });
  });

  tabButtons[0].click();
});

window.openTab = openTab; // Makes openTab function global

export async function fetchOrg(fetchWithAuth) {
  const data = await fetchWithAuth("/api/getOrganizationData", "GET");

  const orgNameEl = document.getElementById("org-name");
  const orgDescEl = document.getElementById("org-description");
  const noOrgSection = document.getElementById("noOrgSection");

  if (data && !data.error) {
    orgNameEl.textContent = data.org_name;
    orgDescEl.innerHTML = `<p>${data.intro_text || ""}</p>`;
    noOrgSection.style.display = "none";
    document.querySelectorAll('.tab-vertical-buttons button').forEach(btn => {
      btn.disabled = false;
    });
    initEditOrg(fetchWithAuth); // only init when org exists
  } else {
    orgNameEl.textContent = "";
    orgDescEl.innerHTML = "";
    noOrgSection.style.display = "block";
    document.querySelector(".large-card").style.display = "none";
    document.querySelectorAll('.tab-vertical-buttons button').forEach(btn => {
      if (btn.dataset.tab !== "Profile") btn.disabled = true;
    });
  }
}

// Gets current events
export async function fetchEvents(fetchWithAuth) {
  const events = await fetchWithAuth("/api/services", "GET");
  const container = document.getElementById("events-container");

  if (!events || events.error || events.length === 0) {
    container.innerHTML = `<div class="event-card placeholder"><p>No events yet.</p></div>`;
    return;
  }

  container.innerHTML = events.map(event => `
      <div class="event-card" data-sid="${event.sid}">
        <div class="event-view">
          <h3>${event.service_name}</h3>
          <p>${new Date(event.time_start).toLocaleString()}</p>
          <p>${event.info_text || ""}</p>
          <p>Volunteers needed: ${event.estimated_volunteers} &nbsp;|&nbsp; Hours: ${event.estimated_hours}</p>
          <p>${event.visibility_public ? "Public" : "Private"} &nbsp;|&nbsp; Applications: ${event.applications_open ? "Open" : "Closed"}</p>
          <button class="manage-event-btn" data-sid="${event.sid}">Manage Event</button>
          <button class="edit-event-btn" data-sid="${event.sid}">Edit</button>
          <button class="delete-event-btn" data-sid="${event.sid}">Delete</button>
        </div>

      <div class="event-edit" style="display:none;">
        <label>Service Name: <input type="text" name="service_name" value="${event.service_name}"></label><br>
        <label>Description:<br><textarea name="info_text" rows="3">${event.info_text || ""}</textarea></label><br>
        <label>Start Date/Time: <input type="datetime-local" name="time_start" value="${event.time_start.slice(0, 16)}"></label><br>
        <label>Volunteers Needed: <input type="number" name="estimated_volunteers" value="${event.estimated_volunteers}" min="1"></label><br>
        <label>Hours: <input type="number" name="estimated_hours" value="${event.estimated_hours}" min="1"></label><br>
        <label>Visible to Public:
          <select name="visibility_public">
            <option value="true" ${event.visibility_public ? "selected" : ""}>Yes</option>
            <option value="false" ${!event.visibility_public ? "selected" : ""}>No</option>
          </select>
        </label><br>
        <label>Applications Open:
          <select name="applications_open">
            <option value="true" ${event.applications_open ? "selected" : ""}>Yes</option>
            <option value="false" ${!event.applications_open ? "selected" : ""}>No</option>
          </select>
        </label><br>
        <button class="save-event-btn" data-sid="${event.sid}">Save</button>
        <button class="cancel-edit-btn" data-sid="${event.sid}">Cancel</button>
      </div>
    </div>
  `).join("");
}

// Delete and Edit functionality in the current events
export function initEventActions(fetchWithAuth) {
  const container = document.getElementById("events-container");

  container.addEventListener("click", async (e) => {
    const sid = e.target.dataset.sid;
    const card = document.querySelector(`.event-card[data-sid="${sid}"]`);

    // Navigate to manage event page
    if (e.target.classList.contains("manage-event-btn")) {
      sessionStorage.setItem("selectedOrgSid", sid);
      window.location.href = "/manageEvent";
    }

    // Show edit form
    if (e.target.classList.contains("edit-event-btn")) {
      card.querySelector(".event-view").style.display = "none";
      card.querySelector(".event-edit").style.display = "block";
    }

    // Hide edit form
    if (e.target.classList.contains("cancel-edit-btn")) {
      card.querySelector(".event-view").style.display = "block";
      card.querySelector(".event-edit").style.display = "none";
    }

    // Save edits
    if (e.target.classList.contains("save-event-btn")) {
      const editForm = card.querySelector(".event-edit");
      const payload = {
        service_name: editForm.querySelector("[name=service_name]").value.trim(),
        info_text: editForm.querySelector("[name=info_text]").value.trim(),
        time_start: editForm.querySelector("[name=time_start]").value,
        estimated_volunteers: parseInt(editForm.querySelector("[name=estimated_volunteers]").value),
        estimated_hours: parseInt(editForm.querySelector("[name=estimated_hours]").value),
        visibility_public: editForm.querySelector("[name=visibility_public]").value === "true",
        applications_open: editForm.querySelector("[name=applications_open]").value === "true"
      };

      try {
        const res = await fetchWithAuth(`/api/services/${sid}`, "PUT", payload);
        if (res.error) { alert("Error updating event: " + res.error); return; }
        alert("Event updated!");
        await fetchEvents(fetchWithAuth);
      } catch (err) {
        console.error("Failed to update event:", err);
        alert("Failed to update event.");
      }
    }

    // Delete
    if (e.target.classList.contains("delete-event-btn")) {
      if (!confirm("Are you sure you want to delete this event? \n\nWarning: Deletion will remove any credited hours for users and groups. \nSelect edit to close applications or make the event private.")) return;

      try {
        const res = await fetchWithAuth(`/api/services/${sid}`, "DELETE");
        if (res && res.error) { alert("Error deleting event: " + res.error); return; }
        await fetchEvents(fetchWithAuth);
      } catch (err) {
        console.error("Failed to delete event:", err);
        alert("Failed to delete event.");
      }
    }
  });
}

// Edit organizations functionality
export function initEditOrg(fetchWithAuth) {
  const editBtn = document.getElementById("editOrgBtn");
  const editForm = document.getElementById("editOrgForm");
  const cancelBtn = document.getElementById("cancelEditOrgBtn");

  editBtn.addEventListener("click", () => {
    // Pre-fill with current values
    document.getElementById("editOrgName").value = document.getElementById("org-name").textContent;
    document.getElementById("editOrgIntro").value = document.getElementById("org-description").innerText;
    editForm.style.display = "block";
    editBtn.style.display = "none";
  });

  cancelBtn.addEventListener("click", () => {
    editForm.style.display = "none";
    editBtn.style.display = "block";
  });

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const org_name = document.getElementById("editOrgName").value.trim();
    const intro_text = document.getElementById("editOrgIntro").value.trim();

    if (!org_name) { alert("Organization name is required."); return; }

    try {
      const res = await fetchWithAuth("/api/orgs", "PUT", { org_name, intro_text });
      if (res.error) { alert("Error updating organization: " + res.error); return; }

      // Update the displayed values
      document.getElementById("org-name").textContent = res.org_name;
      document.getElementById("org-description").innerHTML = `<p>${res.intro_text || ""}</p>`;

      editForm.style.display = "none";
      editBtn.style.display = "block";
      alert("Organization Information Saved!");
    } catch (err) {
      console.error("Failed to Update Organization:", err);
      alert("Failed to Update Organization.");
    }
  });
}

// Gets Applications
export async function fetchApplications(fetchWithAuth) {
  const applications = await fetchWithAuth("/api/applications", "GET");
  const container = document.getElementById("applications-container");

  if (!applications || applications.error || applications.length === 0) {
    container.innerHTML = `<div class="event-card placeholder"><p>No applications yet.</p></div>`;
    return;
  }

  // Group applications by event
  const grouped = applications.reduce((acc, app) => {
    if (!acc[app.sid]) {
      acc[app.sid] = { service_name: app.service_name, applications: [] };
    }
    acc[app.sid].applications.push(app);
    return acc;
  }, {});

  container.innerHTML = Object.entries(grouped).map(([sid, group]) => `
    <div class="event-card">
      <h3>${group.service_name}</h3>
      ${group.applications.map(app => {
        const name = app.first_name
          ? `${app.first_name} ${app.last_name ? app.last_name[0] + "." : ""}`
          : app.display_name;

        const isPending = app.status === "pending";

        return `
          <div class="application-row" data-sid="${app.sid}" data-uid="${app.uid}">
            <span>${name}</span>
            <span class="app-status status-${app.status}">${app.status.charAt(0).toUpperCase() + app.status.slice(1)}</span>
            ${isPending ? `
              <button class="approve-btn" data-sid="${app.sid}" data-uid="${app.uid}">Approve</button>
              <button class="reject-btn" data-sid="${app.sid}" data-uid="${app.uid}">Reject</button>
            ` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `).join("");
}

// Applications Information
export function initApplicationActions(fetchWithAuth) {
  const container = document.getElementById("applications-container");

  container.addEventListener("click", async (e) => {
    const sid = e.target.dataset.sid;
    const uid = e.target.dataset.uid;

    if (!sid || !uid) return;

    let status = null;
    if (e.target.classList.contains("approve-btn")) status = "accepted";
    if (e.target.classList.contains("reject-btn")) status = "rejected";
    if (!status) return;

    try {
      const res = await fetchWithAuth(`/api/applications/${sid}/${uid}`, "PUT", { status });
      if (res.error) { alert(`Error: ${res.error}`); return; }
      await fetchApplications(fetchWithAuth);
    } catch (err) {
      console.error("Failed to update application:", err);
      alert("Failed to update application.");
    }
  });
}

export async function initSignUpEvents() {
  try {
    const events = await fetchWithAuth("/api/public-events", "GET");
    const list = document.getElementById("eventSignupList");
    const section = document.getElementById("eventSignupSection");
    const noGroupSection = document.getElementById("noGroupEventSection");

    section.style.display = "block";
    noGroupSection.style.display = "none";

    if (!events || events.length === 0) {
      list.innerHTML = `<div class="event-card placeholder"><p>No events available.</p></div>`;
      return;
    }

    list.innerHTML = events.map(event => `
      <div class="event-card">
        <h3>${event.service_name}</h3>
        <p>${event.org_name}</p>
        <p>${new Date(event.time_start).toLocaleString()}</p>
        <p>${event.info_text || ""}</p>
        <p>Hours: ${event.estimated_hours}</p>
        <button class="view-event-btn" data-sid="${event.sid}">View Event</button>
      </div>
    `).join("");

    list.addEventListener("click", (e) => {
      if (!e.target.classList.contains("view-event-btn")) return;
      sessionStorage.setItem("selectedSid", e.target.dataset.sid);
      window.location.href = "/eventDetails";
    });

  } catch (err) {
    console.error("Failed to load events:", err);
  }
}

export async function initEventDetails() {
  const sid = sessionStorage.getItem("selectedSid");
  if (!sid) { window.location.href = "/signUpEvents"; return; }

  try {
    const event = await fetchWithAuth(`/api/events/${sid}`, "GET");
    if (!event || event.error) { window.location.href = "/signUpEvents"; return; }

    document.getElementById("event-name").textContent = event.service_name;
    document.getElementById("event-description").textContent = event.info_text || "";
    document.getElementById("event-org").textContent = event.org_name;
    document.getElementById("event-time").textContent = new Date(event.time_start).toLocaleString();
    document.getElementById("event-hours").textContent = event.estimated_hours;

    const groupData = await fetchWithAuth("/api/createGroupData");

    const select = document.getElementById("groupSelect");
    select.innerHTML = "";

    const joinBtn = document.getElementById("joinEventBtn");

    if (!groupData.hasGroup || groupData.groups.length === 0) {
      const option = document.createElement("option");
      option.disabled = true;
      select.appendChild(option);
      joinBtn.textContent = "Join a group first";
      joinBtn.disabled = true;
    } 
    
    else {
      groupData.groups.forEach(g => {
        const option = document.createElement("option");
        option.value = g.gid;
        option.textContent = g.group_name;
        select.appendChild(option);
      });
    }

    if (!event.applications_open || !event.visibility_public) {
      joinBtn.textContent = "Applications Closed";
      joinBtn.disabled = true;
      return;
    }

    joinBtn.addEventListener("click", async () => {
      try {
        const gid = select.value;

        if (!gid) {
          alert("Please select a group");
          return;
        }

        const res = await fetchWithAuth("/api/applications", "POST", { sid, gid });
        if (res.error) { alert(res.error); return; }
        alert("Successfully applied!");
        joinBtn.textContent = "Applied!";
        joinBtn.disabled = true;
      } catch (err) {
        console.error("Failed to join event:", err);
        alert("Failed to join event.");
      }
    });

  } catch (err) {
    console.error("Failed to load event details:", err);
  }
}

export async function initManageEvent() {
  const sid = sessionStorage.getItem("selectedOrgSid");
  if (!sid) { window.location.href = "/viewOrganization"; return; }

  try {
    // Load event details
    const event = await fetchWithAuth(`/api/manage-event/${sid}`, "GET");
    if (!event || event.error) { window.location.href = "/viewOrganization"; return; }

    document.getElementById("event-name").textContent = event.service_name;
    document.getElementById("event-description").textContent = event.info_text || "";
    document.getElementById("event-time").textContent = new Date(event.time_start).toLocaleString();
    document.getElementById("event-hours").textContent = event.estimated_hours;
    document.getElementById("event-volunteers").textContent = event.estimated_volunteers;

    await loadParticipants(sid);

  } catch (err) {
    console.error("Failed to load manage event page:", err);
  }
}

async function loadParticipants(sid) {
  const participants = await fetchWithAuth(`/api/manage-event/${sid}/participants`, "GET");
  const container = document.getElementById("participants-container");

  if (!participants || participants.error || participants.length === 0) {
    container.innerHTML = `<div class="card placeholder"><p>No participants yet.</p></div>`;
    return;
  }

  // Separate approved and pending
  const approved = participants.filter(p => p.status === "accepted");
  const pending = participants.filter(p => p.status === "pending");
  const rejected = participants.filter(p => p.status === "rejected");
  const completed = participants.filter(p => p.status === "completed");

  container.innerHTML = `
    ${approved.length > 0 ? `
      <h3>Approved (${approved.length}):</h3>
      ${approved.map(p => participantCard(p, true)).join("")}
    ` : ""}

    ${pending.length > 0 ? `
      <h3>Pending:</h3>
      ${pending.map(p => participantCard(p, false)).join("")}
    ` : ""}

    ${rejected.length > 0 ? `
      <h3>Rejected:</h3>
      ${rejected.map(p => participantCard(p, false)).join("")}
    ` : ""}

    ${completed.length > 0 ? `
      <h3>Completed:</h3>
      ${completed.map(p => participantCard(p, false, true)).join("")}
    ` : ""}
  `;

  // Attach kick listeners
  container.querySelectorAll(".kick-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to kick this volunteer?")) return;
      try {
        const res = await fetchWithAuth(`/api/manage-event/${sid}/kick/${btn.dataset.uid}`, "PUT");
        if (res.error) { alert(res.error); return; }
        await loadParticipants(sid);
      } catch (err) {
        console.error("Failed to kick participant:", err);
        alert("Failed to kick participant.");
      }
    });
  });

  container.querySelectorAll(".complete-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const hours = prompt("Enter hours completed:");
    if (!hours || isNaN(hours)) {
      alert("Enter a valid number of hours");
      return;
    }

    try {
      const res = await fetchWithAuth("/api/participation/complete", "PUT", {
        uid: btn.dataset.uid,
        sid,
        hours: parseInt(hours)
      });

      if (res.error) {
        alert(res.error);
        return;
      }

      await loadParticipants(sid);
    } catch (err) {
      console.error("Failed to credit participant hours:", err);
      alert("Failed to mark users hours as completed.");
    }
  });
});

}

function participantCard(p, showKick, isCompleted = false) {
  const name = p.first_name
    ? `${p.first_name} ${p.last_name ? p.last_name[0] + "." : ""}`
    : p.display_name;

  return `
    <div class="application-row">
      <span>${name}</span>
      <span>Hours: ${p.hours}</span>
      <span class="app-status status-${p.status}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
      ${showKick ? `
        <button class="kick-btn" data-uid="${p.uid}">Kick</button>
        <button class="complete-btn" data-uid="${p.uid}" data-sid="${p.sid}">Complete</button>` : ""}
      ${isCompleted ? `<span> Hours Credited </span>` : ""}
    </div>
  `;
}


export function initEditGroup(fetchWithAuth,gid) {
  const editBtn = document.getElementById("editGroupBtn");
  const editForm = document.getElementById("editGroupForm");
  const cancelBtn = document.getElementById("cancelEditGroupBtn");

  editBtn.addEventListener("click", () => {
    // Pre-fill with current values
    document.getElementById("editGroupName").value = document.getElementById("group-name").textContent;
    document.getElementById("editGroupIntro").value = document.getElementById("group-description").innerText;
    editForm.style.display = "block";
    editBtn.style.display = "none";
  });

  cancelBtn.addEventListener("click", () => {
    editForm.style.display = "none";
    editBtn.style.display = "block";
  });

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const group_name = document.getElementById("editGroupName").value.trim();
    const intro_text = document.getElementById("editGroupIntro").value.trim();

    if (!group_name) { alert("Group name is required."); return; }

    try {
      const res = await fetchWithAuth("/api/groupUpdate", "PUT", { group_name, intro_text, gid });
      if (res.error) { alert("Error updating group: " + res.error); return; }

      // Update the displayed values
      document.getElementById("group-name").textContent = res.group_name;
      document.getElementById("group-description").innerHTML = `<p>${res.intro_text || ""}</p>`;

      editForm.style.display = "none";
      editBtn.style.display = "block";
      alert("Group Information Saved!");
    } catch (err) {
      console.error("Failed to Update Group:", err);
      alert("Failed to Update Group.");
    }
  });
}


async function uploadToSlotGroup(slotNum,gid){

    const input=document.createElement("input");
    input.type="file";
    input.accept="image/*";

    input.onchange = async ()=>{

        const file=input.files[0];

        if(!file) return;

        try{

            const result = await uploadImage(file,slotNum,gid);
            location.reload();

        }catch(err){

            console.error(err);
            alert("Upload failed");

        }

    };

    input.click();
}

export async function fetchGroup(fetchWithAuth,gid) {

  const permission = (((await fetchWithAuth("/api/baseGroupPermissions", "POST",{gid})).role)=="admin");

  const data = await fetchWithAuth("/api/getGroupData", "POST",{ gid});

  const orgNameEl = document.getElementById("group-name");
  const orgDescEl = document.getElementById("group-description");

  if (data && !data.error) {
    orgNameEl.textContent = data.group_name;
    orgDescEl.innerHTML = `<p>${data.intro_text || ""}</p>`;

    document.querySelectorAll('.tab-vertical-buttons button').forEach(btn => {
      btn.disabled = false;
    });
    initEditGroup(fetchWithAuth,gid);

      let i=1;
      const slot = document.getElementById(`slot${i}`);
      const img = document.getElementById(`image${i}`);

      const link = data[`ilink${i}`];
      const pid = data[`pid${i}`];

      if(link){

          img.src = link;
          img.style.display="block";

          if(permission){

              const del = document.createElement("button");
              del.innerText="Delete";

              del.onclick = async ()=>{
                  await deleteImage(pid,i,gid);

                  location.reload();
              };

              slot.appendChild(del);
          }

      }
      else{

          img.style.display="none";

          if(permission){

              const uploadBtn=document.createElement("button");
              uploadBtn.innerText="Upload Image";

              uploadBtn.onclick = ()=>uploadToSlotGroup(i,gid);

              slot.appendChild(uploadBtn);
          }
      }


  } else {
    orgNameEl.textContent = "Group does not exist";
    orgDescEl.innerHTML = "";
    noOrgSection.style.display = "block";
    document.querySelectorAll('.tab-vertical-buttons button').forEach(btn => {
      if (btn.dataset.tab !== "Profile") btn.disabled = true;
    });
  }
}


async function handleKick(uid,gid) {
    await fetchWithAuth("/api/groupKick", "POST",{uid,gid});
}

async function handlePromote(uid,gid) {
   await fetchWithAuth("/api/groupPromote", "POST",{uid,gid});
}

export async function fetchMembers(fetchWithAuth,gid) {

  const permission = (((await fetchWithAuth("/api/baseGroupPermissions", "POST",{gid})).role)=="admin");
  const data = await fetchWithAuth("/api/getGroupMemberData", "POST",{ gid});

  if (data && !data.error) {
    
    const container = document.getElementById('members-container');

    container.innerHTML = '';

    data.forEach(member => {
        const isAdmin = member.admin === true;
        const roleText = isAdmin ? 'Admin' : 'Member';
        const uid = member.uid;

        // Create the card element
        const card = document.createElement('div');
        card.className = 'card application-card large-card';
        
        // Build the inner HTML
        let actionButtons = '';
        
         //todo clean up
        if (permission && !isAdmin) {
            actionButtons = `
                <button class="kick-btn" data-uid="${uid}">Kick</button>
                <button class="promote-btn" data-uid="${uid}">Promote</button>
            `;
        }
        
        //todo clean up, get hours from services
        card.innerHTML = `
            <div class="member-info">
                <h4>${member.display_name}</h4>
                <p>Role: ${roleText}</p>
                <p>Hours: <span class="member-number" data-uid="${uid}">0</span></p>
                <button class="account-btn" data-uid="${uid}">View Account</button>
                ${actionButtons}
            </div>
        `;

        //Set up Event Listeners
        
        // Account Button Listener
        card.querySelector('.account-btn').addEventListener('click', () => {
            console.log("Accessing UID:", uid);
            //link to user
        });

        // Admin Action Listeners
        if (permission && !isAdmin) {
            card.querySelector('.kick-btn').addEventListener('click', () => {
                handleKick(uid,gid);
            });
            card.querySelector('.promote-btn').addEventListener('click', () => {
                handlePromote(uid,gid);
            });
        }

        // Append to container
        container.appendChild(card);
    });


  } else {
    alert("failed to find members");
  }
}
