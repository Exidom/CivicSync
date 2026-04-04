import { fetchWithAuth } from "/js/auth.js";

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

      const profileData = {
        first_name: document.getElementById("firstName").value,
        last_name: document.getElementById("lastName").value,
        phone_number: formattedPhone
      };

      try {
        await fetchWithAuth("/update-profile", "POST", profileData);
        alert("Profile updated!");
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


    const groupSection = document.getElementById("groupSection");
    const noGroupSection = document.getElementById("noGroupSection");
    const groupList = document.getElementById("groupList");

    if (user.hasGroup) {
      groupSection.style.display = "block";
      noGroupSection.style.display = "none";

      groupList.innerHTML = "";
      user.groups.forEach(g => {
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `<h3>${g.group_name}</h3>`;
        groupList.appendChild(div);
      });

    } else {
      groupSection.style.display = "none";
      noGroupSection.style.display = "block";
    }


    const orgSection = document.getElementById("orgSection");
    const noOrgSection = document.getElementById("noOrgSection");

    if (user.hasOrg) {
      orgSection.style.display = "block";
      noOrgSection.style.display = "none";

      document.getElementById("orgName").innerText = user.org.org_name;

    } else if (user.hasGroup) {
      orgSection.style.display = "none";
      noOrgSection.style.display = "block";

    } else {
      orgSection.style.display = "none";
      noOrgSection.style.display = "none";
    }


    const eventSection = document.getElementById("eventSection");
    const noEventSection = document.getElementById("noEventSection");
    const eventList = document.getElementById("eventList");

    if (user.hasEvent) {
      eventSection.style.display = "block";
      noEventSection.style.display = "none";

      eventList.innerHTML = "";
      user.events.forEach (e => {
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `<h3>${e.service_name}</h3>`;
        eventList.appendChild(div);
      });

    } else if (user.hasGroup) {
      eventSection.style.display = "none";
      noEventSection.style.display = "block";

    } else {
      eventSection.style.display = "none";
      noEventSection.style.display = "none";
    }


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

// Combines event signup page functions
export function initEventSignup(){
  loadEventSignup();
  submitEventSignup();
  initJoinGroup();
}

// Determines the event signup page layout depending on group membership
async function loadEventSignup() {
  try {
    const data = await fetchWithAuth("/api/eventsSignupData");

    const eventSection = document.getElementById("eventSignupSection");
    const noGroupSection = document.getElementById("noGroupEventSection");
    const eventList = document.getElementById("eventSignupList");

    if (data.hasGroup) {
      eventSection.style.display = "block";
      noGroupSection.style.display = "none";

      eventList.innerHTML = "";

      data.events.forEach(e => {
        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `<h3>${e.service_name}</h3>
          <button class="joinEventBtn" data-id="${e.sid}">Join Event</button>`;

        eventList.appendChild(div);
      });

    } else {
      eventSection.style.display = "none";
      noGroupSection.style.display = "block";
    }

  } catch (err) {
    console.error("Failed to load event signup page", err);
  }
}

// Handles the process of signing users up for events
function submitEventSignup() {
  document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("joinEventBtn")) return;

    const sid = e.target.dataset.id;

    const confirmJoin = confirm("Join this event?");
    if (!confirmJoin) return;

    try {
      await fetchWithAuth("/api/join-event", "POST", { sid });
      alert("Joined event!");
    } catch (err) {
      console.error("SUBMIT SIGNUP ERROR ", err);
      alert("Failed to join event");
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
  } else {
    orgNameEl.textContent = "You are not in an Organization";
    orgDescEl.innerHTML = "";
    noOrgSection.style.display = "block";
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
    container.innerHTML = `<div class="card placeholder"><p>No events yet.</p></div>`;
    return;
  }

  container.innerHTML = events.map(event => `
    <div class="card" data-sid="${event.sid}">
      <div class="event-view">
        <h3>${event.service_name}</h3>
        <p>${new Date(event.time_start).toLocaleString()}</p>
        <p>${event.info_text || ""}</p>
        <p>Volunteers Needed: ${event.estimated_volunteers} &nbsp;|&nbsp; Hours: ${event.estimated_hours}</p>
        <p>${event.visibility_public ? "Public" : "Private"} &nbsp;|&nbsp; Applications: ${event.applications_open ? "Open" : "Closed"}</p>
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
    const card = document.querySelector(`.card[data-sid="${sid}"]`);

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
      if (!confirm("Are you sure you want to delete this event?")) return;

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
