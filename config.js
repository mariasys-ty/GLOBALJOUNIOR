/* =============================================
   config.js
   Initializes Firebase and exports the 
   database instance for other scripts.
   
   ⚠️ IMPORTANT: This file MUST be loaded in 
   your HTML with type="module":
   <script type="module" src="config.js"></script>
   ============================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDP_fI2bIlFhlrT1uNtPPAHc4X5x-4eydM",
  authDomain: "global-junior-13195.firebaseapp.com",
  databaseURL: "https://global-junior-13195-default-rtdb.firebaseio.com", // ← This was missing!
  projectId: "global-junior-13195",
  storageBucket: "global-junior-13195.firebasestorage.app",
  messagingSenderId: "740043056261",
  appId: "1:740043056261:web:707b994eb4f5a7f59a35ec",
  measurementId: "G-EGPG6FKRBZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
const db = getDatabase(app);

// Export db and app so your other module scripts (like staff.js) can use them
export { db, app };