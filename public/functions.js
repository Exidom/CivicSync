import { fetchWithAuth } from "/js/auth.js";

// Creates Groups
document.addEventListener("DOMContentLoaded", () => {

  const form = document.getElementById("createGroupForm");
  const statusDiv = document.getElementById("status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const groupData = {
      group_name: document.getElementById("group_name").value,
      intro_text: document.getElementById("intro_text").value,
      ilink1: document.getElementById("ilink1").value,
      ilink2: document.getElementById("ilink2").value,
      ilink3: document.getElementById("ilink3").value
    };

    try {
      // Use fetchWithAuth to get Firebase token
      const data = await fetchWithAuth("/api/groups", "POST", groupData);

      if (data) {
        statusDiv.innerText = "✅ Group created successfully!";
        form.reset();
        console.log("Created group:", data);
      } else {
        statusDiv.innerText = "❌ Failed to create group. Try again.";
      }

    } catch (err) {
      console.error(err);
      statusDiv.innerText = "❌ Failed to create group. " + err.message;
    }
  });

});