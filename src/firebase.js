// src/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "__VITE_API_KEY__",
  authDomain: "__VITE_AUTH_DOMAIN__",
  databaseURL: "__VITE_DATABASE_URL__",
  projectId: "__VITE_PROJECT_ID__",
  storageBucket: "__VITE_STORAGE_BUCKET__",
  messagingSenderId: "__VITE_MESSAGING_SENDER_ID__",
  appId: "__VITE_APP_ID__",
  measurementId: "__VITE_MEASUREMENT_ID__"
};

const app  = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)






