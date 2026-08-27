/**
 * NEXUS ESPORTS — About Page JavaScript
 * Features: counter animation, scroll-fade-in, sidebar navigation, CTA
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────
     1. COUNTER ANIMATION
     Animates .stat-num[data-target] elements
     when they scroll into view.
  ───────────────────────────────────────── */
  function animateCounter(el) {
    const raw = el.dataset.target;          // e.g. "4+", "100%", "24/7", "Real-Time"
    const suffix = raw.replace(/[\d.]/g, ''); // non-digit part: "+", "%", "/7", "-Time"
    const num = parseFloat(raw);           // numeric part

    if (isNaN(num)) {
      // Non-numeric (e.g. "Real-Time") — just display immediately
      el.textContent = raw;
      return;
    }

    const duration = 1200; // ms
    const fps = 60;
    const steps = Math.round(duration / (1000 / fps));
    let current = 0;
    let frame = 0;

    const tick = () => {
      frame++;
      // Ease-out cubic
      const progress = 1 - Math.pow(1 - frame / steps, 3);
      current = Math.round(num * progress);
      el.textContent = current + suffix;
      if (frame < steps) requestAnimationFrame(tick);
      else el.textContent = raw; // ensure exact final value
    };

    requestAnimationFrame(tick);
  }

  /* ─────────────────────────────────────────
     2. SCROLL-TRIGGERED ANIMATIONS
     .fade-in elements gain .visible on entry.
     Counters fire once on entry.
  ───────────────────────────────────────── */
  function initScrollObserver() {
    const faders = document.querySelectorAll('.fade-in');
    const counters = document.querySelectorAll('.stat-num[data-target]');
    const fired = new WeakSet();

    if (!('IntersectionObserver' in window)) {
      // Fallback: show everything immediately
      faders.forEach(el => el.classList.add('visible'));
      counters.forEach(el => animateCounter(el));
      return;
    }

    // Fade-in observer
    const fadeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            fadeObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    faders.forEach(el => fadeObserver.observe(el));

    // Counter observer
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !fired.has(entry.target)) {
            fired.add(entry.target);
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach(el => counterObserver.observe(el));
  }


  /* ─────────────────────────────────────────
     4. CTA BUTTON — Navigates to Competitions page
  ───────────────────────────────────────── */
  function initCTA() {
    const btn = document.getElementById('cta-btn');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'competitions.html';
    });
  }

  /* ─────────────────────────────────────────
     6. TEAM CARD HOVER GLOW
     Adds a subtle lime glow on hover via JS
     (supplementing the CSS :hover).
  ───────────────────────────────────────── */
  function initTeamCards() {
    document.querySelectorAll('.team-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.boxShadow = '0 0 20px rgba(198,255,51,0.12)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.boxShadow = '';
      });
    });
  }

  /* ─────────────────────────────────────────
     7. FEATURE CARD HOVER GLOW
  ───────────────────────────────────────── */
  function initFeatureCards() {
    document.querySelectorAll('.feat-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.boxShadow = '0 4px 24px rgba(198,255,51,0.1)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.boxShadow = '';
      });
    });
  }

  /* ─────────────────────────────────────────
     8. SMOOTH SCROLL FOR FOOTER LINKS
  ───────────────────────────────────────── */
  function initFooterLinks() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', e => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  /* ─────────────────────────────────────────
     9. PLATFORM POLICIES from Super Admin Store
  ───────────────────────────────────────── */
  function renderPolicies() {
    const container = document.getElementById('about-policies-list');
    if (!container) return;
    try {
      let policies = [];
      const raw = localStorage.getItem('nexus_policies') || localStorage.getItem('nexus.policies');
      if (raw) {
        try { policies = JSON.parse(raw); } catch(e) {}
      }

      // Default active platform policies set by Super Admin
      if (!Array.isArray(policies) || policies.length === 0) {
        policies = [
          {
            id: 'pol-fair-play',
            title: 'Fair Play & Anti-Cheat Policy',
            category: 'Security',
            version: 'v2.4',
            status: 'active',
            summary: 'Zero tolerance policy for hacking, exploits, third-party software, and unsportsmanlike behavior across all platform competitions.'
          },
          {
            id: 'pol-eligibility',
            title: 'Player & Team Eligibility Policy',
            category: 'Eligibility',
            version: 'v1.8',
            status: 'active',
            summary: 'Rules governing minimum age requirements, regional lock restrictions, roster change windows, and player account verification.'
          },
          {
            id: 'pol-dispute-escalation',
            title: 'Match Dispute & Escalation Policy',
            category: 'Disputes',
            version: 'v1.2',
            status: 'active',
            summary: 'Governs the process for filing, reviewing, and resolving match disputes and auto-escalations between teams and tournament organizers.'
          },
          {
            id: 'pol-financial',
            title: 'Financial & Prize Distribution Policy',
            category: 'Financial',
            version: 'v2.0',
            status: 'active',
            summary: 'Rules regarding prize pool payouts, tax documentation, withdrawal timelines, and declared captain prize split distribution.'
          }
        ];
        try { localStorage.setItem('nexus_policies', JSON.stringify(policies)); } catch(e) {}
      }

      const activePolicies = policies.filter(p => !p.status || p.status === 'active');
      if (activePolicies.length === 0) return;

      container.innerHTML = activePolicies.map(p => `
        <div class="scope-card visible" style="margin-bottom:16px;background:#141414;border:1px solid #262626;border-left:3px solid #c6ff33;border-radius:12px;padding:22px 26px;opacity:1;transform:none;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
            <h3 style="font-size:17px;font-weight:700;color:#fff;margin:0;">${p.title || 'Platform Policy'}</h3>
            <div style="display:flex;gap:8px;align-items:center;">
              ${p.version ? `<span style="font-size:11px;font-weight:700;background:rgba(255,255,255,0.08);color:#d4d4d4;padding:3px 10px;border-radius:20px;">${p.version}</span>` : ''}
              ${p.category ? `<span style="font-size:11px;font-weight:700;background:rgba(198,255,51,0.15);color:#c6ff33;border:1px solid rgba(198,255,51,0.3);padding:3px 10px;border-radius:20px;text-transform:uppercase;">${p.category}</span>` : ''}
            </div>
          </div>
          <p style="font-size:14px;color:rgba(255,255,255,0.75);line-height:1.6;margin:0;">${p.summary || p.content || p.description || ''}</p>
          ${p.updatedAt ? `<p style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:10px;margin-bottom:0;">Last updated: ${new Date(p.updatedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>` : ''}
        </div>`).join('');
    } catch (e) {
      console.error('Failed to render platform policies:', e);
    }
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  function init() {
    initSidebar('about', '../');
    initFooter('../');
    renderPolicies();
    initScrollObserver();
    initCTA();
    initTeamCards();
    initFeatureCards();
    initFooterLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
