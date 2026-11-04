import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getCountFromServer }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { LESSONS } from "./lessons.js";
import { isAdmin } from "./auth.js";
import { getAll, seedLessons, deleteLessonContent } from "./database.js";

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

$("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  location.href = "../index.html";
});

async function load() {
  $("status").textContent = "Loading...";
  let data;
  try {
    data = await Promise.all(
      ["vocabulary", "grammar", "kanji", "quizzes", "lessons", "userProgress"].map(getAll)
    );
  } catch (e) {
    $("status").textContent = "Could not load data: " + e.message;
    return;
  }
  const [vocab, grammar, kanji, quizzes, lessonDocs, progress] = data;

  let students = null;
  try {
    students = (await getCountFromServer(collection(db, "users"))).data().count;
  } catch {}

  // Completion tallies
  const tally = {};
  let totalDone = 0, activeStudents = 0;
  progress.forEach((p) => {
    const entries = Object.entries(p.completed || {}).filter(([, v]) => v);
    if (entries.length) activeStudents++;
    entries.forEach(([k]) => { tally[k] = (tally[k] || 0) + 1; totalDone++; });
  });

  // Stat cards
  const stats = [
    [students === null ? "–" : students, "Students"],
    [activeStudents, "Students with progress"],
    [totalDone, "Lessons completed (all students)"],
    [lessonDocs.length + " / " + LESSONS.length, "Lesson records"],
    [vocab.length, "Vocabulary items"],
    [grammar.length, "Grammar items"],
    [kanji.length, "Kanji items"],
    [quizzes.length, "Quiz questions"]
  ];
  $("stats").innerHTML = "";
  stats.forEach(([n, label]) => {
    const d = el("div", "stat");
    d.append(el("span", "", String(n)), el("small", "", label));
    $("stats").append(d);
  });

  // Lesson table
  const titles = {};
  lessonDocs.forEach((d) => { if (d.title) titles[d.id] = d.title; });
  const count = (arr, id) => arr.filter((x) => x.lessonId === id).length;

  const body = document.querySelector("#lessonTable tbody");
  body.innerHTML = "";
  LESSONS.forEach((l) => {
    const tr = el("tr");
    tr.append(
      el("td", "", String(l.id)),
      el("td", "", titles[l.id] || l.title),
      el("td", "", String(count(vocab, l.id))),
      el("td", "", String(count(grammar, l.id))),
      el("td", "", String(count(kanji, l.id))),
      el("td", "", String(count(quizzes, l.id))),
      el("td", "", String(tally[l.id] || 0))
    );
    const act = el("td", "actions");
    const open = el("a", "btn", "Edit");
    open.href = "lessons.html?id=" + l.id;
    const del = el("button", "btn btn-danger", "Delete content");
    del.onclick = async () => {
      const ok = confirm(
        "Delete the saved record and ALL vocabulary, grammar, kanji and quiz questions " +
        "for Lesson " + l.id + "? This cannot be undone."
      );
      if (!ok) return;
      del.disabled = true;
      try {
        await deleteLessonContent(l.id);
        await load();
      } catch (e) {
        alert("Could not delete: " + e.message);
        del.disabled = false;
      }
    };
    act.append(open, del);
    tr.append(act);
    body.append(tr);
  });

  $("status").textContent = students === null
    ? "Student count unavailable. Check that the new Firestore rules are published."
    : "";
}

$("seedBtn").addEventListener("click", async () => {
  if (!confirm("Create records for all 25 lessons? Lessons you already edited are not changed.")) return;
  $("seedBtn").disabled = true;
  try {
    const n = await seedLessons(LESSONS);
    alert(n ? n + " lesson records created." : "All 25 lesson records already exist.");
    await load();
  } catch (e) {
    alert("Could not create lessons: " + e.message);
  }
  $("seedBtn").disabled = false;
});

onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = "../index.html"; return; }
  $("logoutBtn").hidden = false;
  if (!(await isAdmin(u.uid))) {
    $("denied").hidden = false;
    $("panel").hidden = true;
    return;
  }
  $("denied").hidden = true;
  $("panel").hidden = false;
  load();
});
