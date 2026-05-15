import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB2Gq4Q5VMPqrj0ln5dJozWbUw-we7MqRs",
  authDomain: "rosdb-a66c8.firebaseapp.com",
  projectId: "rosdb-a66c8",
  storageBucket: "rosdb-a66c8.firebasestorage.app",
  messagingSenderId: "498125088357",
  appId: "1:498125088357:web:07a1c3f6673e49f657c88c",
  measurementId: "G-JBHMD8N6QK"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const loginAnonymously = async () => {
  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.error("Anonymous auth failed:", error);
  }
};
