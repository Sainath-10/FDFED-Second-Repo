import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <div className="footer-brand-logo">
            <img src="/assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus Logo" />
            <div className="footer-brand-name">
              <div className="name">NEXUS</div>
              <div className="sub">ESPORTS</div>
            </div>
          </div>
          <p className="footer-desc">
            The world's leading platform for competitive gaming and live match tracking. Join millions of players worldwide.
          </p>
        </div>
        <div className="footer-col">
          <div className="footer-col-title">Platform</div>
          <ul>
            <li><Link to="/about">About Us</Link></li>
            <li><Link to="/competitions">Tournaments</Link></li>
            <li><a href="#streams">Live Streams</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <div className="footer-col-title">Community</div>
          <ul>
            <li><Link to="/profile">Profile</Link></li>
            <li><a href="#leaderboard">Leaderboard</a></li>
            <li><a href="#discord">Discord</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <div className="footer-col-title">Support</div>
          <ul>
            <li><a href="#help">Help Center</a></li>
            <li><a href="#contact">Contact Us</a></li>
            <li><a href="#privacy">Privacy Policy</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span className="footer-copy">© 2026 NEXUS ESPORTS. All rights reserved.</span>
        <div className="footer-status">
          <div className="status-dot"></div>
          <span>Server Status: Operational</span>
        </div>
      </div>
    </footer>
  );
}
