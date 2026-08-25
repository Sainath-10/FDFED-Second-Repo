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
     4. CTA BUTTON
  ───────────────────────────────────────── */
  function initCTA() {
    const btn = document.getElementById('cta-btn');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      // Smooth scroll to hero, or navigate to signup
      const target = document.getElementById('hero');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
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
     9. PLATFORM POLICIES from localStorage
  ───────────────────────────────────────── */
  function renderPolicies() {
    const container = document.getElementById('about-policies-list');
    if (!container) return;
    try {
      const raw = localStorage.getItem('nexus.policies');
      const policies = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(policies) || policies.length === 0) return; // keep placeholder

      container.innerHTML = policies.map(p => `
        <div class="scope-card fade-in" style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <h3 style="font-size:16px;color:var(--accent);margin:0;">${p.title || 'Policy'}</h3>
            ${p.category ? `<span style="font-size:11px;background:rgba(198,255,51,0.1);color:var(--accent);padding:2px 8px;border-radius:20px;">${p.category}</span>` : ''}
          </div>
          <p style="font-size:14px;color:var(--text-muted);line-height:1.6;margin:0;">${p.content || p.description || ''}</p>
          ${p.updatedAt ? `<p style="font-size:11px;color:var(--text-muted);margin-top:8px;opacity:0.6;">Last updated: ${new Date(p.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>` : ''}
        </div>`).join('');
    } catch (e) { }
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  function init() {
    initSidebar('about', '../');
    initFooter('../');
    initScrollObserver();
    initCTA();
    initTeamCards();
    initFeatureCards();
    initFooterLinks();
    renderPolicies();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
