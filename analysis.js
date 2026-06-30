// ============================================================
// GLOBAL JUNIOR SCHOOL — Analytics Engine
// ============================================================
// Include on EVERY page: <script type="module" src="analysis.js"></script>
// This file COLLECTS data. The dashboard page READS and DISPLAYS it.
// ============================================================

// ── 1. Firebase Connection (same pattern as script.js) ──────────
let db = null, FB = null, fbOk = false;
try {
  const cfg = await import('./config.js');
  db = cfg.db;
  FB = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js");
  fbOk = true;
} catch (e) {
  console.warn('⚡ Analytics: Firebase not available — running in local mode.', e.message);
}

const ref  = (p) => FB?.ref(db, `analytics/${p}`);
const push = (r) => FB?.push(r);
const set  = (r, d) => FB?.set(r, d);
const get  = (r) => FB?.get(r);
const onVal = (r, cb) => FB?.onValue(r, cb);
const onDisc = (r) => FB?.onDisconnect(r);
const ok   = () => fbOk;

// ── 2. Utilities ──────────────────────────────────────────────────
const uid  = () => crypto.randomUUID?.() ||
  [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
const dateS = (d = new Date()) => d.toISOString().split('T')[0];
const ts   = () => Date.now();

// ── 3. Visitor Manager ─────────────────────────────────────────
const VID = 'gjs_vid';
const getVid = () => {
  let v = localStorage.getItem(VID);
  if (!v) { v = uid(); localStorage.setItem(VID, v); }
  return v;
};

const recordVisitor = async () => {
  if (!ok()) return { isNew: false };
  try {
    const vid = getVid();
    const snap = await get(ref(`visitors/${vid}`));
    const old = snap?.val() || null;
    const data = {
      firstVisit: old?.firstVisit || ts(),
      lastVisit: ts(),
      visits: (old?.visits || 0) + 1,
      device: detect.device(),
      browser: detect.browser(),
      os: detect.os()
    };
    await set(ref(`visitors/${vid}`), data);
    return { ...data, isNew: !old };
  } catch (e) {
    console.warn('Analytics: recordVisitor error', e.message);
    return { isNew: false };
  }
};

// ── 4. Session Manager ───────────────────────────────────────────
const SID = 'gjs_sid', SID_T = 'gjs_sid_t', SID_P = 'gjs_sid_p', SID_B = 'gjs_sid_b';
const S_TIMEOUT = 30 * 60 * 1000;
let sessionEnded = false;

const getSid = () => {
  let s = sessionStorage.getItem(SID);
  let t = parseInt(sessionStorage.getItem(SID_T) || '0');
  if (!s || (ts() - t > S_TIMEOUT)) {
    s = uid();
    sessionStorage.setItem(SID, s);
    sessionStorage.setItem(SID_T, String(ts()));
    sessionStorage.setItem(SID_P, '[]');
    sessionStorage.setItem(SID_B, 'true');
  }
  return s;
};

const addPage = (page) => {
  let p = JSON.parse(sessionStorage.getItem(SID_P) || '[]');
  if (!p.includes(page)) {
    p.push(page);
    sessionStorage.setItem(SID_P, JSON.stringify(p));
    if (p.length > 1) sessionStorage.setItem(SID_B, 'false');
  }
};

const endSession = async () => {
  if (sessionEnded || !ok()) return;
  sessionEnded = true;
  const pages = JSON.parse(sessionStorage.getItem(SID_P) || '[]');
  set(ref(`sessions/${getSid()}`), {
    visitorId: getVid(),
    startTime: parseInt(sessionStorage.getItem(SID_T) || '0'),
    endTime: ts(),
    pages,
    bounced: sessionStorage.getItem(SID_B) === 'true',
    duration: Math.round((ts() - parseInt(sessionStorage.getItem(SID_T) || '0')) / 1000),
    device: detect.device(),
    browser: detect.browser(),
    os: detect.os()
  });
  sessionStorage.removeItem(SID);
  sessionStorage.removeItem(SID_T);
  sessionStorage.removeItem(SID_P);
  sessionStorage.removeItem(SID_B);
};

// ── 5. Device / Browser / OS / Source Detection ────────────────
const detect = {
  device() {
    const u = navigator.userAgent;
    if (/Mobi|Android.*Mobile/i.test(u)) return 'Mobile';
    if (/Tablet|iPad/i.test(u)) return 'Tablet';
    return 'Desktop';
  },
  browser() {
    const u = navigator.userAgent;
    if (u.includes('Firefox')) return 'Firefox';
    if (u.includes('Edg/')) return 'Edge';
    if (u.includes('OPR/') || u.includes('Opera')) return 'Opera';
    if (u.includes('Chrome')) return 'Chrome';
    if (u.includes('Safari')) return 'Safari';
    return 'Other';
  },
  os() {
    const u = navigator.userAgent;
    if (u.includes('Windows')) return 'Windows';
    if (u.includes('Mac OS')) return 'macOS';
    if (u.includes('Android')) return 'Android';
    if (/iPhone|iPad/.test(u)) return 'iOS';
    if (u.includes('Linux')) return 'Linux';
    return 'Other';
  },
  source() {
    const r = document.referrer;
    if (!r) return 'direct';
    try {
      const h = new URL(r).hostname;
      if (/google|bing|yahoo|duckduckgo/i.test(h)) return 'organic';
      if (/facebook|instagram|twitter|tiktok|linkedin|youtube/i.test(h)) return 'social';
    } catch {}
    return 'referral';
  }
};

// ── 6. Event Buffer ──────────────────────────────────────────────
let buf = [];
const FLUSH_MS = 15000;

const addEvt = (e) => { buf.push(e); if (buf.length >= 25) flushBuf(); };

const flushBuf = async () => {
  if (!ok() || !buf.length) return;
  const batch = buf.splice(0);
  const d = dateS();
  await Promise.all(batch.map(e => set(push(ref(`events/${d}`)), e)));
};

setInterval(flushBuf, FLUSH_MS);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushBuf(); });

