/**
 * NEXUS ESPORTS — Backend API Client
 * Full JWT authentication, Role-based headers, and REST endpoints.
 */

(function (window) {
  const API_URL = 'http://localhost:3000';
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
    } catch (err) {
      // Ignore storage error
    }
  }

  function removeToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (err) {
      // Ignore storage error
    }
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function setUser(user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (err) {
      // Ignore storage error
    }
  }

  function removeUser() {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (err) {
      // Ignore storage error
    }
  }

  async function makeRequest(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Attach JWT Bearer Token if logged in
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Also attach x-user-role for role-based routing fallback
    const user = getUser();
    if (user && user.role) {
      headers['x-user-role'] = user.role;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: data.message || data.error || `Request failed with status ${response.status}`,
          data,
        };
      }

      return {
        ok: true,
        status: response.status,
        data,
      };
    } catch (err) {
      console.warn('API connection issue:', err.message);
      return {
        ok: false,
        status: 0,
        error: err.message || 'Network error — ensure backend is running on http://localhost:3000',
        data: null,
      };
    }
  }

  // ============ AUTH API ============
  const AuthAPI = {
    async register(email, username, password, firstName, lastName, role = 'participant', country = '') {
      const result = await makeRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          username,
          password,
          firstName: firstName || username,
          lastName: lastName || '',
          role,
          country: country || undefined,
        }),
      });

      if (result.ok && result.data.access_token) {
        setToken(result.data.access_token);
        if (result.data.user) {
          setUser(result.data.user);
        }
      }
      return result;
    },

    async login(emailOrUsername, password) {
      const result = await makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrUsername,
          password,
        }),
      });

      if (result.ok && result.data.access_token) {
        setToken(result.data.access_token);
        if (result.data.user) {
          setUser(result.data.user);
        }
      }
      return result;
    },

    async getMe() {
      return makeRequest('/auth/me', { method: 'GET' });
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

    async create(name, description, startDate, endDate, coOrganizers = []) {
      return makeRequest('/competitions', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          startDate,
          endDate,
          coOrganizers,
        }),
      });
    },

    async update(id, data) {
      return makeRequest(`/competitions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async delete(id) {
      return makeRequest(`/competitions/${id}`, {
        method: 'DELETE',
      });
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
      return makeRequest('/teams', {
        method: 'POST',
        body: JSON.stringify({
          name,
          competitionId,
          members,
        }),
      });
    },

    async update(id, data) {
      return makeRequest(`/teams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async delete(id) {
      return makeRequest(`/teams/${id}`, {
        method: 'DELETE',
      });
    },
  };

  // ============ DISPUTES API ============
  const DisputesAPI = {
    async getAll(targetType, status) {
      let q = [];
      if (targetType) q.push(`targetType=${encodeURIComponent(targetType)}`);
      if (status) q.push(`status=${encodeURIComponent(status)}`);
      const queryStr = q.length ? `?${q.join('&')}` : '';
      return makeRequest(`/disputes${queryStr}`, { method: 'GET' });
    },

    async getByTargetType(targetType) {
      return makeRequest(`/disputes/target/${targetType}`, { method: 'GET' });
    },

    async getOpen() {
      return makeRequest('/disputes/open', { method: 'GET' });
    },

    async getEscalated() {
      return makeRequest('/disputes/escalated', { method: 'GET' });
    },

    async getById(id) {
      return makeRequest(`/disputes/${id}`, { method: 'GET' });
    },

    async create(competitionId, teamId, targetType, targetId, title, description) {
      return makeRequest('/disputes', {
        method: 'POST',
        body: JSON.stringify({
          competitionId,
          teamId: teamId || undefined,
          targetType: targetType || 'user',
          targetId: targetId || undefined,
          title: title || undefined,
          description,
        }),
      });
    },

    async update(id, status, resolutionNotes) {
      return makeRequest(`/disputes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          resolutionNotes,
        }),
      });
    },

    async delete(id) {
      return makeRequest(`/disputes/${id}`, {
        method: 'DELETE',
      });
    },
  };

  // ============ REVENUE API ============
  const RevenueAPI = {
    async setCompetitionFee(competitionId, entryFee, prizePool, currency = 'INR') {
      return makeRequest(`/revenue/competitions/${competitionId}/fees`, {
        method: 'POST',
        body: JSON.stringify({
          entryFee: Number(entryFee),
          prizePool: Number(prizePool),
          currency,
        }),
      });
    },

    async getCompetitionFee(competitionId) {
      return makeRequest(`/revenue/competitions/${competitionId}/fees`, { method: 'GET' });
    },

    async payPlatformFee(competitionId) {
      return makeRequest(`/revenue/competitions/${competitionId}/pay-platform-fee`, {
        method: 'POST',
      });
    },

    async recordPayment(competitionId, type, amount, teamId = null, description = '') {
      return makeRequest(`/revenue/competitions/${competitionId}/payment`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          amount: Number(amount),
          teamId: teamId || undefined,
          description: description || undefined,
        }),
      });
    },

    async getStats() {
      return makeRequest('/revenue/stats', { method: 'GET' });
    },

    async getTransactions() {
      return makeRequest('/revenue/transactions', { method: 'GET' });
    },
  };

  // ============ ADMIN API ============
  const AdminAPI = {
    async getAllUsers() {
      return makeRequest('/admin/users', { method: 'GET' });
    },

    async createAdmin(email, username, firstName, lastName, role = 'admin') {
      return makeRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email,
          username,
          firstName,
          lastName,
          role,
        }),
      });
    },

    async updateUserRole(id, role) {
      return makeRequest(`/admin/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
    },

    async getStats() {
      return makeRequest('/admin/stats', { method: 'GET' });
    },
  };

  // Export NexusAPI to global scope
  window.NexusAPI = {
    Auth: AuthAPI,
    Competitions: CompetitionsAPI,
    Teams: TeamsAPI,
    Disputes: DisputesAPI,
    Revenue: RevenueAPI,
    Admin: AdminAPI,
    getToken,
    setToken,
    removeToken,
    getUser,
    setUser,
    removeUser,
  };
})(window);
