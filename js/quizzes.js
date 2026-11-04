import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { LESSONS } from "./lessons.js";
import { isAdmin } from "./auth.js";
import { getItems, addItem, updateItem, removeItem } from "./database.js";

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let id = parseInt(new URLSearchParams(location.search).get("id"), 10);
if (!(id >= 1 && id <= LESSONS.length)) id = 1;

let user = null, admin = false, raw = [], questions = [], best = null, editing = null;

const sel = $("lessonSel");
LESSONS.forEach((l) => {
  const o = el("option", "", "Lesson " + l.id + " · " + l.title);
  o.value = l.id;
  sel.appendChild(o);
});
sel.value = id;

function isValid(x) {
  return x.question && Array.isArray(x.options) && x.options.length >= 2 &&
    Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.options.length;
}

function shuffle(a) {
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a;
}

/* ---------- Saved best score ---------- */
async function loadBest() {
  best = null;
  if (!user) return;
  try {
    const s = await getDoc(doc(db, "userProgress", user.uid));
    if (s.exists()) best = s.data().quizScores?.[id]?.best ?? null;
  } catch {}
}

async function saveScore(score, total) {
  if (!user) return;
  const pct = Math.round((score / total) * 100);
  const newBest = Math.max(best ?? -1, pct);
  try {
    await setDoc(
      doc(db, "userProgress", user.uid),
      { quizScores: { [id]: { best: newBest, last: pct, total } }, updatedAt: serverTimestamp() },
      { merge: true }
    );
    best = newBest;
  } catch (e) {
    alert("Could not save your score: " + e.message);
  }
}

/* ---------- Quiz ---------- */
function renderStart() {
  const box = $("quizArea");
  box.innerHTML = "";
  const lesson = LESSONS.find((l) => l.id === id);
  const p = el("div", "panel");
  p.append(el("h2", "", "Lesson " + id + " · " + lesson.title));

  if (!questions.length) {
    p.append(el("p", "note", "No quiz questions have been added for this lesson yet." +
      (admin ? " Use the form below to add some." : "")));
    box.append(p);
    return;
  }
  p.append(el("p", "", questions.length + " questions"));
  if (best !== null) p.append(el("p", "note", "Your best score: " + best + "%"));
  else if (!user) p.append(el("p", "note", "Sign in on the home page to save your best score."));
  const b = el("button", "btn", "Start quiz");
  b.onclick = run;
  p.append(b);
  box.append(p);
}

function run() {
  const order = shuffle(questions.slice());
  let n = 0, score = 0;
  showQuestion();

  function showQuestion() {
    const q = order[n];
    const box = $("quizArea");
    box.innerHTML = "";
    const p = el("div", "panel");
    p.append(el("p", "note", "Question " + (n + 1) + " of " + order.length));
    p.append(el("h2", "", q.question));

    const opts = el("div", "opts");
    const fb = el("div");
    const nextBtn = el("button", "btn", n === order.length - 1 ? "See result" : "Next question");
    nextBtn.hidden = true;

    q.options.forEach((text, k) => {
      const b = el("button", "opt", text);
      b.onclick = () => {
        opts.querySelectorAll("button").forEach((x, j) => {
          x.disabled = true;
          if (j === q.answer) x.classList.add("correct");
        });
        if (k === q.answer) {
          score++;
          fb.append(el("p", "", "✓ Correct!"));
        } else {
          b.classList.add("wrong");
          fb.append(el("p", "", "✗ Not quite. The correct answer is highlighted in green."));
        }
        if (q.explanation) fb.append(el("p", "note", q.explanation));
        nextBtn.hidden = false;
      };
      opts.append(b);
    });

    nextBtn.onclick = async () => {
      n++;
      if (n < order.length) showQuestion();
      else await finish();
    };
    p.append(opts, fb, nextBtn);
    box.append(p);
  }

  async function finish() {
    await saveScore(score, order.length);
    const pct = Math.round((score / order.length) * 100);
    const box = $("quizArea");
    box.innerHTML = "";
    const p = el("div", "panel");
    p.append(el("h2", "", "Result"));
    p.append(el("p", "score", score + " / " + order.length + " (" + pct + "%)"));
    if (user && best !== null) p.append(el("p", "note", "Your best score: " + best + "%"));
    else if (!user) p.append(el("p", "note", "Sign in on the home page to save your scores."));
    const again = el("button", "btn", "Try again");
    again.onclick = run;
    const back = el("button", "btn btn-outline-dark", "Back");
    back.style.marginLeft = "8px";
    back.onclick = renderStart;
    p.append(again, back);
    box.append(p);
  }
}

