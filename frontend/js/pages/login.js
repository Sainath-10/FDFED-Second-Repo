console.log('login.js script loaded');

initPasswordToggles();
initFooter('../');

const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginFeedback = document.getElementById('login-feedback');

const roleRoutes = {
  regular: 'profile.html',
  participant: 'profile.html',
  team_lead: 'team-lead-dashboard.html',
  admin: 'admin/dashboard.html',
  'super-admin': 'super-admin/super-dashboard.html',
  super_admin: 'super-admin/super-dashboard.html',
};

function setFeedback(message, isSuccess) {
  if (!loginFeedback) return;
  loginFeedback.textContent = message || '';
  loginFeedback.classList.toggle('success', !!isSuccess);
}

if (loginForm) {
  loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
      setFeedback('Please enter both username and password.', false);
      return;
    }

    if (!window.NexusAuth || typeof window.NexusAuth.login !== 'function') {
      setFeedback('Authentication service is unavailable.', false);
      return;
    }

    setFeedback('Logging in with JWT...', true);

    const result = await window.NexusAuth.login({
      username: username,
      password: password,
      roleRoutes: roleRoutes,
      fallbackPath: '../index.html',
    });

    if (!result.ok) {
      setFeedback(result.error || 'Login failed. Please check your credentials.', false);
      return;
    }

    setFeedback('Login successful! Redirecting...', true);
  });
}
