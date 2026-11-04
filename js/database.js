import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function getLessonDoc(id) {
  const snap = await getDoc(doc(db, "lessons", String(id)));
  return snap.exists() ? snap.data() : null;
}

export function saveLessonDoc(id, data) {
  return setDoc(
    doc(db, "lessons", String(id)),
    { ...data, id: Number(id), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function getItems(col, lessonId) {
  const q = query(collection(db, col), where("lessonId", "==", Number(lessonId)));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
}

export function addItem(col, lessonId, data) {
  return addDoc(collection(db, col), {
    ...data, lessonId: Number(lessonId), createdAt: serverTimestamp()
  });
}

export function updateItem(col, itemId, data) {
  return setDoc(doc(db, col, itemId), data, { merge: true });
}

export function removeItem(col, itemId) {
  return deleteDoc(doc(db, col, itemId));
}
