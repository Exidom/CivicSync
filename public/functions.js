

// Create Groups Function
document.addEventListener("DOMContentLoaded", () => {

  const form = document.getElementById("createGroupForm");
  const statusDiv = document.getElementById("status");

  // Safety check (prevents errors if element missing)
  if (!form) {
    console.error("Form not found: createGroupForm");
    return;
  }

  // Handle form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Show loading state
    statusDiv.innerText = "⏳ Creating group...";

    // Collect form data
    const groupData = {
      group_name: document.getElementById("group_name").value.trim(),
      intro_text: document.getElementById("intro_text").value.trim(),
      ilink1: document.getElementById("ilink1").value.trim(),
      ilink2: document.getElementById("ilink2").value.trim(),
      ilink3: document.getElementById("ilink3").value.trim()
    };

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(groupData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unknown error");
      }

      // Success
      statusDiv.innerText = "✅ Group created successfully!";
      console.log("Created group:", data);

      // Reset form
      form.reset();

    } catch (err) {
      console.error("Error creating group:", err);

      // Show error message
      statusDiv.innerText = "❌ Failed to create group. Please try again.";f
    }
  });

});