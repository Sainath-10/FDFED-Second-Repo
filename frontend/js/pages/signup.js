initPasswordToggles();
initFooter('../');

const roleRoutes = {
  regular: 'profile.html',
  participant: 'profile.html',
  team_lead: 'team-lead-dashboard.html',
  admin: 'admin/admin-profile.html',
  'super-admin': 'super-admin/profile.html',
  super_admin: 'super-admin/profile.html'
};

const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('username')?.value.trim() || '';
    const email = document.getElementById('email')?.value.trim() || '';
    const pwd = document.getElementById('password')?.value || '';
    const conf = document.getElementById('confirm-password')?.value || '';

    if (!username || !email || !pwd || !conf) {
      if (typeof showToast === 'function') {
        showToast('Please fill all required fields.', 'error');
      }
      return;
    }

    // Email syntax validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      if (typeof showToast === 'function') {
        showToast('Please enter a valid email address (e.g. name@example.com).', 'error');
      }
      // Highlight the field
      const emailField = document.getElementById('email');
      if (emailField) { emailField.focus(); emailField.select(); }
      return;
    }

    if (pwd !== conf) {
      if (typeof showToast === 'function') {
        showToast('Passwords do not match!', 'error');
      }
      return;
    }

    if (!window.NexusAuth || typeof window.NexusAuth.createAccount !== 'function') {
      if (typeof showToast === 'function') {
        showToast('Signup service is unavailable.', 'error');
      }
      return;
    }

    const result = await window.NexusAuth.createAccount({
      username: username,
      email: email,
      password: pwd,
      displayName: username,
      role: 'participant'
    });

    if (!result.ok) {
      if (typeof showToast === 'function') {
        showToast(result.error || 'Unable to create account.', 'error');
      }
      return;
    }
    
    if (typeof showToast === 'function') {
      showToast('Account created successfully! Logging you in...');
    }

    const loginResult = await window.NexusAuth.login({
      username: username,
      password: pwd,
      roleRoutes: roleRoutes,
      fallbackPath: 'profile.html'
    });

    if (!loginResult.ok) {
      if (typeof showToast === 'function') {
        showToast(loginResult.error || 'Signup succeeded but login failed. Please log in.', 'error');
      }
      window.location.href = 'login.html';
      return;
    }
  });
}
