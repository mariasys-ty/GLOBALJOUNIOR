// ── 1. Firebase Initialization (graceful fallback) ──────────────
let db = null;
let FB = null;
let firebaseReady = false;

// ✅ REPLACE WITH THIS:
async function initFirebase() {
  try {
    const config = await import('./config.js');
    db = config.db;
    FB = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js");
    firebaseReady = true;
    console.log('✅ Firebase connected');
  } catch (err) {
    console.warn('⚡ Firebase not configured — static content will be displayed.', err.message);
  }
}

// Safe Firebase wrapper — returns undefined if Firebase isn't loaded
const fb = {
  ref:   (path)              => FB?.ref(db, path),
  push:  (r)                 => FB?.push(r),
  set:   (r, data)           => FB?.set(r, data),
  onVal: (r, cb, errCb)     => FB?.onValue(r, cb, errCb),
  get:   (r)                 => FB?.get(r),
  ok:    ()                  => firebaseReady
};

// ── 2. Utility Functions ────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const snapshotToArray = (snap) => {
  const data = snap?.val();
  if (!data) return [];
  return Object.entries(data).map(([id, val]) => ({ id, ...val }));
};

const parseDate = (dateStr) => {
  if (!dateStr) return { day: '??', month: '??', year: '' };
  const d = new Date(dateStr);
  if (isNaN(d)) return { day: '??', month: '??', year: '' };
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return { day: String(d.getDate()).padStart(2, '0'), month: months[d.getMonth()], year: d.getFullYear() };
};

const truncate = (text, max = 120) => text.length > max ? text.slice(0, max) + '…' : text;

const showFormMsg = (el, msg, type = 'success') => {
  if (!el) return;
  el.style.display = 'block';
  el.style.background = type === 'success' ? '#e8f5e9' : '#ffebee';
  el.style.color = type === 'success' ? '#1b5e20' : '#c62828';
  el.style.padding = '14px 18px';
  el.style.borderRadius = '10px';
  el.style.marginTop = '14px';
  el.style.fontSize = '0.9rem';
  el.style.fontWeight = '500';
  el.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
  setTimeout(() => { el.style.display = 'none'; }, 7000);
};

const pushToFirebase = async (path, data) => {
  if (!fb.ok()) return false;
  try {
    const newRef = await fb.push(fb.ref(path)); // <-- FIXED: added await
    await fb.set(newRef, { ...data, submittedAt: new Date().toISOString() });
    return true;
  } catch (e) {
    console.error('Firebase write error:', e);
    return false;
  }
};

// ── 3. Preloader ───────────────────────────────────────────────
const hidePreloader = () => {
  const preloader = $('#preloader');
  if (!preloader) return;
  preloader.classList.add('hidden');
  setTimeout(() => { preloader.style.display = 'none'; }, 600);
};

window.addEventListener('load', () => {
  setTimeout(hidePreloader, 1800);
});
// Fallback: hide after 4s no matter what
setTimeout(hidePreloader, 4000);

// ── 4. Dark Mode ───────────────────────────────────────────────
const initDarkMode = () => {
  const toggle = $('#darkModeToggle');
  const html = document.documentElement;
  if (!toggle) return;

  // Restore saved preference
  const saved = localStorage.getItem('gjs-theme');
  if (saved === 'dark') html.setAttribute('data-theme', 'dark');

  toggle.addEventListener('click', () => {
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('gjs-theme', isDark ? 'light' : 'dark');
    toggle.innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
  });

  // Set initial icon
  if (html.getAttribute('data-theme') === 'dark') {
    toggle.innerHTML = '<i class="fas fa-sun"></i>';
  }
};

// ── 5. Sticky Navbar ───────────────────────────────────────────
const initStickyNav = () => {
  const header = $('#header');
  if (!header) return;
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 60);
    lastScroll = y;
  }, { passive: true });
};

