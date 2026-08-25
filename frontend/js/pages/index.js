initSidebar('home', './');
initFooter('./');
if (typeof updateLandingHeader === 'function') updateLandingHeader();

const AUTH_SESSION_KEY = 'nexus.auth.session';

function getActiveSession() {
  if (window.NexusAuth && typeof window.NexusAuth.getSession === 'function') {
    return window.NexusAuth.getSession();
  }
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.username || !parsed.role) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

function syncHomeAuthButtons() {
  const actionsWrap = document.querySelector('.hero-topbar-actions');
  if (actionsWrap) {
    actionsWrap.style.display = !!getActiveSession() ? 'none' : 'flex';
  }
  const session = getActiveSession();
  const joinDest = session ? 'pages/competitions.html' : 'pages/signup.html';
  const heroJoin = document.getElementById('hero-join-btn');
  if (heroJoin) heroJoin.setAttribute('href', joinDest);
  const ctaJoin = document.getElementById('cta-join-btn');
  if (ctaJoin) ctaJoin.setAttribute('href', joinDest);
}

syncHomeAuthButtons();

window.addEventListener('storage', function(event) {
  if (event.key === AUTH_SESSION_KEY) syncHomeAuthButtons();
});

// Fix footer paths for root-level page
setTimeout(function() {
  document.querySelectorAll('.site-footer img').forEach(function(img) {
    if (img.src.includes('../assets/')) img.src = img.src.replace('../assets/', 'assets/');
  });
  document.querySelectorAll('.site-footer a').forEach(function(a) {
    const h = a.getAttribute('href');
    if (h && h.startsWith('../')) a.setAttribute('href', h.replace('../', ''));
  });
}, 50);