// ── 7. Core Tracking ────────────────────────────────────────────
const trackPV = async () => {
  try {
    const page = location.pathname + location.hash;
    const sid = getSid();
    const v = await recordVisitor();
    addPage(page);
    addEvt({
      type: 'pv', page, timestamp: ts(), visitorId: getVid(),
      sessionId: sid, device: detect.device(), browser: detect.browser(),
      os: detect.os(), source: detect.source(), isNewVisitor: v.isNew
    });
  } catch (e) {
    console.warn('Analytics: trackPV error', e.message);
  }
};

const track = (type, label = '', value = '') => {
  addEvt({
    type, page: location.pathname, label, value, timestamp: ts(),
    visitorId: getVid(), sessionId: getSid(), device: detect.device()
  });
};

// ── 8. Auto-Track Interactions ───────────────────────────────────
document.addEventListener('click', (e) => {
  // Elements with data-track attribute
  const el = e.target.closest('[data-track]');
  if (el) {
    track(el.dataset.track, el.dataset.trackLabel || el.textContent?.trim().slice(0, 60) || '');
  }
  // Downloads
  const dl = e.target.closest('a[download]');
  if (dl) track('dl', dl.getAttribute('download') || dl.href?.split('/').pop() || 'download');
  const pdf = e.target.closest('a[href$=".pdf"], a[href*=".pdf"]');
  if (pdf) track('dl', pdf.href?.split('/').pop() || 'pdf-download');
}, true);

// Form submissions
document.addEventListener('submit', (e) => {
  const id = e.target.id || 'form';
  track('submit', id);
}, true);

// JS errors
const _origErr = window.onerror;
window.onerror = (msg, src, line) => {
  const errs = JSON.parse(sessionStorage.getItem('gjs_err') || '[]');
  errs.push({ message: String(msg).slice(0, 200), source: src, line, time: ts() });
  if (errs.length > 100) errs.splice(0, errs.length - 100);
  sessionStorage.setItem('gjs_err', JSON.stringify(errs));
  if (_origErr) _origErr(msg, src, line);
};