// ── 6. Active Nav Link on Scroll ────────────────────────────────
const initActiveNav = () => {
  const sections = $$('section[id]');
  const links = $$('.nav-link, .mobile-link');

  if (!sections.length || !links.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        links.forEach(l => {
          l.classList.toggle('active', l.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => observer.observe(s));
};

// ── 7. Mobile Navigation ───────────────────────────────────────
const initMobileNav = () => {
  const toggle = $('#menuToggle');
  const nav = $('#mobileNav');
  const overlay = $('#mobileNavOverlay');
  const close = $('#mobileNavClose');
  const links = $$('.mobile-link');
  if (!nav) return;

  const open = () => {
    nav.classList.add('active');
    overlay?.classList.add('active');
    toggle?.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeNav = () => {
    nav.classList.remove('active');
    overlay?.classList.remove('active');
    toggle?.classList.remove('active');
    document.body.style.overflow = '';
  };

  toggle?.addEventListener('click', () => {
    nav.classList.contains('active') ? closeNav() : open();
  });

  close?.addEventListener('click', closeNav);
  overlay?.addEventListener('click', closeNav);
  links.forEach(l => l.addEventListener('click', closeNav));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('active')) {
      closeNav();
      toggle?.focus();
    }
  });
};

// ── 8. Hero Slider ─────────────────────────────────────
const initHeroSlider = () => {
  const slider = $('#heroSlider');
  const dotsContainer = $('#sliderDots');
  const contentEl = $('#heroContent');
  if (!slider) return;

  // Use the hardcoded slides already in the HTML
  let slides = $$('.hero-slide', slider);
  let dots = [];
  let heroData = [];
  let current = 0;
  let interval = null;

  const prevBtn = $('#sliderPrev');
  const nextBtn = $('#sliderNext');

  if (slides.length === 0) return;

  // Generate dots to match the hardcoded slides
  slides.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = `dot ${i === 0 ? 'active' : ''}`;
    dot.dataset.index = i;
    dotsContainer.appendChild(dot);
  });
  dots = $$('.dot', dotsContainer);

  // Updates the text overlay based on active slide
  const updateContent = (data) => {
    if (!contentEl || !data) return;

    let buttonsHtml = '';
    if (data.buttons && Array.isArray(data.buttons)) {
      buttonsHtml = data.buttons.map(btn =>
        `<a href="${btn.link || '#'}" class="${btn.class || 'btn btn-primary btn-lg'}">
          ${btn.icon ? `<i class="${btn.icon}"></i> ` : ''}${btn.text || 'Click'}
        </a>`
      ).join('');
    }

    contentEl.innerHTML = `
      <div class="hero-badge animate-fade-up">
        ${data.badgeIcon ? `<i class="${data.badgeIcon}"></i> ` : ''}${data.badge || ''}
      </div>
      <h1 class="hero-title animate-fade-up delay-1">${data.title || 'Welcome'}</h1>
      <p class="hero-subtitle animate-fade-up delay-2">${data.subtitle || ''}</p>
      <div class="hero-buttons animate-fade-up delay-3">${buttonsHtml}</div>
    `;

    if (typeof initScrollAnimations === 'function') initScrollAnimations();
  };

  const goTo = (index) => {
    slides[current].classList.remove('active');
    dots[current]?.classList.remove('active');

    current = (index + slides.length) % slides.length;

    slides[current].classList.add('active');
    dots[current]?.classList.add('active');

    if (heroData.length > 0) {
      updateContent(heroData[current]);
    }
  };

  const startAuto = () => { stopAuto(); interval = setInterval(() => goTo(current + 1), 5500); };
  const stopAuto = () => { clearInterval(interval); };

  // Controls
  prevBtn?.addEventListener('click', () => { goTo(current - 1); startAuto(); });
  nextBtn?.addEventListener('click', () => { goTo(current + 1); startAuto(); });
  dots.forEach((d, i) => d.addEventListener('click', () => { goTo(i); startAuto(); }));

  slider.addEventListener('mouseenter', stopAuto);
  slider.addEventListener('mouseleave', startAuto);

  // Touch/swipe
  let touchStartX = 0;
  slider.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
  slider.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) { diff > 0 ? goTo(current + 1) : goTo(current - 1); startAuto(); }
  }, { passive: true });

  // Fetch only TEXT content from Firebase (no images)
  if (fb.ok()) {
    fb.get(fb.ref('admin/homepage/heroSection')).then((snap) => {
      if (snap.exists()) {
        heroData = typeof snapshotToArray === 'function'
          ? snapshotToArray(snap)
          : Object.values(snap.val() || {});

        // Render text for the first slide
        if (heroData.length > 0) {
          updateContent(heroData[0]);
        }
      }
    }).catch((err) => {
      console.error("[Hero Slider Error]:", err);
    });
  }

  // Start auto-play if there's more than 1 slide
  if (slides.length >= 2) startAuto();
};

