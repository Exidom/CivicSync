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

// Creates Groups
// document.addEventListener("DOMContentLoaded", () => {

//   const form = document.getElementById("createGroupForm");
//   const statusDiv = document.getElementById("status");

//   if (!form) return;

//   form.addEventListener("submit", async (e) => {
//     e.preventDefault();

//     const groupData = {
//       group_name: document.getElementById("group_name").value,
//       intro_text: document.getElementById("intro_text").value
//     };

//     try {
//       // Use fetchWithAuth to get Firebase token
//       const data = await fetchWithAuth("/api/groups", "POST", groupData);

//       if (data) {
//         statusDiv.innerText = "✅ Group created successfully!";
//         form.reset();
//         console.log("Created group:", data);
//       } else {
//         statusDiv.innerText = "❌ Failed to create group. Try again.";
//       }

//     } catch (err) {
//       console.error(err);
//       statusDiv.innerText = "❌ Failed to create group. " + err.message;
//     }
//   });

// });