document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  
  // Authentication elements
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const userIcon = document.getElementById("user-icon");
  const usernameDisplay = document.getElementById("username-display");
  const logoutBtn = document.getElementById("logout-btn");
  const closeModal = document.querySelector(".close");
  const teacherControls = document.getElementById("teacher-controls");
  const studentView = document.getElementById("student-view");
  const loginMessage = document.getElementById("login-message");
  
  let authToken = localStorage.getItem("authToken");
  let isAuthenticated = false;
  
  // Check authentication status on page load
  checkAuthStatus();
  
  // Authentication event listeners
  userIcon.addEventListener("click", () => {
    if (!isAuthenticated) {
      loginModal.classList.remove("hidden");
    }
  });
  
  closeModal.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    clearLoginForm();
  });
  
  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
      clearLoginForm();
    }
  });
  
  logoutBtn.addEventListener("click", logout);
  
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    await login(username, password);
  });
  
  // Authentication functions
  async function checkAuthStatus() {
    if (!authToken) {
      setStudentMode();
      return;
    }
    
    try {
      const response = await fetch("/auth/status", {
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setTeacherMode(data.username);
        } else {
          setStudentMode();
        }
      } else {
        localStorage.removeItem("authToken");
        authToken = null;
        setStudentMode();
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      setStudentMode();
    }
  }
  
  async function login(username, password) {
    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);
      
      const response = await fetch("/login", {
        method: "POST",
        body: formData
      });
      
      const data = await response.json();
      
      if (response.ok) {
        authToken = data.access_token;
        localStorage.setItem("authToken", authToken);
        loginModal.classList.add("hidden");
        clearLoginForm();
        setTeacherMode(data.username);
        showMessage("Logged in successfully!", "success");
      } else {
        showLoginMessage(data.detail || "Login failed", "error");
      }
    } catch (error) {
      showLoginMessage("Login failed. Please try again.", "error");
      console.error("Login error:", error);
    }
  }
  
  async function logout() {
    try {
      await fetch("/logout", { method: "POST" });
      localStorage.removeItem("authToken");
      authToken = null;
      setStudentMode();
      showMessage("Logged out successfully!", "info");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }
  
  function setTeacherMode(username) {
    isAuthenticated = true;
    userIcon.style.display = "none";
    usernameDisplay.textContent = `Teacher: ${username}`;
    usernameDisplay.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    teacherControls.classList.remove("hidden");
    studentView.classList.add("hidden");
    document.body.classList.remove("student-mode");
    document.body.classList.add("teacher-mode");
  }
  
  function setStudentMode() {
    isAuthenticated = false;
    userIcon.style.display = "block";
    usernameDisplay.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    teacherControls.classList.add("hidden");
    studentView.classList.remove("hidden");
    document.body.classList.remove("teacher-mode");
    document.body.classList.add("student-mode");
  }
  
  function clearLoginForm() {
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    loginMessage.classList.add("hidden");
  }
  
  function showLoginMessage(message, type) {
    loginMessage.textContent = message;
    loginMessage.className = type;
    loginMessage.classList.remove("hidden");
  }
  
  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // Create participants HTML with delete icons for teachers only
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons (only works for teachers)
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality (teachers only)
  async function handleUnregister(event) {
    if (!isAuthenticated) {
      showMessage("Only teachers can unregister students.", "error");
      return;
    }
    
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities(); // Refresh activities list
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission (teachers only)
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    if (!isAuthenticated) {
      showMessage("Only teachers can register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities(); // Refresh activities list
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });
  
  function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    // Hide message after 5 seconds
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  // Initialize app
  fetchActivities();
});