// ── 9. Stats Counter Animation ─────────────────────────────────
const initStatsCounter = () => {
  const statsSection = $('.hero-stats');
  if (!statsSection) return;

  const counters = $$('.stat-number', statsSection);

  const animateCounter = (el) => {
    const target = parseInt(el.getAttribute('data-target'), 10);
    if (isNaN(target) || target === 0) return;
    const duration = 2200;
    const start = performance.now();

    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      el.textContent = Math.floor(ease * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString();
    };
    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        counters.forEach(animateCounter);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  observer.observe(statsSection);
};

// Load stats from Firebase and update data-target attributes
const loadFirebaseStats = () => {
  if (!fb.ok()) return;
 fb.onVal(fb.ref('admin/homepage/statisticsCounters'), (snap) => {
    const data = snap.val();
    if (!data) return;
    const map = {
      students: '[data-target]',
      teachers: null,
      yearsOfExcellence: null,
      successRate: null
    };
    const counters = $$('.stat-number');
    const keys = ['students', 'teachers', 'yearsOfExcellence', 'successRate'];
    counters.forEach((el, i) => {
      if (keys[i] && data[keys[i]] != null) {
        el.setAttribute('data-target', data[keys[i]]);
      }
    });
    // Re-trigger animation with new values
    initStatsCounter();
  });
};

// ── 10. Scroll Animations ──────────────────────────────────────
const initScrollAnimations = () => {
  const elements = $$('[data-animate]');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.getAttribute('data-delay');
        if (delay) {
          entry.target.style.transitionDelay = `${delay}ms`;
        }
        entry.target.classList.add('animated');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  elements.forEach(el => observer.observe(el));
};

// ── 11. Back to Top ────────────────────────────────────────────
const initBackToTop = () => {
  const btn = $('#back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
};

// ── 12. Smooth Scrolling ───────────────────────────────────────
const initSmoothScroll = () => {
  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = $(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
};

// ── 13. Gallery System ─────────────────────────────────────────
let lightboxImages = [];
let lightboxIndex = 0;
let lightboxContext = '';

const initLightbox = () => {
  const lightbox = $('#lightbox');
  const img = $('#lightboxImage');
  const counter = $('#lightboxCounter');
  const closeBtn = $('.lightbox-close');
  const prevBtn = $('.lightbox-prev');
  const nextBtn = $('.lightbox-next');
  if (!lightbox || !img) return;

  const open = (images, index, context = '') => {
    lightboxImages = images;
    lightboxIndex = index;
    lightboxContext = context;
    updateLightbox();
    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeBtn?.focus();
  };

  const close = () => {
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  const updateLightbox = () => {
    if (!lightboxImages[lightboxIndex]) return;
    img.src = lightboxImages[lightboxIndex].src;
    img.alt = lightboxImages[lightboxIndex].alt || '';
    if (counter) {
      counter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
    }
  };

  const goPrev = () => {
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    updateLightbox();
  };

  const goNext = () => {
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    updateLightbox();
  };

  closeBtn?.addEventListener('click', close);
  prevBtn?.addEventListener('click', goPrev);
  nextBtn?.addEventListener('click', goNext);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox || e.target === $('.lightbox-content')) close(); });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') goPrev();
    if (e.key === 'ArrowRight') goNext();
  });

  // Attach click handlers to all gallery-type items
  const attachGalleryClicks = () => {
    ['.gallery-item', '.nursery-gallery-item'].forEach(selector => {
      $$(selector).forEach((item, idx) => {
        const zoomBtn = $('.gallery-zoom', item);
        const fullImg = item.querySelector('img');
        const handler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const parent = item.parentElement;
          const siblings = $$(selector, parent);
          const images = siblings.map(s => ({
            src: s.querySelector('img')?.getAttribute('data-full') || s.querySelector('img')?.src || '',
            alt: s.querySelector('img')?.alt || ''
          }));
          const currentIndex = siblings.indexOf(item);
          open(images, currentIndex, selector);
        };
        zoomBtn?.removeEventListener('click', handler);
        zoomBtn?.addEventListener('click', handler);
        if (!zoomBtn) {
          item.removeEventListener('click', handler);
          item.addEventListener('click', handler);
        }
      });
    });
  };

  attachGalleryClicks();
  // Re-attach after dynamic content loads
  window._attachGalleryClicks = attachGalleryClicks;
};

