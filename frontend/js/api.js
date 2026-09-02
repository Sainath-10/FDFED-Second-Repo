/**
 * Backend API Service
 * Handles all HTTP requests to the Nest.js backend
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
      // Ignore storage errors
    }
  }

  function removeToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (err) {
      // Ignore storage errors
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
      // Ignore storage errors
    }
  }

  function removeUser() {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (err) {
      // Ignore storage errors
    }
  }

  async function makeRequest(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Add token if available
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error(`API Error ${response.status}:`, endpoint, data);
        return {
          ok: false,
          status: response.status,
          error: data.message || data.error || `Request failed (${response.status})`,
          data: data
        };
      }

      return {
        ok: true,
        status: response.status,
        data: data
      };
    } catch (err) {
      console.error('Network error:', err);
      return {
        ok: false,
        error: err.message || 'Network error - is the backend running?',
        data: null
      };
    }
  }

  // ============ AUTH API ============
  const AuthAPI = {
    async register(email, username, password, firstName, lastName, role = 'participant') {
      return makeRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          username,
          password,
          firstName,
          lastName,
          role
        })
      });
    },

    async login(emailOrUsername, password) {
      console.log('AuthAPI.login called with:', { emailOrUsername, password: '***' });

      const result = await makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrUsername,
          password
        })
      });

      console.log('AuthAPI.login response:', result);

      if (result.ok && result.data.access_token) {
        console.log('Setting token and user...');
        setToken(result.data.access_token);
        setUser({
          id: result.data.user?.id,
          email: result.data.user?.email,
          username: result.data.user?.username,
          firstName: result.data.user?.firstName,
          lastName: result.data.user?.lastName,
          role: result.data.user?.role
        });
        console.log('Token and user set successfully');
      } else {
        console.warn('No access token in response:', result);
      }

      return result;
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
    }
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

    async create(name, description, startDate, endDate) {
      return makeRequest('/competitions', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          startDate,
          endDate
        })
      });
    },

    async update(id, data) {
      return makeRequest(`/competitions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },

    async delete(id) {
      return makeRequest(`/competitions/${id}`, {
        method: 'DELETE'
      });
    }
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
          members
        })
      });
    },

    async update(id, data) {
      return makeRequest(`/teams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },

    async addMember(id, memberId) {
      return makeRequest(`/teams/${id}/members`, {
        method: 'POST',
        body: JSON.stringify({ memberId })
      });
    },

    async removeMember(id, memberId) {
      return makeRequest(`/teams/${id}/members/${memberId}`, {
        method: 'DELETE'
      });
    },

    async delete(id) {
      return makeRequest(`/teams/${id}`, {
        method: 'DELETE'
      });
    }
  };

  // ============ DISPUTES API ============
  const DisputesAPI = {
    async getAll() {
      return makeRequest('/disputes', { method: 'GET' });
    },

    async getOpen() {
      return makeRequest('/disputes/open', { method: 'GET' });
    },

    async getEscalated() {
      return makeRequest('/disputes/escalated', { method: 'GET' });
    },

    async getByCompetition(competitionId) {
      return makeRequest(`/disputes/competition/${competitionId}`, { method: 'GET' });
    },

    async getById(id) {
      return makeRequest(`/disputes/${id}`, { method: 'GET' });
    },

    async create(competitionId, teamId, description) {
      return makeRequest('/disputes', {
        method: 'POST',
        body: JSON.stringify({
          competitionId,
          teamId,
          description
        })
      });
    },

    async update(id, status, notes) {
      return makeRequest(`/disputes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          notes
        })
      });
    },

    async delete(id) {
      return makeRequest(`/disputes/${id}`, {
        method: 'DELETE'
      });
    }
  };

  // Export API
  window.NexusAPI = {
    Auth: AuthAPI,
    Competitions: CompetitionsAPI,
    Teams: TeamsAPI,
    Disputes: DisputesAPI,
    getToken,
    setToken,
    removeToken,
    getUser,
    setUser,
    removeUser
  };
})(window);
