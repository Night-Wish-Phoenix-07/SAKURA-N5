import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { LESSONS } from "./lessons.js";
import { isAdmin } from "./auth.js";

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let user = null;
let progress = {};

const completed = () => progress.completed || {};
const quizScores = () => progress.quizScores || {};
const mocks = () => (progress.mockResults || []).slice().sort((a, b) => b.date - a.date);
const countDone = (vol) =>
  LESSONS.filter((l) => (!vol || l.volume === vol) && completed()[l.id]).length;

function render() {
  const done = countDone();
  const pct = Math.round((done / LESSONS.length) * 100);
  const qs = LESSONS.filter((l) => quizScores()[l.id]);
  const avg = qs.length
    ? Math.round(qs.reduce((s, l) => s + Number(quizScores()[l.id].best || 0), 0) / qs.length)
    : null;
  const m = mocks();
  const bestMock = m.length ? Math.max(...m.map((x) => x.pct)) : null;

  $("sDone").textContent = done + "/" + LESSONS.length;
  $("sPct").textContent = pct + "%";
  $("sQuiz").textContent = qs.length;
  $("sAvg").textContent = avg === null ? "–" : avg + "%";
  $("sMock").textContent = m.length;
  $("sBest").textContent = bestMock === null ? "–" : bestMock + "%";
  $("barFill").style.width = pct + "%";

  // Achievements (same list as the dashboard)
  const badges = [
    ["🌱 First lesson", done >= 1],
    ["📘 Five lessons", done >= 5],
    ["🏯 Elementary 1 complete", countDone(1) === 12],
    ["🌸 Elementary 2 complete", countDone(2) === 13],
    ["🎌 All 25 lessons", done === LESSONS.length],
    ["📝 First mock exam", m.length >= 1],
    ["🎯 80% or more on a mock exam", m.some((x) => x.pct >= 80)]
  ];
  const earned = badges.filter((b) => b[1]).length;
  $("badgeCount").textContent = earned + " of " + badges.length + " earned";
  $("badges").innerHTML = "";
  badges.forEach(([label, ok]) =>
    $("badges").append(el("div", "badge" + (ok ? " earned" : ""), label)));

  // Lessons to review: quiz best under 60%
  const weak = qs.filter((l) => Number(quizScores()[l.id].best) < 60);
  const rv = $("review");
  rv.innerHTML = "";
  if (!qs.length) {
    rv.append(el("p", "", "Take a lesson quiz and your weaker lessons will show up here."));
  } else if (!weak.length) {
    rv.append(el("p", "", "Nice! Every quiz you've taken is at 60% or higher. 🌸"));
  } else {
    const box = el("div", "badges");
    weak.forEach((l) => {
      const a = el("a", "badge", "Lesson " + l.id + " · " + l.title + " · " + quizScores()[l.id].best + "%");
      a.href = "quizzes.html?id=" + l.id;
      box.append(a);
    });
    rv.append(box);
  }

  // Recent mock exams
  const mb = $("mockList");
  mb.innerHTML = "";
  if (!m.length) mb.append(el("p", "", "No mock exams taken yet."));
  m.slice(0, 5).forEach((r) =>
    mb.append(el("p", "", new Date(r.date).toLocaleDateString() + " — " +
      r.score + "/" + r.total + " (" + r.pct + "%)")));

  // Next step
  const next = LESSONS.find((l) => !completed()[l.id]);
  const btn = $("continueBtn");
  if (next) {
    btn.textContent = "Continue: Lesson " + next.id + " · " + next.title;
    btn.href = "lessons.html?id=" + next.id;
  } else {
    btn.textContent = "All lessons complete! 🎉";
    btn.href = "../index.html#lessons";
  }
}

$("resetBtn").addEventListener("click", async () => {
  if (!user) return;
  if (!confirm("Reset ALL your progress, quiz scores and mock exam results? This cannot be undone.")) return;
  $("resetBtn").disabled = true;
  try {
    await setDoc(doc(db, "userProgress", user.uid), {
      completed: {}, quizScores: {}, mockResults: [], updatedAt: serverTimestamp()
    });
    progress = { completed: {}, quizScores: {}, mockResults: [] };
    render();
    $("resetMsg").textContent = "Your progress has been reset.";
  } catch (e) {
    $("resetMsg").textContent = "Could not reset: " + e.message;
  }
  $("resetBtn").disabled = false;
});

$("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  location.href = "../index.html";
});

onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = "../index.html"; return; }
  user = u;

  $("pName").textContent = u.displayName || "Student";
  $("pEmail").textContent = u.email || "";
  if (u.photoURL) { $("avatar").src = u.photoURL; $("avatar").hidden = false; }
  $("adminLink").hidden = !(await isAdmin(u.uid));

  try {
    const p = await getDoc(doc(db, "userProgress", u.uid));
    progress = p.exists() ? p.data() : {};
  } catch (e) {
    $("loadMsg").textContent = "Could not load your progress: " + e.message;
  }

  // "Member since" comes from the date their profile was created
  try {
    const s = await getDoc(doc(db, "users", u.uid));
    const t = s.exists() && s.data().createdAt;
    if (t && t.toDate) $("pSince").textContent = "Member since " + t.toDate().toLocaleDateString();
  } catch (e) { /* optional */ }

  render();
});
