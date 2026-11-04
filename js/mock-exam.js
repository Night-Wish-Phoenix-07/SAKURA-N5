import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, arrayUnion, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { isAdmin } from "./auth.js";
import { getAll, addPlain, updateItem, removeItem } from "./database.js";

const $ = (id) => document.getElementById(id);
const SECTIONS = ["Vocabulary", "Grammar", "Reading"];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let user = null, admin = false, raw = [], questions = [], editing = null, running = false;

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

/* ---------- Start screen ---------- */
function renderStart() {
  running = false;
  const box = $("examArea");
  box.innerHTML = "";
  const p = el("div", "panel");
  p.append(el("h2", "", "Mock JLPT N5 exam"));

  if (!questions.length) {
    p.append(el("p", "note", "No mock exam questions have been added yet." +
      (admin ? " Use the form below to add some." : "")));
    box.append(p);
    renderAdmin();
    return;
  }

  p.append(el("p", "", questions.length + " questions available. You get 1 minute per question."));
  const label = el("label", "pick", "Number of questions ");
  const sel = el("select");
  const sizes = [5, 10, 20, 30, 50].filter((n) => n < questions.length);
  sizes.push(questions.length);
  sizes.forEach((n) => {
    const o = el("option", "", n === questions.length ? "All (" + n + ")" : String(n));
    o.value = n;
    sel.append(o);
  });
  label.append(sel);
  p.append(label);
  if (!user) p.append(el("p", "note", "Sign in on the home page to save your results."));

  const b = el("button", "btn", "Start exam");
  b.onclick = () => run(Number(sel.value));
  p.append(b);
  box.append(p);
  renderAdmin();
}

/* ---------- Exam ---------- */
function run(count) {
  running = true;
  $("adminArea").hidden = true;

  const order = shuffle(questions.slice()).slice(0, count);
  const answers = new Array(order.length).fill(null);
  let idx = 0, finished = false;
  const endAt = Date.now() + order.length * 60000;
  const timerEl = el("p", "timer");
  const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
  window.addEventListener("beforeunload", warn);

  const iv = setInterval(tick, 1000);
  tick();

  function tick() {
    const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    timerEl.textContent = "⏱ " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
    if (left <= 0) submit();
  }

  function show() {
    const q = order[idx];
    const box = $("examArea");
    box.innerHTML = "";
    const p = el("div", "panel");
    p.append(timerEl);
    p.append(el("p", "note",
      "Question " + (idx + 1) + " of " + order.length + " · " +
      answers.filter((a) => a !== null).length + " answered" +
      (q.section ? " · " + q.section : "")));
    if (q.passage) p.append(el("p", "passage pre", q.passage));
    p.append(el("h2", "", q.question));

    const opts = el("div", "opts");
    q.options.forEach((t, k) => {
      const b = el("button", "opt" + (answers[idx] === k ? " selected" : ""), t);
      b.onclick = () => { answers[idx] = k; show(); };
      opts.append(b);
    });
    p.append(opts);

    const nav = el("div", "row");
    const prev = el("button", "btn btn-outline-dark", "← Previous");
    prev.disabled = idx === 0;
    prev.onclick = () => { idx--; show(); };
    const next = el("button", "btn btn-outline-dark", "Next →");
    next.disabled = idx === order.length - 1;
    next.onclick = () => { idx++; show(); };
    const sub = el("button", "btn", "Submit exam");
    sub.onclick = () => {
      const left = answers.filter((a) => a === null).length;
      if (left && !confirm(left + " question(s) are unanswered. Submit anyway?")) return;
      submit();
    };
    nav.append(prev, next, sub);
    p.append(nav);
    box.append(p);
  }

  async function submit() {
    if (finished) return;
    finished = true;
    clearInterval(iv);
    window.removeEventListener("beforeunload", warn);

    let score = 0;
    const bySec = {};
    order.forEach((q, k) => {
      const s = q.section || "General";
      bySec[s] = bySec[s] || { c: 0, t: 0 };
      bySec[s].t++;
      if (answers[k] === q.answer) { score++; bySec[s].c++; }
    });
    const saved = await saveResult(score, order.length);
    showResult(order, answers, score, bySec, saved);
  }

  show();
}