// Gallery category filters
const initGalleryFilters = () => {
  const container = $('#galleryMasonry');
  const filterBtns = $$('.filter-btn');
  if (!container || !filterBtns.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-filter');
      $$('.gallery-item', container).forEach(item => {
        const cat = item.getAttribute('data-category');
        const show = filter === 'all' || cat === filter;
        item.classList.toggle('hidden', !show);
        if (show) item.style.display = '';
        else item.style.display = 'none';
      });
    });
  });
};

// Render gallery from Firebase
const loadFirebaseGallery = () => {
  if (!fb.ok()) { initGalleryFilters(); return; }

 fb.onVal(fb.ref('admin/gallery/images'), (snap) => {
    const items = snapshotToArray(snap);
    if (!items.length) { initGalleryFilters(); return; }

    const container = $('#galleryMasonry');
    const filtersContainer = $('.gallery-filters');
    if (!container) return;

    // Get unique categories
    const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
    const allCategories = ['all', ...categories];

    // Rebuild filter buttons
    if (filtersContainer) {
      filtersContainer.innerHTML = allCategories.map(cat =>
        `<button class="filter-btn${cat === 'all' ? ' active' : ''}" data-filter="${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</button>`
      ).join('');
    }

    // Render items
   container.innerHTML = items.map(item => `
    <div class="gallery-item" data-category="${item.category || ''}" data-animate="fade-up">
      <img src="${item.url}" alt="${item.title || 'Gallery image'}" loading="lazy"
           data-full="${item.url}">
        <div class="gallery-item-overlay">
          <span class="gallery-item-category">${item.category || ''}</span>
          <h4>${item.title || ''}</h4>
          <button class="gallery-zoom" aria-label="Zoom image"><i class="fas fa-expand"></i></button>
        </div>
      </div>
    `).join('');

    initGalleryFilters();
    initScrollAnimations();
    if (window._attachGalleryClicks) window._attachGalleryClicks();
  });
};

// ── 14. Testimonials Carousel ──────────────────────────────────
const initTestimonialsCarousel = () => {
  const carousel = $('#testimonialsCarousel');
  const track = $('#testimonialsTrack');
  const prevBtn = $('#testimonialPrev');
  const nextBtn = $('#testimonialNext');
  const dotsContainer = $('#testimonialsDots');
  if (!carousel || !track) return;

  let current = 0;
  let slides = $$('.testimonial-card', track);
  let interval = null;

  const buildDots = () => {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = slides.map((_, i) =>
      `<span class="${i === 0 ? 'active' : ''}" data-index="${i}"></span>`
    ).join('');
    $$('span', dotsContainer).forEach(dot => {
      dot.addEventListener('click', () => { goTo(parseInt(dot.dataset.index)); restartAuto(); });
    });
  };

  const goTo = (index) => {
    if (!slides.length) return;
    current = ((index % slides.length) + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    $$('#testimonialsDots span').forEach((d, i) => d.classList.toggle('active', i === current));
  };

  const startAuto = () => { interval = setInterval(() => goTo(current + 1), 6000); };
  const stopAuto = () => { clearInterval(interval); };
  const restartAuto = () => { stopAuto(); startAuto(); };

  prevBtn?.addEventListener('click', () => { goTo(current - 1); restartAuto(); });
  nextBtn?.addEventListener('click', () => { goTo(current + 1); restartAuto(); });
  carousel.addEventListener('mouseenter', stopAuto);
  carousel.addEventListener('mouseleave', startAuto);

  // Touch support
  let touchX = 0;
  carousel.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].screenX; }, { passive: true });
  carousel.addEventListener('touchend', (e) => {
    const diff = touchX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) { diff > 0 ? goTo(current + 1) : goTo(current - 1); restartAuto(); }
  }, { passive: true });

  buildDots();
  startAuto();

  // Expose rebuild function for Firebase
  window._rebuildTestimonials = () => {
    slides = $$('.testimonial-card', track);
    current = 0;
    track.style.transform = 'translateX(0)';
    buildDots();
  };
};

