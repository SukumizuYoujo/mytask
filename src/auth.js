// src/auth.js
import { GoogleAuthProvider, signInWithPopup, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { auth } from './firebase.js';

// Handles Google Popup Sign-In
export async function handleGoogleLogin() {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Google login error:", error);
        alert("Googleログインに失敗しました。");
    }
}

// Handles Anonymous/Guest Sign-In
export async function handleGuestLogin() {
    try {
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Anonymous login error:", error);
        alert("ゲストログインに失敗しました。");
    }
}