import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { LESSONS } from "./lessons.js";
import { isAdmin } from "./auth.js";

const $ = (id) => document.getElementById(id);

/* ---------- Firestore helpers (reused by lesson pages later) ---------- */
export async function getProgress(uid) {
  const snap = await getDoc(doc(db, "userProgress", uid));
  return snap.exists() ? (snap.data().completed || {}) : {};
}

export async function setLessonDone(uid, lessonId, done) {
  await setDoc(
    doc(db, "userProgress", uid),
    { completed: { [lessonId]: done }, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/* ---------- Dashboard rendering ---------- */
let completed = {};
let currentUser = null;

function countDone(volume) {
  return LESSONS.filter((l) => (!volume || l.volume === volume) && completed[l.id]).length;
}

function renderStats() {
  const total = LESSONS.length;
  const done = countDone();
  const pct = Math.round((done / total) * 100);
  $("statDone").textContent = done;
  $("statPct").textContent = pct + "%";
  $("statV1").textContent = countDone(1) + "/12";
  $("statV2").textContent = countDone(2) + "/13";
  $("barFill").style.width = pct + "%";

  const next = LESSONS.find((l) => !completed[l.id]);
  const btn = $("continueBtn");
  if (next) {
    btn.textContent = "Continue: Lesson " + next.id + " · " + next.title;
    btn.href = "lessons.html?id=" + next.id;
  } else {
    btn.textContent = "All lessons complete! 🎉";
    btn.href = "../index.html#lessons";
  }
}

function renderAchievements() {
  const list = [
    ["🌱 First lesson", countDone() >= 1],
    ["📘 Five lessons", countDone() >= 5],
    ["🏯 Elementary 1 complete", countDone(1) === 12],
    ["🌸 Elementary 2 complete", countDone(2) === 13],
    ["🎌 All 25 lessons", countDone() === LESSONS.length]
  ];
  $("achievements").innerHTML = "";
  list.forEach(([label, earned]) => {
    const d = document.createElement("div");
    d.className = "badge" + (earned ? " earned" : "");
    d.textContent = label;
    $("achievements").appendChild(d);
  });
}

function renderLessons() {
  $("list1").innerHTML = "";
  $("list2").innerHTML = "";
  LESSONS.forEach((l) => {
    const c = document.createElement("div");
    c.className = "card lesson-card" + (completed[l.id] ? " done" : "");

    const a = document.createElement("a");
    a.href = "lessons.html?id=" + l.id;
    a.innerHTML = '<span class="num"></span><h3></h3><p></p>';
    a.querySelector(".num").textContent = "LESSON " + String(l.id).padStart(2, "0");
    a.querySelector("h3").textContent = l.title;
    a.querySelector("p").textContent = l.topic;

    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!completed[l.id];
    cb.addEventListener("change", async () => {
      cb.disabled = true;
      try {
        await setLessonDone(currentUser.uid, l.id, cb.checked);
        completed[l.id] = cb.checked;
        refresh();
      } catch (e) {
        cb.checked = !cb.checked;
        alert("Could not save progress: " + e.message);
      }
      cb.disabled = false;
    });
    label.append(cb, " Mark as completed");

    c.append(a, label);
    (l.volume === 1 ? $("list1") : $("list2")).appendChild(c);
  });
}

function refresh() {
  renderStats();
  renderAchievements();
  renderLessons();
}

$("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "../index.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!$("greeting")) return;            // not on the dashboard page
  if (!user) { location.href = "../index.html"; return; }
  currentUser = user;

  $("greeting").textContent = "ようこそ, " + (user.displayName || "student") + "!";
  if (user.photoURL) { $("avatar").src = user.photoURL; $("avatar").hidden = false; }
  $("adminLink").hidden = !(await isAdmin(user.uid));

  try { completed = await getProgress(user.uid); }
  catch (e) { alert("Could not load progress: " + e.message); }
  refresh();
});