// ─── Seed showcase competitions into localStorage ──────────────────────────
(function seedShowcase() {
  const KEY = 'nexus_competitions';
  const SHOWCASE = [
    {
      id: 'world-championship-2026',
      name: 'World Championship 2026',
      game: 'Counter-Strike 2',
      type: 'tournament',
      status: 'upcoming',
      dates: 'Aug 15 - Sep 2, 2026',
      location: 'Mumbai, India',
      prizePool: '\u20B910,00,000',
      maxTeams: 32,
      img: '../assets/b890c61489a080992ad7e99adabb1145e6d59606.png',
      badge: 'Featured', badgeClass: 'featured',
      description: 'The biggest Counter-Strike 2 tournament of the year. 32 of the best teams from across India compete for the ultimate crown and a prize pool of \u20B910,00,000.',
      entryFee: '\u20B92,000 per team',
      registrationDates: { open: 'Jul 1, 2026', close: 'Aug 10, 2026' },
      rules: 'All participants must be 16 years or older.\nTeams must have 5 players and 1 substitute.\nFormat: Single Elimination.\nMax 32 teams.\nEntry fee: \u20B92,000 per team.',
      approvalStatus: 'approved', organizerId: 'system', createdBy: 'system',
      totalMatches: 31, matchesCompleted: 0,
      teams: [
        { id: 't1', name: 'Team Nexus', avatar: 'N', players: 5, status: 'approved', createdBy: 'nexus_captain', members: [{ username: 'nexus_captain', role: 'captain' }], invites: [], joinRequests: [] },
        { id: 't2', name: 'Storm Riders', avatar: 'S', players: 5, status: 'approved', createdBy: 'storm_lead', members: [{ username: 'storm_lead', role: 'captain' }], invites: [], joinRequests: [] },
        { id: 't3', name: 'Phoenix Guard', avatar: 'P', players: 5, status: 'approved', createdBy: 'phoenix_lead', members: [{ username: 'phoenix_lead', role: 'captain' }], invites: [], joinRequests: [] },
        { id: 't4', name: 'Shadow Wolves', avatar: 'W', players: 5, status: 'pending', createdBy: 'shadow_lead', members: [{ username: 'shadow_lead', role: 'captain' }], invites: [], joinRequests: [] }
      ],
      standings: [], matches: [], disputes: [], createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'spring-split-finals',
      name: 'Spring Split Finals',
      game: 'League of Legends',
      type: 'league',
      status: 'ongoing',
      dates: 'May 1 - Jul 22, 2026',
      location: 'Online',
      prizePool: '\u20B98,50,000',
      maxTeams: 24,
      img: '../assets/7b04655f1d50a8b1b25ad53f36d80ff99cb3184e.png',
      badge: 'Live', badgeClass: 'live',
      description: 'The Spring Split Finals brings together the top 24 League of Legends teams for an intense round-robin league followed by playoffs. Watch live matches every weekend!',
      entryFee: 'Free',
      registrationDates: { open: 'Apr 1, 2026', close: 'Apr 28, 2026' },
      rules: 'Platinum rank or above required.\nTeams must have 5 players.\nFormat: Round Robin + Playoffs.\nEntry fee: Free.\nMax 24 teams.',
      approvalStatus: 'approved', organizerId: 'system', createdBy: 'system',
      totalMatches: 72, matchesCompleted: 44,
      teams: [
        { id: 't1', name: 'Apex Legends', avatar: 'A', players: 5, status: 'approved', createdBy: 'apex_lead', members: [{ username: 'apex_lead', role: 'captain' }], invites: [], joinRequests: [] },
        { id: 't2', name: 'Night Owls', avatar: 'N', players: 5, status: 'approved', createdBy: 'owl_lead', members: [{ username: 'owl_lead', role: 'captain' }], invites: [], joinRequests: [] },
        { id: 't3', name: 'Digital Hawks', avatar: 'D', players: 5, status: 'approved', createdBy: 'hawk_lead', members: [{ username: 'hawk_lead', role: 'captain' }], invites: [], joinRequests: [] },
        { id: 't4', name: 'Cyber Titans', avatar: 'C', players: 5, status: 'approved', createdBy: 'titan_lead', members: [{ username: 'titan_lead', role: 'captain' }], invites: [], joinRequests: [] },
        { id: 't5', name: 'Iron Wolves', avatar: 'I', players: 5, status: 'approved', createdBy: 'iron_lead', members: [{ username: 'iron_lead', role: 'captain' }], invites: [], joinRequests: [] }
      ],
      standings: [
        { rank: 1, team: 'Apex Legends', mp: 12, w: 9, l: 2, d: 1, points: 28 },
        { rank: 2, team: 'Night Owls', mp: 12, w: 8, l: 3, d: 1, points: 25 },
        { rank: 3, team: 'Digital Hawks', mp: 12, w: 7, l: 4, d: 1, points: 22 },
        { rank: 4, team: 'Cyber Titans', mp: 12, w: 5, l: 6, d: 1, points: 16 },
        { rank: 5, team: 'Iron Wolves', mp: 12, w: 2, l: 9, d: 1, points: 7 }
      ],
      matches: [
        { id: 'm1', round: 'Week 1', team1: 'Apex Legends', team2: 'Night Owls', status: 'completed', score1: 2, score2: 1, date: 'May 3, 2026', time: '6:00 PM' },
        { id: 'm2', round: 'Week 2', team1: 'Digital Hawks', team2: 'Cyber Titans', status: 'completed', score1: 2, score2: 0, date: 'May 10, 2026', time: '6:00 PM' },
        { id: 'm3', round: 'Week 3', team1: 'Apex Legends', team2: 'Iron Wolves', status: 'live', score1: 1, score2: 0, date: 'May 17, 2026', time: '6:00 PM' },
        { id: 'm4', round: 'Week 4', team1: 'Night Owls', team2: 'Digital Hawks', status: 'scheduled', score1: 0, score2: 0, date: 'May 24, 2026', time: '6:00 PM' }
      ],
      disputes: [], createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'champions-league',
      name: 'Champions League',
      game: 'DOTA 2',
      type: 'tournament',
      status: 'upcoming',
      dates: 'Sep 10 - Oct 5, 2026',
      location: 'Hyderabad, India',
      prizePool: '\u20B912,00,000',
      maxTeams: 16,
      img: '../assets/0e6f51d89fed056f96d58f2c51d79eb797ccdf75.png',
      badge: 'Hot', badgeClass: 'hot',
      description: 'The Champions League is a Double Elimination DOTA 2 tournament with \u20B912,00,000 in prize money. Only the best 16 teams qualify. Registration is now open!',
      entryFee: '\u20B93,000 per team',
      registrationDates: { open: 'Aug 1, 2026', close: 'Sep 5, 2026' },
      rules: 'Teams must have 5 players and 2 substitutes.\nFormat: Double Elimination.\nMax 16 teams.\nEntry fee: \u20B93,000 per team.\nAll players must be 18+.',
      approvalStatus: 'approved', organizerId: 'system', createdBy: 'system',
      totalMatches: 30, matchesCompleted: 0,
      teams: [
        { id: 't1', name: 'Thunder Strike', avatar: 'T', players: 5, status: 'approved', createdBy: 'thunder_lead', members: [{ username: 'thunder_lead', role: 'captain' }], invites: [], joinRequests: [] },
        { id: 't2', name: 'Nova Force', avatar: 'N', players: 5, status: 'approved', createdBy: 'nova_lead', members: [{ username: 'nova_lead', role: 'captain' }], invites: [], joinRequests: [] },
        { id: 't3', name: 'Blaze Unit', avatar: 'B', players: 5, status: 'pending', createdBy: 'blaze_lead', members: [{ username: 'blaze_lead', role: 'captain' }], invites: [], joinRequests: [] }
      ],
      standings: [], matches: [], disputes: [], createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'battle-royale-masters',
      name: 'Battle Royale Masters',
      game: 'Fortnite',
      type: 'tournament',
      status: 'upcoming',
      dates: 'Jun 30 - Jul 10, 2026',
      location: 'Online',
      prizePool: '\u20B915,00,000',
      maxTeams: 100,
      img: '../assets/95bc0921c86340a2cee9e0a2d7ecd20b15a26143.png',
      badge: 'New', badgeClass: 'featured',
      description: 'The biggest Fortnite tournament in India! 100 players compete in multiple rounds for a share of \u20B915,00,000. Points awarded for placement and eliminations.',
      entryFee: '\u20B9500 per player',
      registrationDates: { open: 'May 15, 2026', close: 'Jun 25, 2026' },
      rules: 'Solo players only.\nEntry fee: \u20B9500.\nPoints: 10 per elimination + placement.\nTop 3 rounds count.\nMax 100 players.',
      approvalStatus: 'approved', organizerId: 'system', createdBy: 'system',
      totalMatches: 3, matchesCompleted: 0,
      teams: [
        { id: 't1', name: 'ProSniper_99', avatar: 'P', players: 1, status: 'approved', createdBy: 'ProSniper_99', members: [{ username: 'ProSniper_99', role: 'captain' }], invites: [], joinRequests: [] },
        { id: 't2', name: 'GhostViper', avatar: 'G', players: 1, status: 'approved', createdBy: 'GhostViper', members: [{ username: 'GhostViper', role: 'captain' }], invites: [], joinRequests: [] }
      ],
      standings: [], matches: [], disputes: [], createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'pro-league-season-5',
      name: 'Pro League Season 5',
      game: 'Overwatch 2',
      type: 'league',
      status: 'upcoming',
      dates: 'Jul 5 - Aug 25, 2026',
      location: 'Online',
      prizePool: '\u20B96,00,000',
      maxTeams: 20,
      img: '../assets/fad13be991fc17a28771191ca710b201fb3ee4fb.png',
      badge: 'Featured', badgeClass: 'featured',
      description: 'Season 5 of the Nexus Overwatch 2 Pro League. 20 teams battle in a round-robin format with playoffs for the top 8. Registration is open now!',
      entryFee: '\u20B91,500 per team',
      registrationDates: { open: 'Jun 1, 2026', close: 'Jun 30, 2026' },
      rules: 'Teams must have 6 players.\nFormat: Round Robin, top 8 to playoffs.\nMax 20 teams.\nEntry fee: \u20B91,500 per team.',
      approvalStatus: 'approved', organizerId: 'system', createdBy: 'system',
      totalMatches: 60, matchesCompleted: 0,
      teams: [
        { id: 't1', name: 'Overwatch Elite', avatar: 'O', players: 6, status: 'approved', createdBy: 'ow_elite_lead', members: [{ username: 'ow_elite_lead', role: 'captain' }], invites: [], joinRequests: [] },
        { id: 't2', name: 'Sentinel Force', avatar: 'S', players: 6, status: 'approved', createdBy: 'sentinel_lead', members: [{ username: 'sentinel_lead', role: 'captain' }], invites: [], joinRequests: [] }
      ],
      standings: [], matches: [], disputes: [], createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'rocket-championship',
      name: 'Rocket Championship',
      game: 'Rocket League',
      type: 'tournament',
      status: 'upcoming',
      dates: 'Aug 20 - Sep 1, 2026',
      location: 'Online',
      prizePool: '\u20B95,00,000',
      maxTeams: 16,
      img: '../assets/61fe8554e6377c0b431ed18f65529b1847d225cb.png',
      badge: 'Trending', badgeClass: 'live',
      description: "India's premier Rocket League championship! 16 teams of 3 compete in a Double Elimination bracket for \u20B95,00,000.",
      entryFee: '\u20B91,000 per team',
      registrationDates: { open: 'Jul 20, 2026', close: 'Aug 15, 2026' },
      rules: 'Teams of 3 players.\nFormat: Double Elimination.\nMax 16 teams.\nEntry fee: \u20B91,000 per team.\nGrand Champion rank required.',
      approvalStatus: 'approved', organizerId: 'system', createdBy: 'system',
      totalMatches: 30, matchesCompleted: 0,
      teams: [
        { id: 't1', name: 'Rocket Elite', avatar: 'R', players: 3, status: 'approved', createdBy: 'rocket_lead', members: [{ username: 'rocket_lead', role: 'captain' }], invites: [], joinRequests: [] },
        { id: 't2', name: 'Boost Kings', avatar: 'B', players: 3, status: 'approved', createdBy: 'boost_lead', members: [{ username: 'boost_lead', role: 'captain' }], invites: [], joinRequests: [] }
      ],
      standings: [], matches: [], disputes: [], createdAt: '2026-01-01T00:00:00.000Z'
    }
  ];

  try {
    var existing = JSON.parse(localStorage.getItem(KEY) || '[]');
    var existingIds = new Set(existing.map(function(c) { return c.id; }));
    var toAdd = SHOWCASE.filter(function(c) { return !existingIds.has(c.id); });
    if (toAdd.length > 0) {
      localStorage.setItem(KEY, JSON.stringify(existing.concat(toAdd)));
    }
  } catch (e) {
    console.warn('Could not seed showcase competitions:', e);
  }
})();

