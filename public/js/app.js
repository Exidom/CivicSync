const API_URL = "http://localhost:5000"; // adjust if needed

// Load Services
async function loadServices() {
  const res = await fetch(`${API_URL}/services`);
  const services = await res.json();

  const content = document.getElementById("content");
  content.innerHTML = "<h2>Services</h2>";

  services.forEach(service => {
    content.innerHTML += `
      <div class="card">
        <h3>${service.title}</h3>
        <p>${service.description}</p>
        <p>Hours: ${service.expected_hours}</p>
        <button onclick="apply(${service.id})">Apply</button>
      </div>
    `;
  });
}

// Apply to service
async function apply(serviceId) {
  await fetch(`${API_URL}/services/${serviceId}/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Add auth token later
    }
  });

  alert("Applied!");
}

// Load Groups
async function loadGroups() {
  const res = await fetch(`${API_URL}/groups`);
  const groups = await res.json();

  const content = document.getElementById("content");
  content.innerHTML = "<h2>Groups</h2>";

  groups.forEach(group => {
    content.innerHTML += `
      <div class="card">
        <h3>${group.name}</h3>
        <p>Goal Hours: ${group.goal_hours}</p>
      </div>
    `;
  });
}

// Load Profile
function loadProfile() {
  const content = document.getElementById("content");

  content.innerHTML = `
    <h2>Profile</h2>
    <p>Coming soon...</p>
  `;
}