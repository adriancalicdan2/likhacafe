// ==============================================================================
// LIKHĀ CAFÉ - CLIENT-SIDE ENVIRONMENT CONFIGURATION
// Loads environment variables for Firebase & APIs
// ==============================================================================

const ENV = {
  FIREBASE_API_KEY: window.__ENV__?.FIREBASE_API_KEY || "AIzaSyAfsU0PoCG87q0KLN0aUKavIgVC80c3i4Y",
  FIREBASE_AUTH_DOMAIN: window.__ENV__?.FIREBASE_AUTH_DOMAIN || "likha-cafe.firebaseapp.com",
  FIREBASE_PROJECT_ID: window.__ENV__?.FIREBASE_PROJECT_ID || "likha-cafe",
  FIREBASE_STORAGE_BUCKET: window.__ENV__?.FIREBASE_STORAGE_BUCKET || "likha-cafe.firebasestorage.app",
  FIREBASE_MESSAGING_SENDER_ID: window.__ENV__?.FIREBASE_MESSAGING_SENDER_ID || "695779096906",
  FIREBASE_APP_ID: window.__ENV__?.FIREBASE_APP_ID || "1:695779096906:web:0172169f320aad7bd569b3",
  FIREBASE_MEASUREMENT_ID: window.__ENV__?.FIREBASE_MEASUREMENT_ID || "G-HEPPPYG2NJ"
};

export { ENV };
export default ENV;
