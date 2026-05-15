import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAGJRM0Zq_U1uaQV25eJQsLZueITMjDbIA",
  authDomain: "checklist-qualidade-7bdf3.firebaseapp.com",
  projectId: "checklist-qualidade-7bdf3",
  storageBucket: "checklist-qualidade-7bdf3.firebasestorage.app",
  messagingSenderId: "154335831153",
  appId: "1:154335831153:web:52c8260fe05e022ed827d0",
  measurementId: "G-4K7D8HTQXF",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
