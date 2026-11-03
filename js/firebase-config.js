import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyANwAQtQYf3u_fd5hfJXoub4R2vgQ4Krxk",
  authDomain: "sakura-n5-a27b7.firebaseapp.com",
  projectId: "sakura-n5-a27b7",
  storageBucket: "sakura-n5-a27b7.firebasestorage.app",
  messagingSenderId: "711158964624",
  appId: "1:711158964624:web:fd90aef8c525116cf95315"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