// ─── Auth-aware navigation ─────────────────────────────────────────────────
function goToComp(compId) {
  var session = getActiveSession();
  if (session) {
    window.location.href = 'pages/comp-info.html?id=' + encodeURIComponent(compId);
  } else {
    window.location.href = 'pages/login.html?redirect=' + encodeURIComponent('pages/comp-info.html?id=' + compId);
  }
}

function joinTeams(event, compId) {
  event.stopPropagation();
  var session = getActiveSession();
  if (session) {
    window.location.href = 'pages/join-teams.html?id=' + encodeURIComponent(compId);
  } else {
    window.location.href = 'pages/login.html?redirect=' + encodeURIComponent('pages/join-teams.html?id=' + compId);
  }
}

// ─── Render competition cards ──────────────────────────────────────────────
var COMPS = [
  { id: 'world-championship-2026', img: 'assets/b890c61489a080992ad7e99adabb1145e6d59606.png', badge: 'Featured', bc: 'featured', game: 'Counter-Strike 2', title: 'World Championship 2026', prize: '\u20B910,00,000', teams: '32 Teams', date: 'Aug 15, 2026', status: 'Registration Open' },
  { id: 'spring-split-finals',     img: 'assets/7b04655f1d50a8b1b25ad53f36d80ff99cb3184e.png', badge: 'Live',      bc: 'live',     game: 'League of Legends', title: 'Spring Split Finals',    prize: '\u20B98,50,000',  teams: '24 Teams',   date: 'Jul 22, 2026', status: 'Ongoing' },
  { id: 'champions-league',        img: 'assets/0e6f51d89fed056f96d58f2c51d79eb797ccdf75.png', badge: 'Hot',       bc: 'hot',      game: 'DOTA 2',            title: 'Champions League',       prize: '\u20B912,00,000', teams: '16 Teams',   date: 'Sep 10, 2026', status: 'Registration Open' },
  { id: 'battle-royale-masters',   img: 'assets/95bc0921c86340a2cee9e0a2d7ecd20b15a26143.png', badge: 'New',       bc: 'featured', game: 'Fortnite',          title: 'Battle Royale Masters',  prize: '\u20B915,00,000', teams: '100 Players', date: 'Jun 30, 2026', status: 'Upcoming' },
  { id: 'pro-league-season-5',     img: 'assets/fad13be991fc17a28771191ca710b201fb3ee4fb.png', badge: 'Featured',  bc: 'featured', game: 'Overwatch 2',       title: 'Pro League Season 5',    prize: '\u20B96,00,000',  teams: '20 Teams',   date: 'Jul 05, 2026', status: 'Registration Open' },
  { id: 'rocket-championship',     img: 'assets/61fe8554e6377c0b431ed18f65529b1847d225cb.png', badge: 'Trending',  bc: 'live',     game: 'Rocket League',     title: 'Rocket Championship',    prize: '\u20B95,00,000',  teams: '16 Teams',   date: 'Aug 20, 2026', status: 'Registration Open' },
];