/* ---------- Admin: manage questions ---------- */
function field(label, input) {
  const l = el("label", "", label);
  l.append(input);
  return l;
}

function renderAdmin() {
  const box = $("adminArea");
  box.innerHTML = "";
  if (!admin) { box.hidden = true; return; }
  box.hidden = false;

  const f = el("div", "panel form");
  f.append(el("h3", "", editing ? "Edit question" : "Add a question to Lesson " + id));
  const q = el("textarea");
  const opts = [0, 1, 2, 3].map(() => el("input"));
  const ans = el("select");
  ["A", "B", "C", "D"].forEach((L, k) => {
    const o = el("option", "", L);
    o.value = k;
    ans.append(o);
  });
  const exp = el("textarea");

  if (editing) {
    q.value = editing.question || "";
    (editing.options || []).forEach((t, k) => { if (opts[k]) opts[k].value = t; });
    ans.value = Number.isInteger(editing.answer) ? editing.answer : 0;
    exp.value = editing.explanation || "";
  }

  f.append(field("Question", q));
  ["A", "B", "C", "D"].forEach((L, k) => f.append(field("Option " + L, opts[k])));
  f.append(field("Correct answer", ans));
  f.append(field("Explanation (optional)", exp));

  const row = el("div", "row");
  const save = el("button", "btn", editing ? "Save changes" : "Add question");
  save.onclick = async () => {
    const data = {
      question: q.value.trim(),
      options: opts.map((o) => o.value.trim()),
      answer: Number(ans.value),
      explanation: exp.value.trim()
    };
    if (!data.question || data.options.some((o) => !o)) {
      alert("Please fill in the question and all four options.");
      return;
    }
    save.disabled = true;
    try {
      if (editing) await updateItem("quizzes", editing.id, data);
      else await addItem("quizzes", id, data);
      editing = null;
      await loadLesson();
    } catch (e) {
      alert("Could not save: " + e.message);
      save.disabled = false;
    }
  };
  row.append(save);
  if (editing) {
    const cancel = el("button", "btn btn-outline-dark", "Cancel");
    cancel.onclick = () => { editing = null; renderAdmin(); };
    row.append(cancel);
  }
  f.append(row);
  box.append(f);

  const list = el("div", "panel");
  list.append(el("h3", "", "Questions in this lesson (" + raw.length + ")"));
  if (!raw.length) list.append(el("p", "note", "None yet."));
  raw.forEach((x) => {
    const r = el("div", "qrow");
    r.append(el("p", "", x.question || "(empty question)"));
    r.append(el("p", "note", "Correct answer: " + (Number.isInteger(x.answer) ? "ABCD"[x.answer] : "?")));
    const a = el("div", "actions");
    const edit = el("button", "btn", "Edit");
    edit.onclick = () => {
      editing = x;
      renderAdmin();
      $("adminArea").scrollIntoView({ behavior: "smooth" });
    };
    const del = el("button", "btn btn-danger", "Delete");
    del.onclick = async () => {
      if (!confirm("Delete this question? This cannot be undone.")) return;
      try { await removeItem("quizzes", x.id); await loadLesson(); }
      catch (e) { alert("Could not delete: " + e.message); }
    };
    a.append(edit, del);
    r.append(a);
    list.append(r);
  });
  box.append(list);
}

/* ---------- Load ---------- */
async function loadLesson() {
  const my = id;
  $("quizArea").innerHTML = "";
  $("quizArea").append(el("p", "note", "Loading..."));
  try {
    raw = await getItems("quizzes", id);
  } catch (e) {
    if (my !== id) return;
    $("quizArea").innerHTML = "";
    $("quizArea").append(el("p", "note", "Could not load quiz: " + e.message));
    return;
  }
  if (my !== id) return;
  questions = raw.filter(isValid);
  await loadBest();
  if (my !== id) return;
  renderStart();
  renderAdmin();
}

sel.addEventListener("change", () => {
  id = Number(sel.value);
  editing = null;
  history.replaceState(null, "", "quizzes.html?id=" + id);
  loadLesson();
});

onAuthStateChanged(auth, async (u) => {
  user = u;
  admin = u ? await isAdmin(u.uid) : false;
  loadLesson();
});
