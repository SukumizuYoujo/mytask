// src/firebase.js
import 'dotenv/config'
import { initializeApp } from 'firebase/app'
import { getAuth }        from 'firebase/auth'
import { getFirestore }   from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            process.FIREBASE_API_KEY,
  authDomain:        process.FIREBASE_AUTH_DOMAIN,
  projectId:         process.FIREBASE_PROJECT_ID,
  storageBucket:     process.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.FIREBASE_APP_ID
}

const app  = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)