async function saveResult(score, total) {
  if (!user) return false;
  try {
    await setDoc(
      doc(db, "userProgress", user.uid),
      {
        mockResults: arrayUnion({
          score, total, pct: Math.round((score / total) * 100), date: Date.now()
        }),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    return true;
  } catch (e) {
    alert("Could not save your result: " + e.message);
    return false;
  }
}

function showResult(order, answers, score, bySec, saved) {
  const box = $("examArea");
  box.innerHTML = "";
  const pct = Math.round((score / order.length) * 100);

  const p = el("div", "panel");
  p.append(el("h2", "", "Result"));
  p.append(el("p", "score", score + " / " + order.length + " (" + pct + "%)"));
  Object.entries(bySec).forEach(([s, v]) =>
    p.append(el("p", "", s + ": " + v.c + " / " + v.t)));
  if (saved) p.append(el("p", "note", "Your result has been saved to your dashboard."));
  else if (!user) p.append(el("p", "note", "Sign in on the home page to save your results."));

  const again = el("button", "btn", "Take another exam");
  again.onclick = () => renderStart();
  p.append(again);
  box.append(p);

  const wrong = order.map((q, k) => ({ q, k })).filter(({ q, k }) => answers[k] !== q.answer);
  const r = el("div", "panel");
  r.append(el("h2", "", "Review"));
  if (!wrong.length) r.append(el("p", "", "🎉 Every answer was correct."));
  wrong.forEach(({ q, k }) => {
    const d = el("div", "review");
    d.append(el("p", "", q.question));
    d.append(el("p", "note",
      "Your answer: " + (answers[k] === null ? "not answered" : q.options[answers[k]])));
    d.append(el("p", "", "Correct answer: " + q.options[q.answer]));
    if (q.explanation) d.append(el("p", "note", q.explanation));
    r.append(d);
  });
  box.append(r);
  renderAdmin();
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
  if (!admin || running) { box.hidden = true; return; }
  box.hidden = false;

  const f = el("div", "panel form");
  f.append(el("h3", "", editing ? "Edit mock exam question" : "Add a mock exam question"));

  const sec = el("select");
  SECTIONS.forEach((s) => { const o = el("option", "", s); o.value = s; sec.append(o); });
  const passage = el("textarea");
  const q = el("textarea");
  const opts = [0, 1, 2, 3].map(() => el("input"));
  const ans = el("select");
  ["A", "B", "C", "D"].forEach((L, k) => { const o = el("option", "", L); o.value = k; ans.append(o); });
  const exp = el("textarea");

  if (editing) {
    sec.value = editing.section || SECTIONS[0];
    passage.value = editing.passage || "";
    q.value = editing.question || "";
    (editing.options || []).forEach((t, k) => { if (opts[k]) opts[k].value = t; });
    ans.value = Number.isInteger(editing.answer) ? editing.answer : 0;
    exp.value = editing.explanation || "";
  }

  f.append(field("Section", sec));
  f.append(field("Reading passage (optional)", passage));
  f.append(field("Question", q));
  ["A", "B", "C", "D"].forEach((L, k) => f.append(field("Option " + L, opts[k])));
  f.append(field("Correct answer", ans));
  f.append(field("Explanation (optional)", exp));

  const row = el("div", "row");
  const save = el("button", "btn", editing ? "Save changes" : "Add question");
  save.onclick = async () => {
    const data = {
      section: sec.value,
      passage: passage.value.trim(),
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
      if (editing) await updateItem("mockExams", editing.id, data);
      else await addPlain("mockExams", data);
      editing = null;
      await loadAll();
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
  list.append(el("h3", "", "All mock exam questions (" + raw.length + ")"));
  if (!raw.length) list.append(el("p", "note", "None yet."));
  raw.forEach((x) => {
    const r = el("div", "qrow");
    r.append(el("p", "", x.question || "(empty question)"));
    r.append(el("p", "note",
      (x.section || "No section") + " · Correct answer: " +
      (Number.isInteger(x.answer) ? "ABCD"[x.answer] : "?")));
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
      try { await removeItem("mockExams", x.id); await loadAll(); }
      catch (e) { alert("Could not delete: " + e.message); }
    };
    a.append(edit, del);
    r.append(a);
    list.append(r);
  });
  box.append(list);
}

/* ---------- Load ---------- */
async function loadAll() {
  if (!running) {
    $("examArea").innerHTML = "";
    $("examArea").append(el("p", "note", "Loading..."));
  }
  try {
    raw = await getAll("mockExams");
  } catch (e) {
    $("examArea").innerHTML = "";
    $("examArea").append(el("p", "note", "Could not load questions: " + e.message));
    return;
  }
  raw.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  questions = raw.filter(isValid);
  renderStart();
}

onAuthStateChanged(auth, async (u) => {
  user = u;
  admin = u ? await isAdmin(u.uid) : false;
  if (!running) loadAll();
});
