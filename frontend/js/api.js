/**
 * Backend API Service
 * Handles all HTTP requests to the Nest.js backend + PostgreSQL DB
 */

(function (window) {
  const API_URL = 'http://localhost:3001';
  const TOKEN_KEY = 'nexus.auth.token';
  const USER_KEY = 'nexus.auth.user';

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (err) {
      return null;
    }
  }

  function setToken(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (err) {}
  }

  function removeToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (err) {}
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function getLegacySession() {
    try {
      const raw = localStorage.getItem('nexus.auth.session');
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function normalizeRole(role) {
    const value = String(role || '').trim().toLowerCase();
    if (value === 'super-admin') return 'super_admin';
    if (value === 'teamlead' || value === 'team-lead') return 'team_lead';
    if (value === 'organizer') return 'team_lead';
    return value;
  }

  function setUser(user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (err) {}
  }

  function removeUser() {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (err) {}
  }

  async function makeRequest(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add JWT bearer token & role header if available
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const user = getUser() || getLegacySession();
    if (user && user.role && !config.headers['x-user-role']) {
      config.headers['x-user-role'] = normalizeRole(user.role);
    }
    if (user && user.username && !config.headers['x-user-name']) {
      config.headers['x-user-name'] = user.username;
    }
    if (user && user.id && !config.headers['x-user-id']) {
      config.headers['x-user-id'] = user.id;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: data.message || data.error || `Request failed (${response.status})`,
          data: data,
        };
      }

      return {
        ok: true,
        status: response.status,
        data: data,
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message || 'Network error — is the backend running?',
        data: null,
      };
    }
  }

  // ============ AUTH API ============
  const AuthAPI = {
    async register(email, username, password, role = 'participant') {
      return makeRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password, role }),
      });
    },

    async login(emailOrUsername, password) {
      const result = await makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrUsername, password }),
      });

      if (result.ok && result.data.access_token) {
        setToken(result.data.access_token);
        setUser(result.data.user);
      }

      return result;
    },

    async getMe() {
      return makeRequest('/auth/me', { method: 'GET' });
    },

    async getAllUsers() {
      return makeRequest('/auth/users', { method: 'GET' });
    },

    async banUser(idOrUsername) {
      return makeRequest(`/auth/users/${idOrUsername}/ban`, { method: 'PATCH' });
    },

    async warnUser(idOrUsername) {
      return makeRequest(`/auth/users/${idOrUsername}/warn`, { method: 'PATCH' });
    },

    async updateProfile(updates) {
      return makeRequest('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async changePassword(currentPassword, newPassword) {
      return makeRequest('/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },

    logout() {
      removeToken();
      removeUser();
    },

    getCurrentUser() {
      return getUser();
    },

    isAuthenticated() {
      return !!getToken() && !!getUser();
    },
  };

  // ============ COMPETITIONS API ============
  const CompetitionsAPI = {
    async getAll() {
      return makeRequest('/competitions', { method: 'GET' });
    },

    async getActive() {
      return makeRequest('/competitions/active', { method: 'GET' });
    },

    async getById(id) {
      return makeRequest(`/competitions/${id}`, { method: 'GET' });
    },

    async getByOrganizer(organizerId) {
      return makeRequest(`/competitions/organizer/${organizerId}`, { method: 'GET' });
    },

    async create(name, description, startDate, endDate, coOrganizers = []) {
      const payload = typeof name === 'object' && name !== null
        ? name
        : { name, description, startDate, endDate, coOrganizers };

      return makeRequest('/competitions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async update(id, data) {
      return makeRequest(`/competitions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async setApproval(id, decision) {
      return makeRequest(`/competitions/${id}/approval`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
    },

    async addCoOrganizer(id, organizerId) {
      return makeRequest(`/competitions/${id}/organizers`, {
        method: 'POST',
        body: JSON.stringify({ organizerId }),
      });
    },

    async removeCoOrganizer(id, organizerId) {
      return makeRequest(`/competitions/${id}/organizers/${organizerId}`, {
        method: 'DELETE',
      });
    },

    async delete(id) {
      return makeRequest(`/competitions/${id}`, { method: 'DELETE' });
    },
  };

  // ============ TEAMS API ============
  const TeamsAPI = {
    async getAll() {
      return makeRequest('/teams', { method: 'GET' });
    },

    async getByCompetition(competitionId) {
      return makeRequest(`/teams/competition/${competitionId}`, { method: 'GET' });
    },

    async getById(id) {
      return makeRequest(`/teams/${id}`, { method: 'GET' });
    },

    async create(name, competitionId, members = []) {
      const payload = typeof name === 'object' && name !== null
        ? name
        : { name, competitionId, members };

      return makeRequest('/teams', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async update(id, data) {
      return makeRequest(`/teams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async setStatus(id, status) {
      return makeRequest(`/teams/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },

    async addMember(id, memberId) {
      return makeRequest(`/teams/${id}/members`, {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      });
    },

    async removeMember(id, memberId) {
      return makeRequest(`/teams/${id}/members/${memberId}`, {
        method: 'DELETE',
      });
    },

    async addWarning(id) {
      return makeRequest(`/teams/${id}/warnings`, { method: 'POST' });
    },

    async banTeam(id) {
      return makeRequest(`/teams/${id}/ban`, { method: 'PATCH' });
    },

    async createJoinRequest(teamId, competitionId, fromUsername, message) {
      return makeRequest(`/teams/${teamId}/join-requests`, {
        method: 'POST',
        body: JSON.stringify({ competitionId, fromUsername, message }),
      });
    },

    async getJoinRequests(teamId) {
      return makeRequest(`/teams/${teamId}/join-requests`, { method: 'GET' });
    },

    async updateJoinRequest(reqId, status, reviewedBy) {
      return makeRequest(`/teams/join-requests/${reqId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewedBy }),
      });
    },

    async createInvite(teamId, competitionId, toUsername, fromUsername) {
      return makeRequest(`/teams/${teamId}/invites`, {
        method: 'POST',
        body: JSON.stringify({ competitionId, toUsername, fromUsername }),
      });
    },

    async getInvites(username) {
      return makeRequest(`/teams/invites/${username}`, { method: 'GET' });
    },

    async updateInvite(inviteId, status) {
      return makeRequest(`/teams/invites/${inviteId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },

    async delete(id) {
      return makeRequest(`/teams/${id}`, { method: 'DELETE' });
    },
  };

  // ============ DISPUTES API ============
  const DisputesAPI = {
    async getAll() {
      return makeRequest('/disputes', { method: 'GET' });
    },

    async getOrganizerQueue() {
      return makeRequest('/disputes/organizer-queue', { method: 'GET' });
    },

    async getAdminQueue() {
      return makeRequest('/disputes/admin-queue', { method: 'GET' });
    },

    async getByCompetition(competitionId) {
      return makeRequest(`/disputes/competition/${competitionId}`, { method: 'GET' });
    },

    async getById(id) {
      return makeRequest(`/disputes/${id}`, { method: 'GET' });
    },

    async create(payload) {
      return makeRequest('/disputes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async organizerReview(id, action, notes, requestBan = false) {
      return makeRequest(`/disputes/${id}/organizer-review`, {
        method: 'PATCH',
        body: JSON.stringify({ action, notes, requestBan }),
      });
    },

    async adminResolve(id, action, resolutionNotes, targetUsernameToBan) {
      return makeRequest(`/disputes/${id}/admin-resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ action, resolutionNotes, targetUsernameToBan }),
      });
    },

    async delete(id) {
      return makeRequest(`/disputes/${id}`, { method: 'DELETE' });
    },
  };

  // ============ NOTIFICATIONS API ============
  const NotificationsAPI = {
    async create(toUsername, title, body = '', type = 'system', status = 'pending', meta = {}) {
      return makeRequest('/notifications', {
        method: 'POST',
        body: JSON.stringify({ toUsername, title, body, type, status, meta }),
      });
    },

    async getForUser(username) {
      return makeRequest(`/notifications/${username}`, { method: 'GET' });
    },

    async getUnreadCount(username) {
      return makeRequest(`/notifications/${username}/unread-count`, { method: 'GET' });
    },

    async markRead(id) {
      return makeRequest(`/notifications/${id}/read`, { method: 'PATCH' });
    },

    async markAllRead(username) {
      return makeRequest(`/notifications/read-all/${username}`, { method: 'PATCH' });
    },

    async delete(id) {
      return makeRequest(`/notifications/${id}`, { method: 'DELETE' });
    },
  };

  // ============ POLICIES API ============
  const PoliciesAPI = {
    async getAll(activeOnly = false) {
      return makeRequest(`/policies${activeOnly ? '?active=true' : ''}`, { method: 'GET' });
    },

    async getById(id) {
      return makeRequest(`/policies/${id}`, { method: 'GET' });
    },

    async create(title, content, category, version, createdBy, compliance) {
      return makeRequest('/policies', {
        method: 'POST',
        body: JSON.stringify({ title, content, category, version, createdBy, compliance }),
      });
    },

    async update(id, updates) {
      return makeRequest(`/policies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async archive(id) {
      return makeRequest(`/policies/${id}/archive`, { method: 'PATCH' });
    },

    async delete(id) {
      return makeRequest(`/policies/${id}`, { method: 'DELETE' });
    },
  };

  // ============ MATCHES API ============
  const MatchesAPI = {
    async getByCompetition(competitionId) {
      return makeRequest(`/matches/competition/${competitionId}`, { method: 'GET' });
    },

    async getById(id) {
      return makeRequest(`/matches/${id}`, { method: 'GET' });
    },

    async create(competitionId, team1Id, team2Id, team1Name, team2Name, scheduledAt, round, notes) {
      return makeRequest('/matches', {
        method: 'POST',
        body: JSON.stringify({ competitionId, team1Id, team2Id, team1Name, team2Name, scheduledAt, round, notes }),
      });
    },

    async update(id, updates) {
      return makeRequest(`/matches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async recordResult(id, winnerId, winnerName, score) {
      return makeRequest(`/matches/${id}/result`, {
        method: 'PATCH',
        body: JSON.stringify({ winnerId, winnerName, score }),
      });
    },

    async delete(id) {
      return makeRequest(`/matches/${id}`, { method: 'DELETE' });
    },
  };

  // ============ ADMIN API ============
  const AdminAPI = {
    async getStats() {
      return makeRequest('/admin/stats', { method: 'GET' });
    },
    async getActivity(adminUsername) {
      const q = adminUsername ? `?adminUsername=${encodeURIComponent(adminUsername)}` : '';
      return makeRequest(`/admin/activity${q}`, { method: 'GET' });
    },
    async logActivity(adminUsername, actionType, details, metadata) {
      return makeRequest('/admin/activity', {
        method: 'POST',
        body: JSON.stringify({ adminUsername, actionType, details, metadata }),
      });
    },
  };

  // Export API
  window.NexusAPI = {
    Auth: AuthAPI,
    Competitions: CompetitionsAPI,
    Teams: TeamsAPI,
    Disputes: DisputesAPI,
    Notifications: NotificationsAPI,
    Policies: PoliciesAPI,
    Matches: MatchesAPI,
    Admin: AdminAPI,
    getToken,
    setToken,
    removeToken,
    getUser,
    setUser,
    removeUser,
  };
})(window);
