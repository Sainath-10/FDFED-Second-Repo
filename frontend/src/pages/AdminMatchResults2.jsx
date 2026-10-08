/**
 * NEXUS ESPORTS — Admin Match Results (…2)
 *
 *
 */
import { Link } from 'react-router-dom';
import '../styles/pages/admin/match-results.css';

const RESULTS = [
  { match: 'Group B · Match 1', winner: 'NaVi', score: '16 – 8', loser: 'FaZe Clan', date: 'Mar 10' },
  { match: 'Group C · Match 2', winner: 'Heroic', score: '16 – 11', loser: 'ENCE', date: 'Mar 10' },
];

export default function AdminMatchResults2() {
  return (
    <main className="main-content">
      <Link to="/pages/admin/competition-detail2.html" className="back-btn-alt">← Spring Invitational</Link>
      <h1 className="admin-title-lg">Match Results</h1>
      <p className="admin-subtitle-accent">Spring Invitational · Confirmed Results</p>

      <div className="admin-comp-tabs">
        <Link to="/pages/admin/competition-detail2.html" className="admin-tab">Overview</Link>
        <Link to="/pages/admin/manage-teams2.html" className="admin-tab">Teams</Link>
        <Link to="/pages/admin/manage-matches2.html" className="admin-tab">Matches</Link>
        <Link to="/pages/admin/match-results2.html" className="admin-tab active">Results</Link>
        <Link to="/pages/admin/view-standings.html" className="admin-tab">Standings</Link>
      </div>

      <div className="table-container-card">
        <div className="table-scroll-wrap">
          <table className="admin-table" id="results-table">
            <thead><tr><th>Match</th><th>Winner</th><th>Score</th><th>Loser</th><th>Date</th></tr></thead>
            <tbody>
              {RESULTS.map((r) => (
                <tr key={r.match}>
                  <td>{r.match}</td>
                  <td><strong>{r.winner}</strong> 🏆</td>
                  <td className="score-display-sm">{r.score}</td>
                  <td className="team-name-loser">{r.loser}</td>
                  <td>{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}


