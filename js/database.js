import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc,
  query, where, writeBatch, serverTimestamp
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

// Creates any missing lesson records. Never overwrites lessons you already edited.
export async function seedLessons(lessons) {
  const snap = await getDocs(collection(db, "lessons"));
  const existing = new Set(snap.docs.map((d) => d.id));
  const batch = writeBatch(db);
  let created = 0;
  lessons.forEach((l) => {
    if (existing.has(String(l.id))) return;
    batch.set(doc(db, "lessons", String(l.id)), {
      id: l.id, title: l.title, topic: l.topic, volume: l.volume,
      summary: l.summary || "", practice: "", updatedAt: serverTimestamp()
    });
    created++;
  });
  if (created) await batch.commit();
  return created;
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
export async function getAll(col) {
  const snap = await getDocs(collection(db, col));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Deletes a lesson's saved record and all its vocabulary, grammar, kanji and quiz items
export async function deleteLessonContent(lessonId) {
  const batch = writeBatch(db);
  for (const col of ["vocabulary", "grammar", "kanji", "quizzes"]) {
    const items = await getItems(col, lessonId);
    items.forEach((it) => batch.delete(doc(db, col, it.id)));
  }
  batch.delete(doc(db, "lessons", String(lessonId)));
  await batch.commit();
}
