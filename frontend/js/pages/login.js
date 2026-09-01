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
	admin: 'admin/dashboard.html',
	comp_admin: 'admin/dashboard.html',
	dispute_admin: 'admin/disputes.html',
	revenue_admin: 'admin/revenue-transactions.html',
	'super-admin': 'super-admin/super-dashboard.html',
	super_admin: 'super-admin/super-dashboard.html'
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

		if (result.revokedReason) {
			const noticeMsg = `⚠️ Notice: Your administrator status was revoked by Super Admin.\nReason: "${result.revokedReason}"\nRedirecting to standard participant dashboard...`;
			setFeedback(noticeMsg, true);
			
			if (loginFeedback) {
				loginFeedback.style.background = 'rgba(234, 179, 8, 0.15)';
				loginFeedback.style.border = '1px solid rgba(234, 179, 8, 0.4)';
				loginFeedback.style.color = '#fde047';
				loginFeedback.style.padding = '12px 16px';
				loginFeedback.style.borderRadius = '8px';
				loginFeedback.style.whiteSpace = 'pre-line';
				loginFeedback.style.fontWeight = '600';
			}

			setTimeout(() => {
				window.location.href = result.redirectPath || 'profile.html';
			}, 4000);
			return;
		}

		setFeedback('Login successful. Redirecting...', true);
	});
}