document.getElementById('home-comps-grid').innerHTML = COMPS.map(function(c) {
  return '<div class="comp-card" onclick="goToComp(\'' + c.id + '\')" style="cursor:pointer;">' +
    '<div class="comp-card-img"><img src="' + c.img + '" alt="' + c.title + '"><span class="comp-badge ' + c.bc + '">' + c.badge + '</span></div>' +
    '<div class="comp-card-body">' +
      '<div class="comp-game-label">' + c.game + '</div>' +
      '<h3 class="comp-title">' + c.title + '</h3>' +
      '<div class="comp-meta">' +
        '<div class="comp-meta-item"><svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" stroke-width="1.33" stroke-linecap="round"><line x1="8" y1="1" x2="8" y2="15"/><path d="M11 4H6.5a2.5 2.5 0 0 0 0 5H9a2.5 2.5 0 0 1 0 5H4"/></svg>' + c.prize + '</div>' +
        '<div class="comp-meta-item"><svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" stroke-width="1.33" stroke-linecap="round"><path d="M11 3H5l-2 5h14l-2-5z"/><path d="M2 8v5h12V8"/></svg>' + c.teams + '</div>' +
        '<div class="comp-meta-item"><svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" stroke-width="1.33" stroke-linecap="round"><rect x="1" y="2" width="14" height="13" rx="2"/><line x1="1" y1="7" x2="15" y2="7"/></svg>' + c.date + '</div>' +
      '</div>' +
      '<div class="comp-card-footer">' +
        '<span class="comp-status">' + c.status + '</span>' +
        '<button class="btn-primary" onclick="joinTeams(event, \'' + c.id + '\')">Join Teams</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}).join('');
