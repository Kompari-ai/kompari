import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDwx5YKQE_ZV6zRrR35U1sURm5uNQA1o5A",
  authDomain: "kompari-48dba.firebaseapp.com",
  projectId: "kompari-48dba",
  storageBucket: "kompari-48dba.firebasestorage.app",
  messagingSenderId: "598381930414",
  appId: "1:598381930414:web:d102c6cb99c59ac2cc8a3f",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);