// ── 9. Real-time Presence ──────────────────────────────────────
const setupRealtime = () => {
  if (!ok()) return;
  const sid = getSid();
  const pRef = ref(`rt/v/${sid}`);

  set(pRef, { page: location.pathname, device: detect.device(), lastSeen: ts() });
  onDisc(pRef).remove();

  setInterval(() => set(pRef, { page: location.pathname, device: detect.device(), lastSeen: ts() }), 30000);

  // Recent activity
  const addRecent = (type, label = '') => {
    set(push(ref('rt/recent')), { type, label: label || location.pathname, page: location.pathname, device: detect.device(), timestamp: ts() });
  };
  addRecent('pv', document.title);

  window.GJSAnalytics._addRecent = addRecent;
};

// ── 10. Admissions Reader ────────────────────────────────────────
const setupAdmissions = () => {
  if (!ok()) return;
  onVal(ref('admissions/applications'), (snap) => {
    const apps = snap.val();
    if (!apps) return;
    const c = { total: 0, Pending: 0, Approved: 0, Rejected: 0, byClass: {}, byMonth: {} };
    Object.values(apps).forEach(a => {
      c.total++;
      c[a.status] = (c[a.status] || 0) + 1;
      if (a.classApplied) c.byClass[a.classApplied] = (c.byClass[a.classApplied] || 0) + 1;
      if (a.submittedAt) { const m = a.submittedAt.slice(0, 7); c.byMonth[m] = (c.byMonth[m] || 0) + 1; }
    });
    set(ref('analytics/admissions'), c);
  });
};

// ── 11. Contact Reader ────────────────────────────────────────────
const setupContacts = () => {
  if (!ok()) return;
  onVal(ref('contacts/messages'), (snap) => {
    const msgs = snap.val();
    if (!msgs) return;
    set(ref('analytics/contacts'), { total: Object.keys(msgs).length });
  });
};

// ── 12. System Health ────────────────────────────────────────────
const checkHealth = async () => {
  if (!ok()) return;
  const t0 = ts();
  try {
    await get(ref('system/health')); // Connectivity test
    const latency = ts() - t0;
    const errs = JSON.parse(sessionStorage.getItem('gjs_err') || '[]');
    set(ref('system/health'), { status: 'ok', lastCheck: ts(), latency, errors: errs.slice(-50), online: navigator.onLine });
  } catch (e) {
    if (ok()) set(ref('system/health'), { status: 'error', lastCheck: ts(), errors: [{ message: e.message, time: ts() }], online: navigator.onLine });
  }
};

setTimeout(checkHealth, 3000);
setInterval(checkHealth, 300000);

// ── 13. Security Monitor ────────────────────────────────────────
const setupSecurity = () => {
  if (!ok()) return;
  let submits = [];
  document.addEventListener('submit', () => {
    const now = ts();
    submits = submits.filter(t => now - t < 10000);
    if (submits.length >= 5) {
      set(push(ref('sys/sec/suspicious')), { type: 'rapid_submit', page: location.pathname, count: submits.length, timestamp: ts() });
    }
  }, true);
};

