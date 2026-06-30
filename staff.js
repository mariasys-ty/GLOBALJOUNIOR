import { db } from './config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

/* ---------- Fallback avatar SVG ---------- */
const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='110' height='110' fill='%23d1d5db'%3E%3Crect width='110' height='110' rx='55'/%3E%3Ctext x='55' y='62' text-anchor='middle' fill='%239ca3af' font-size='36'%3E%3F%3C/text%3E%3C/svg%3E";

/* ---------- DOM refs ---------- */
const getGrid = () => document.getElementById("staff-grid");
const getSkeleton = () => document.getElementById("staff-skeleton");
const getEmpty = () => document.getElementById("staff-empty");
const getError = () => document.getElementById("staff-error");

/* ---------- State toggle ---------- */
function setState(state) {
  const sk = getSkeleton();
  const em = getEmpty();
  const er = getError();
  
  if (sk) sk.style.display = state === "loading" ? "contents" : "none";
  if (em) em.style.display = state === "empty" ? "block" : "none";
  if (er) er.style.display = state === "error" ? "block" : "none";
}

/* ---------- Build one card ---------- */
function buildCard(m) {
  const card = document.createElement("div");
  card.className = "staff-card";
  
  const wrap = document.createElement("div");
  wrap.className = "staff-card__photo-wrap";
  
  const img = document.createElement("img");
  img.className = "staff-card__photo";
  img.src = m.photo || FALLBACK_IMG;
  img.alt = m.name || "Staff member";
  img.loading = "lazy";
  img.onerror = function() { this.src = FALLBACK_IMG; };
  
  wrap.appendChild(img);
  
  const name = document.createElement("h3");
  name.className = "staff-card__name";
  name.textContent = m.name || "Unknown";
  
  const pos = document.createElement("p");
  pos.className = "staff-card__position";
  pos.textContent = m.position || "";
  
  const dept = document.createElement("span");
  dept.className = "staff-card__department";
  dept.textContent = m.department || "";
  
  card.appendChild(wrap);
  card.appendChild(name);
  card.appendChild(pos);
  card.appendChild(dept);
  
  return card;
}

/* ---------- Main fetch ---------- */
async function fetchStaff() {
  const grid = getGrid();
  if (!grid) {
    console.warn("[staff.js] #staff-grid not found.");
    return;
  }
  
  if (!db) {
    console.error("[staff.js] Database not initialized. Check config.js.");
    setState("error");
    return;
  }
  
  setState("loading");
  
  try {
    // FIXED: Updated path to match your exact Firebase structure
    const staffRef = ref(db, "admin/staff/profiles");
    const snapshot = await get(staffRef);
    
    // Clear old cards
    grid.querySelectorAll(".staff-card").forEach(c => c.remove());
    
    if (!snapshot.exists()) {
      setState("empty");
      return;
    }
    
    const data = snapshot.val();
    const list = Object.values(data);
    
    if (list.length === 0) {
      setState("empty");
      return;
    }
    
    setState("none");
    
    // Alphabetical sort
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    
    list.forEach(member => grid.appendChild(buildCard(member)));
  } catch (err) {
    console.error("[staff.js] Fetch failed:", err);
    setState("error");
  }
}

/* ---------- Boot ---------- */
// FIXED: ES Modules are deferred, so the DOM is already ready.
// We must check if it's still loading before adding the event listener.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fetchStaff);
} else {
  fetchStaff(); // DOM is already ready, run immediately
}