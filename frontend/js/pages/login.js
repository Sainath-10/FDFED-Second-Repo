console.log('login.js script loaded');

initPasswordToggles();
initFooter('../');

const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginFeedback = document.getElementById('login-feedback');

console.log('Form elements:', { loginForm, usernameInput, passwordInput, loginFeedback });

const roleRoutes = {
	regular: 'profile.html',
	participant: 'profile.html',
	team_lead: 'team-lead-dashboard.html',
	admin: 'admin/admin-profile.html',
	'super-admin': 'super-admin/profile.html',
	super_admin: 'super-admin/profile.html'
};

function setFeedback(message, isSuccess) {
	if (!loginFeedback) return;
	loginFeedback.textContent = message || '';
	loginFeedback.classList.toggle('success', !!isSuccess);
}

if (loginForm) {
	console.log('Attaching submit event listener to form');
	
	// Also log button clicks
	const submitButton = loginForm.querySelector('button[type="submit"]');
	if (submitButton) {
		console.log('Found submit button:', submitButton);
		submitButton.addEventListener('click', function(e) {
			console.log('SUBMIT BUTTON CLICKED!', e);
		});
	} else {
		console.log('WARNING: Submit button not found!');
	}
	
	loginForm.addEventListener('submit', async function (event) {
		console.log('FORM SUBMITTED!');
		event.preventDefault();

		const username = usernameInput ? usernameInput.value.trim() : '';
		const password = passwordInput ? passwordInput.value : '';

		console.log('Login attempt:', { username, password: '***' });

		if (!username || !password) {
			setFeedback('Please enter both username and password.', false);
			return;
		}

		if (!window.NexusAuth || typeof window.NexusAuth.login !== 'function') {
			setFeedback('Authentication service is unavailable.', false);
			return;
		}

		setFeedback('Logging in...', true);
		
		// Call async login and wait for it
		const result = await window.NexusAuth.login({
			username: username,
			password: password,
			roleRoutes: roleRoutes,
			fallbackPath: '../index.html'
		});

		console.log('Login result:', result);

		if (!result.ok) {
			setFeedback(result.error || 'Login failed. Please try again.', false);
			console.error('Login error:', result.error);
			return;
		}

		setFeedback('Login successful. Redirecting...', true);
	});
}