// ── 14. Public API (for Dashboard page) ─────────────────────────
window.GJSAnalytics = {
  getVid, getSid, track, flush: flushBuf, endSession,

  // --- Visitors ---
  getVisitors: async (s, e = dateS()) => {
    if (!ok()) return [];
    const [a, b] = [new Date(s).getTime(), new Date(e + 'T23:59:59').getTime()];
    const snap = await get(ref('visitors'));
    return Object.entries(snap?.val() || {}).filter(([, v]) => v.lastVisit >= a && v.lastVisit <= b).map(([id, v]) => ({ id, ...v }));
  },

  // --- Sessions ---
  getSessions: async (s, e = dateS()) => {
    if (!ok()) return [];
    const [a, b] = [new Date(s).getTime(), new Date(e + 'T23:59:59').getTime()];
    const snap = await get(ref('sessions'));
    return Object.entries(snap?.val() || {}).filter(([, v]) => v.startTime >= a && v.startTime <= b).map(([id, v]) => ({ id, ...v }));
  },

  // --- Events (optimized: reads index first) ---
  getEvents: async (s, e = dateS()) => {
    if (!ok()) return [];
    const [a, b] = [new Date(s).getTime(), new Date(e + 'T23:59:59').getTime()];
    const idxSnap = await get(ref('events'));
    const dates = (idxSnap?.val() ? Object.keys(idxSnap.val()) : []).filter(d => {
      const t = new Date(d + 'T12:00:00').getTime();
      return t >= a && t <= b;
    });
    const results = [];
    for (const d of dates) {
      const snap = await get(ref(`events/${d}`));
      Object.values(snap?.val() || {}).forEach(ev => { if (ev.timestamp >= a && ev.timestamp <= b) results.push(ev); });
    }
    return results;
  },

  // --- Aggregates ---
  getPageViews:   async (s, e) => { const ev = await window.GJSAnalytics.getEvents(s, e); const m = {}; ev.filter(x => x.type === 'pv').forEach(x => { m[x.page] = (m[x.page] || 0) + 1; }); return m; },
  getDeviceStats:  async (s, e) => { const ev = await window.GJSAnalytics.getEvents(s, e); const m = {}; ev.forEach(x => { m[x.device] = (m[x.device] || 0) + 1; }); return m; },
  getBrowserStats: async (s, e) => { const ev = await window.GJSAnalytics.getEvents(s, e); const m = {}; ev.forEach(x => { m[x.browser] = (m[x.browser] || 0) + 1; }); return m; },
  getOSStats:       async (s, e) => { const ev = await window.GJSAnalytics.getEvents(s, e); const m = {}; ev.forEach(x => { m[x.os] = (m[x.os] || 0) + 1; }); return m; },
  getSourceStats:   async (s, e) => { const ev = await window.GJSAnalytics.getEvents(s, e); const m = {}; ev.forEach(x => { const k = x.source || 'direct'; m[k] = (m[k] || 0) + 1; }); return m; },
  getInteractions: async (type, s, e) => { const ev = await window.GJSAnalytics.getEvents(s, e); return type ? ev.filter(x => x.type === type) : ev.filter(x => x.type !== 'pv' && x.type !== 'error'); },

  // --- Computed metrics ---
  getUniqueVisitors: async (s, e) => { const ev = await window.GJSAnalytics.getEvents(s, e); return new Set(ev.map(x => x.visitorId)).size; },
  getReturningVisitors: async (s, e) => { const ev = await window.GJSAnalytics.getEvents(s, e); return ev.filter(x => !x.isNewVisitor).map(x => x.visitorId).filter((v, i, a) => a.indexOf(v) === i).length; },
  getTotalPV:       async (s, e) => (await window.GJSAnalytics.getEvents(s, e)).filter(x => x.type === 'pv').length,
  getBounceRate:     async (s, e) => { const ss = await window.GJSAnalytics.getSessions(s, e); return ss.length ? Math.round(ss.filter(s => s.bounced).length / ss.length * 1000) / 10 : 0; },
  getAvgDuration:    async (s, e) => { const ss = await window.GJSAnalytics.getSessions(s, e); return ss.length ? Math.round(ss.reduce((a, s) => a + (s.duration || 0), 0) / ss.length) : 0; },

  // --- Real-time ---
  getRealtime: async () => {
    if (!ok()) return { visitors: 0, recent: [] };
    const [vSnap, rSnap] = await Promise.all([get(ref('rt/v')), get(ref('rt/recent'))]);
    const vd = vSnap?.val() || {};
    const threshold = ts() - 90000;
    const active = Object.values(vd).filter(v => v.lastSeen >= threshold).length;
    const recent = Object.values(rSnap?.val() || {}).sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
    return { visitors: active, recent };
  },

  // --- Saved analytics ---
  getAdmissions: async () => { if (!ok()) return null; const s = await get(ref('analytics/admissions')); return s?.val(); },
  getContacts:   async () => { if (!ok()) return null; const s = await get(ref('analytics/contacts')); return s?.val(); },
  getHealth:     async () => { if (!ok()) return null; const s = await get(ref('system/health')); return s?.val(); },
  getSecurity:   async () => { if (!ok()) return []; const s = await get(ref('sys/sec')); const d = s?.val() || {}; const l = []; if (d.loginAttempts) l.push(d); if (d.failedLogins) l.push(d); if (d.suspicious) Object.values(d.suspicious).forEach(x => l.push(x)); if (d.adminLog) Object.values(d.adminLog).forEach(x => l.push(x)); return l.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); },

  // --- Time helpers ---
  _dateRange(period) {
    const end = new Date(); const s = new Date();
    switch (period) {
      case 'today':     s.setHours(0,0,0,0); break;
      case 'yesterday': s.setDate(s.getDate() - 1); s.setHours(0,0,0,0); break;
      case '7d':  s.setDate(s.getDate() - 7);  s.setHours(0,0,0,0); break;
      case '30d': s.setDate(s.getDate() - 30); s.setHours(0,0,0,0); break;
      case '90d': s.setDate(s.getDate() - 90); s.setHours(0,0,0,0); break;
      case 'year': s = new Date(s.getFullYear(), 0, 1); break;
      default:      s.setDate(s.getDate() - 30); s.setHours(0,0,0,0);
    }
    return { start: s.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  },

  // --- Quick stat getters ---
  getTodayStats: async () => { const { start, end } = window.GJSAnalytics._dateRange('today'); return { pageViews: await window.GJSAnalytics.getTotalPV(start, end), uniqueVisitors: await window.GJSAnalytics.getUniqueVisitors(start, end), visitors: await window.GJSAnalytics.getVisitors(start, end), bounceRate: await window.GJSAnalytics.getBounceRate(start, end), avgDuration: await window.GJSAnalytics.getAvgDuration(start, end), devices: await window.GJSAnalytics.getDeviceStats(start, end), browsers: await window.GJSAnalytics.getBrowserStats(start, end), os: await window.GJSAnalytics.getOSStats(start, end), sources: await window.GJSAnalytics.getSourceStats(start, end) }; },

  getPeriodStats: async (period) => {
    const { start, end } = window.GJSAnalytics._dateRange(period || '30d');
    return { start, end, pageViews: await window.GJSAnalytics.getTotalPV(start, end), uniqueVisitors: await window.GJSAnalytics.getUniqueVisitors(start, end), visitors: await window.GJSAnalytics.getVisitors(start, end), bounceRate: await window.GJSAnalytics.getBounceRate(start, end), avgDuration: await window.GJSAnalytics.getAvgDuration(start, end), devices: await window.GJSAnalytics.getDeviceStats(start, end), browsers: await window.GJSAnalytics.getBrowserStats(start, end), os: await window.GJSAnalytics.getOSStats(start, end), sources: await window.GJSAnalytics.getSourceStats(start, end) };
  },

  // Custom range
  getCustomRange: async (start, end) => {
    const s = new Date(start).toISOString().split('T')[0];
    const e = new Date(end).toISOString().split('T')[0];
    return { start: s, end: e, pageViews: await window.GJSAnalytics.getTotalPV(s, e), uniqueVisitors: await window.GJSAnalytics.getUniqueVisitors(s, e), visitors: await window.GJSAnalytics.getVisitors(s, e), bounceRate: await window.GJSAnalytics.getBounceRate(s, e), avgDuration: await window.GJSAnalytics.getAvgDuration(s, e), devices: await window.GJSAnalytics.getDeviceStats(s, e), browsers: await window.GJSAnalytics.getBrowserStats(s, e), os: await window.GJSAnalytics.getOSStats(s, e), sources: await window.GJSAnalytics.getSourceStats(s, e) };
  }
};

// ── 15. Initialize ──────────────────────────────────────────────
const init = async () => {
  await recordVisitor();
  await trackPV();
  setupRealtime();
  setupAdmissions();
  setupContacts();
  setupSecurity();
};

init();

// ── 16. Cleanup ──────────────────────────────────────────────────
window.addEventListener('beforeunload', () => { flushBuf(); endSession(); });