const loadFirebaseTestimonials = () => {
  if (!fb.ok()) return;

 fb.onVal(fb.ref('admin/testimonials/parentReviews'), (snap) => {
    const items = snapshotToArray(snap);
    if (!items.length) return;

    const track = $('#testimonialsTrack');
    if (!track) return;

    track.innerHTML = items.map(t => {
      const stars = Array.from({ length: 5 }, (_, i) =>
        i < t.rating ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>'
      ).join('');

      return `
        <div class="testimonial-card">
          <div class="testimonial-stars">${stars}</div>
          <p class="testimonial-text">"${t.message}"</p>
          <div class="testimonial-author">
            <div class="testimonial-avatar">
              <div style="width:100%;height:100%;background:var(--color-primary-50);display:flex;align-items:center;justify-content:center;color:var(--color-primary);font-weight:700;font-size:1.2rem;">
                ${t.name ? t.name.charAt(0).toUpperCase() : '?'}
              </div>
            </div>
            <div>
              <h4>${t.name || 'Anonymous'}</h4>
              <span>Parent / Guardian</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window._rebuildTestimonials) window._rebuildTestimonials();
  });
};

// ── 15. Events (Firebase) ──────────────────────────────────────
function loadFirebaseEvents() { // FIX: Changed from const ... = () =>
  if (!fb.ok()) return;

  fb.onVal(fb.ref('admin/events/upcomingEvents'), (snap) => {
    const container = $('#events-grid');
    if (!container) {
      console.warn("[Events] #events-grid container not found in HTML.");
      return;
    }

    const items = typeof snapshotToArray === 'function' 
      ? snapshotToArray(snap) 
      : Object.values(snap.val() || {});

    console.log("[Events Data from Firebase]:", items); // Debug log

    if (!items.length) {
      container.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: #6b7280;">No upcoming events at the moment.</p>';
      return;
    }

    items.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    container.innerHTML = items.map((ev, i) => {
      let day = 'TBA', month = 'TBA';
      if (ev.date && typeof parseDate === 'function') {
        const parsed = parseDate(ev.date);
        day = parsed.day;
        month = parsed.month;
      }

      const tagClass = ev.category ? `tag-${ev.category.toLowerCase().replace(/\s+/g, '-')}` : 'tag-event';

      const locIcon = ev.location?.toLowerCase().includes('transport') || ev.location?.toLowerCase().includes('bus') 
        ? 'fas fa-bus' 
        : 'fas fa-map-marker-alt';

      return `
        <div class="event-card" data-animate="fade-up" ${i > 0 ? `data-delay="${i * 100}"` : ''}>
          <div class="event-date-badge">
            <span class="event-day">${day}</span>
            <span class="event-month">${month}</span>
          </div>
          <div class="event-content">
            <div class="event-tag ${tagClass}">${ev.category || 'Event'}</div>
            <h3>${ev.title || 'Untitled Event'}</h3>
            <p>${ev.description ? truncate(ev.description, 100) : ''}</p>
            <div class="event-meta">
              ${ev.time ? `<span><i class="fas fa-clock"></i> ${ev.time}</span>` : ''}
              ${ev.location ? `<span><i class="${locIcon}"></i> ${ev.location}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (typeof initScrollAnimations === 'function') initScrollAnimations();
    
  }, (error) => {
    console.error("[Events Fetch Error]:", error);
  });
}

// ── 15b. School Calendar / Terms (Firebase) ────────────────────
function loadSchoolCalendar() {
  if (!fb.ok()) return;
  
  fb.onVal(fb.ref('admin/events/schoolCalendar'), (snap) => {
    const container = $('#school-terms-timeline');
    if (!container) {
      console.warn("[Calendar] #school-terms-timeline container not found in HTML.");
      return;
    }
    
    const items = typeof snapshotToArray === 'function' ?
      snapshotToArray(snap) :
      Object.values(snap.val() || {});

    console.log("[Calendar Data from Firebase]:", items); // Debug log
    
    if (!items.length) {
      container.style.display = 'none';
      return;
    }
    
    const now = new Date();
    items.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
    container.innerHTML = items.map(term => {
      const start = new Date(term.startDate);
      const end = new Date(term.endDate);
      
      const startStr = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const endStr = end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      
      let state = 'completed';
      let statusText = 'Completed';
      if (now >= start && now <= end) {
        state = 'active';
        statusText = 'In Progress';
      } else if (now < start) {
        state = 'upcoming';
        statusText = 'Upcoming';
      }
      
      return `
        <div class="term-card is-${state}">
          <h3 class="term-card__title">${term.title || 'School Term'}</h3>
          <div class="term-card__dates">
            <span><i class="fas fa-play-circle"></i> Starts: ${startStr}</span>
            <span><i class="fas fa-stop-circle"></i> Ends: ${endStr}</span>
          </div>
          <span class="term-card__status status-${state}">${statusText}</span>
        </div>
      `;
    }).join('');
    
  }, (error) => {
    console.error("[Calendar Fetch Error]:", error);
  });
}

// ── 16. News (Firebase) ────────────────────────────────────────
const loadFirebaseNews = () => {
  if (!fb.ok()) return;
  
  fb.onVal(fb.ref('admin/news/articles'), (snap) => {
    // Safely convert snapshot to array
    const items = typeof snapshotToArray === 'function' ?
      snapshotToArray(snap) :
      Object.values(snap.val() || {});
    
    if (!items.length) return;
    
    // Sort by createdAt descending (newest first)
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const featured = items[0];
    const rest = items.slice(1);
    
    // ── Render Featured Article ──
    const featuredEl = $('.news-featured');
    if (featuredEl && featured) {
      const dateStr = featured.createdAt ?
        new Date(featured.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) :
        '';
      
      // FIX: Added missing </div>, fixed "n.status" to "featured.category", 
      // and added fallback "|| featured.image" just in case
      featuredEl.innerHTML = `
        <div class="news-featured-img">
          <img src="${featured.imageUrl || featured.image}" alt="${featured.title || ''}" loading="lazy">
          <div class="news-featured-badge">Featured</div>
        </div>
        <div class="news-featured-content">
          <div class="news-meta">
            <span><i class="fas fa-calendar"></i> ${dateStr}</span>
            <span><i class="fas fa-tag"></i> ${featured.category || 'News'}</span>
          </div>
          <h3>${featured.title || 'Untitled'}</h3>
          <p>${truncate(featured.content, 200)}</p>
        </div>
      `;
    }
    
    // ── Render Grid Articles ──
    const gridEl = $('.news-grid');
    if (gridEl) {
      // FIX: Added fallback "|| n.image" to match whatever your database uses
      gridEl.innerHTML = rest.slice(0, 3).map((n, i) => {
        const dateStr = n.createdAt ?
          new Date(n.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) :
          '';
        
        return `
          <article class="news-card" data-animate="fade-up" ${i > 0 ? `data-delay="${i * 100}"` : ''}>
            <div class="news-card-img">
              <img src="${n.imageUrl || n.image}" alt="${n.title || ''}" loading="lazy">
              <div class="news-card-category">${n.category || 'News'}</div>
            </div>
            <div class="news-card-content">
              <div class="news-meta">
                <span><i class="fas fa-calendar"></i> ${dateStr}</span>
                <span><i class="fas fa-user"></i> ${n.author || 'Admin'}</span>
              </div>
              <h3>${n.title || 'Untitled'}</h3>
              <p>${truncate(n.content, 90)}</p>
              <a href="#" class="news-read-more">Read More <i class="fas fa-arrow-right"></i></a>
            </div>
          </article>
        `;
      }).join('');
    }
    
    // Re-trigger scroll animations for the newly injected cards
    if (typeof initScrollAnimations === 'function') {
      initScrollAnimations();
    }
    
  }, (error) => {
    // Added error catch so you know if it's a Firebase permissions issue
    console.error("[News Fetch Error]:", error);
  });
};

// ── 17. Form Handlers ──────────────────────────────────────────

// Generic form validator
const validateForm = (form) => {
  let valid = true;
  const requiredFields = $$('[required]', form);
  requiredFields.forEach(field => {
    if (field.type === 'checkbox') {
      if (!field.checked) { valid = false; field.style.outline = '2px solid #ef4444'; }
      else { field.style.outline = ''; }
    } else if (!field.value.trim()) {
      valid = false;
      field.style.borderColor = '#ef4444';
      field.addEventListener('input', () => { field.style.borderColor = ''; }, { once: true });
    } else {
      field.style.borderColor = '';
    }
  });

  // Email validation
  const emailField = $('input[type="email"]', form);
  if (emailField && emailField.value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailField.value)) {
      valid = false;
      emailField.style.borderColor = '#ef4444';
    }
  }

  return valid;
};

// Contact Form → contacts/messages
const initContactForm = () => {
  const form = $('#contact-form');
  const msgEl = $('#form-message');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const data = {
      name: $('#contact-name')?.value.trim(),
      email: $('#contact-email')?.value.trim(),
      phone: $('#contact-phone')?.value.trim(),
      message: $('#contact-message')?.value.trim(),
      subject: $('#contact-subject')?.value || 'General Enquiry'
    };

   const success = await pushToFirebase('admin/communications/contactMessages', data);
    if (success) {
      showFormMsg(msgEl, 'Thank you! Your message has been sent. We will get back to you soon.');
      form.reset();
    } else {
      showFormMsg(msgEl, 'Something went wrong. Please try again or contact us directly.', 'error');
    }
  });
};

// Main Admission Form → admissions/applications
const initAdmissionForm = () => {
  const form = $('#admission-form');
  const msgEl = $('#admission-form-message');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const data = {
      studentName: $('#child-name')?.value.trim(),
      parentName: $('#parent-name')?.value.trim(),
      phone: $('#parent-phone')?.value.trim(),
      email: $('#parent-email')?.value.trim(),
      classApplied: $('#applying-grade')?.value || '',
      curriculum: $('#curriculum')?.value || '',
      additionalInfo: $('#message')?.value.trim(),
      status: 'Pending'
    };

   const success = await pushToFirebase('admin/communications/contactMessages', data);
    if (success) {
      showFormMsg(msgEl, 'Application submitted successfully! We will contact you within 48 hours.');
      form.reset();
    } else {
      showFormMsg(msgEl, 'Something went wrong. Please try again.', 'error');
    }
  });
};

// Nursery Enquiry Form → admissions/applications (with nursery class)
const initNurseryForm = () => {
  const form = $('#nursery-enquiry-form');
  const msgEl = $('#nursery-form-message');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const data = {
      studentName: $('#nursery-child-name')?.value.trim(),
      parentName: $('#nursery-parent-name')?.value.trim(),
      phone: $('#nursery-parent-phone')?.value.trim(),
      email: $('#nursery-parent-email')?.value.trim(),
      classApplied: `Nursery - ${$('#nursery-class')?.value || ''}`,
      dateOfBirth: $('#nursery-child-dob')?.value || '',
      additionalInfo: $('#nursery-message')?.value.trim(),
      status: 'Pending'
    };

    const success = await pushToFirebase('admissions/applications', data);
    if (success) {
      showFormMsg(msgEl, 'Nursery enquiry submitted! Our admissions team will contact you within 24 hours.');
      form.reset();
    } else {
      showFormMsg(msgEl, 'Something went wrong. Please try again.', 'error');
    }
  });
};

// Newsletter Form → contacts/messages (with type marker)
const initNewsletterForm = () => {
  const form = $('#newsletter-form');
  const msgEl = $('#newsletter-message');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = $('input[type="email"]', form);
    if (!emailInput || !emailInput.value.trim()) return;

    const data = {
      name: 'Newsletter Subscriber',
      email: emailInput.value.trim(),
      phone: '',
      message: 'Newsletter subscription',
      submittedAt: new Date().toISOString()
    };

    const success = await pushToFirebase('contacts/messages', data);
    if (success) {
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.color = '#1b5e20';
        msgEl.style.fontSize = '13px';
        msgEl.style.marginTop = '8px';
        msgEl.innerHTML = '<i class="fas fa-check-circle"></i> Subscribed successfully!';
        setTimeout(() => { msgEl.style.display = 'none'; }, 5000);
      }
      form.reset();
    }
  });
};

// ── 18. Dynamic Settings from Firebase ──────────────────────────
const loadFirebaseSettings = () => {
  if (!fb.ok()) return;

  fb.onVal(fb.ref('settings'), (snap) => {
    const data = snap.val();
    if (!data) return;

    // Social media links
    if (data.socialMedia) {
      const sm = data.socialMedia;
      const mapping = {
        facebook:  ['.top-bar-right a[aria-label="Facebook"]', '.footer-social a[aria-label="Facebook"]'],
        twitter:   ['.top-bar-right a[aria-label="Twitter"]', '.footer-social a[aria-label="Twitter"]'],
        instagram: ['.top-bar-right a[aria-label="Instagram"]', '.footer-social a[aria-label="Instagram"]'],
        youtube:   ['.top-bar-right a[aria-label="YouTube"]', '.footer-social a[aria-label="YouTube"]'],
      };

      Object.entries(mapping).forEach(([platform, selectors]) => {
        const url = sm[platform];
        if (!url) return;
        selectors.forEach(sel => {
          $$(sel).forEach(el => { el.href = url; });
        });
      });

      // WhatsApp
      if (sm.whatsapp) {
        const waFloat = $('.whatsapp-float');
        if (waFloat) {
          const phone = sm.whatsapp.replace(/[^0-9]/g, '');
          waFloat.href = `https://wa.me/${phone}?text=Hello%20Global%20Junior%20School%2C%20I%20would%20like%20to%20enquire.`;
        }
      }
    }

    // Theme colors
    if (data.theme) {
      const root = document.documentElement;
      if (data.theme.primaryColor) {
        root.style.setProperty('--color-primary', data.theme.primaryColor);
        root.style.setProperty('--color-primary-dark', data.theme.primaryColor);
      }
      if (data.theme.secondaryColor) {
        root.style.setProperty('--color-accent', data.theme.secondaryColor);
        root.style.setProperty('--color-gold', data.theme.secondaryColor);
      }
    }
  });

  // Admissions status
  fb.onVal(fb.ref('admissions/settings'), (snap) => {
    const data = snap.val();
    if (!data) return;

    // If admissions are closed, disable forms and show notice
    if (data.status === 'Closed') {
      ['#admission-form', '#nursery-enquiry-form'].forEach(sel => {
        const form = $(sel);
        if (!form) return;
        form.innerHTML = `
          <div style="text-align:center;padding:40px 20px;">
            <i class="fas fa-lock" style="font-size:3rem;color:var(--text-light);margin-bottom:16px;display:block;"></i>
            <h3 style="color:var(--text-primary);margin-bottom:8px;">Admissions Currently Closed</h3>
            <p style="color:var(--text-muted);">Admissions for this term are now closed. Please check back later or contact us for more information.</p>
          </div>
        `;
      });
    }

    // Update application fee if displayed
    if (data.applicationFee) {
      $$('.nursery-fees-table .fees-row').forEach(row => {
        const label = $('span:first-child', row);
        if (label && label.textContent.includes('Admission Fee')) {
          const val = $('span:last-child', row);
          if (val) val.textContent = data.applicationFee;
        }
      });
    }
  });
};

// ── 19. Initialize Everything ──────────────────────────────────
const init = () => {
  // UI Features (no Firebase needed)
  initDarkMode();
  initStickyNav();
  initActiveNav();
  initMobileNav();
  initHeroSlider();
  initStatsCounter();
  initScrollAnimations();
  initBackToTop();
  initSmoothScroll();
  initLightbox();
  initTestimonialsCarousel();

  // Forms (work with or without Firebase — fallback to success message)
  initContactForm();
  initAdmissionForm();
  initNurseryForm();
  initNewsletterForm();

  // Firebase-driven features (graceful fallback to static HTML)
  loadFirebaseStats();
  loadFirebaseGallery();
  loadFirebaseTestimonials();
  loadFirebaseEvents();
  loadFirebaseNews();
  loadFirebaseSettings();
  loadSchoolCalendar();

  console.log('🎓 Global Junior School — Initialized');
};

// Connect to Firebase FIRST, then initialize everything
initFirebase().then(() => {
  init();
});
