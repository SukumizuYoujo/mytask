// src/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPjTnVSjSurZh-C7CfbhFEOHw6XUen728",
  authDomain: "mytask-4b2a5.firebaseapp.com",
  databaseURL: "https://mytask-4b2a5-default-rtdb.firebaseio.com",
  projectId: "mytask-4b2a5",
  storageBucket: "mytask-4b2a5.firebasestorage.app",
  messagingSenderId: "544411020801",
  appId: "1:544411020801:web:a76d4d925865dedebf1a00",
  measurementId: "G-LE0B6P60L3"
};

const app  = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)





