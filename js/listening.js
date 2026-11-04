import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { isAdmin } from "./auth.js";
import { getAll, addPlain, updateItem, removeItem } from "./database.js";

const $ = (id) => document.getElementById(id);
const COL = "listening";
const ROUND = 10;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function shuffle(a) {
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a;
}

/* ---------- Built-in questions (used until the admin saves their own list) ---------- */
const DEFAULTS = [
  ["おはようございます", "Good morning", ["Good night", "Thank you", "Excuse me"]],
  ["ありがとうございます", "Thank you", ["I'm sorry", "Goodbye", "You're welcome"]],
  ["すみません", "Excuse me / I'm sorry", ["Good morning", "Please", "Yes"]],
  ["わたしは がくせいです", "I am a student", ["I am a teacher", "I am a doctor", "I am hungry"]],
  ["これは ほんです", "This is a book", ["This is a pen", "That is a desk", "This is a bag"]],
  ["いま なんじですか", "What time is it now?", ["Where is the station?", "How much is this?", "What is your name?"]],
  ["えきは どこですか", "Where is the station?", ["What time is it?", "Who is that?", "How are you?"]],
  ["みず", "water", ["fish", "rice", "book"]],
  ["ねこ", "cat", ["dog", "bird", "fish"]],
  ["あした", "tomorrow", ["yesterday", "today", "every day"]],
  ["にほんごを べんきょうします", "I study Japanese", ["I speak English", "I eat Japanese food", "I like Japan"]],
  ["おいしいです", "It is delicious", ["It is expensive", "It is cold", "It is small"]],
  ["ごはんを たべます", "I eat a meal", ["I drink water", "I go to school", "I read a book"]],
  ["ろくじに おきます", "I get up at six o'clock", ["I go to bed at six", "I eat at six", "I leave at six"]],
  ["いくらですか", "How much is it?", ["What time is it?", "Where is it?", "Who is it?"]]
].map(([japanese, answer, wrong]) => ({ japanese, answer, wrong1: wrong[0], wrong2: wrong[1], wrong3: wrong[2] }));

/* ---------- State ---------- */
let saved = [];          // questions saved by the admin in Firestore
let admin = false;
let editingId = null;
let round = [], idx = 0, score = 0, missed = [], answered = false;

const questions = () => (saved.length ? saved : DEFAULTS);
const wrongsOf = (q) => [q.wrong1, q.wrong2, q.wrong3].filter(Boolean);

/* ---------- Sound ---------- */
function speak(text) {
  const note = $("soundNote");
  note.textContent = "";
  if (!("speechSynthesis" in window)) {
    note.textContent = "This browser cannot play sound. Try Chrome, Edge or Safari.";
    return;
  }
  const voices = speechSynthesis.getVoices();
  const ja = voices.find((v) => (v.lang || "").toLowerCase().replace("_", "-").startsWith("ja"));
  if (voices.length && !ja) {
    note.textContent = "No Japanese voice found on this device. Install one in your system's text-to-speech settings.";
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = $("slow").checked ? 0.55 : 0.85;
  if (ja) u.voice = ja;
  speechSynthesis.speak(u);
}

/* ---------- Practice ---------- */
function show(which) {
  ["startView", "playView", "endView"].forEach((id) => ($(id).hidden = id !== which));
}

function renderStart() {
  const n = questions().length;
  $("qCount").textContent = n + " question" + (n === 1 ? "" : "s") + " available · " +
    Math.min(ROUND, n) + " per round";
  $("startBtn").disabled = n === 0;
  show("startView");
}

function start() {
  round = shuffle(questions().slice()).slice(0, ROUND);
  idx = 0; score = 0; missed = [];
  show("playView");
  showQuestion();
}

function showQuestion() {
  const q = round[idx];
  answered = false;
  $("progress").textContent = "Question " + (idx + 1) + " of " + round.length + " · Score " + score;
  $("reveal").textContent = "";
  $("nextBtn").hidden = true;

  const box = $("opts");
  box.innerHTML = "";
  shuffle([q.answer, ...wrongsOf(q)]).forEach((text) => {
    const b = el("button", "opt", text);
    b.type = "button";
    b.addEventListener("click", () => choose(b, text));
    box.append(b);
  });
  speak(q.japanese);
}

function choose(btn, text) {
  if (answered) return;
  answered = true;
  const q = round[idx];
  const ok = text === q.answer;
  if (ok) score++; else missed.push(q);
  document.querySelectorAll("#opts .opt").forEach((b) => {
    b.disabled = true;
    if (b.textContent === q.answer) b.classList.add("correct");
  });
  if (!ok) btn.classList.add("wrong");
  $("reveal").textContent = (ok ? "Correct! 🌸  " : "Not quite.  ") + q.japanese + " = " + q.answer;
  $("progress").textContent = "Question " + (idx + 1) + " of " + round.length + " · Score " + score;
  $("nextBtn").hidden = false;
  $("nextBtn").textContent = idx + 1 < round.length ? "Next →" : "See results";
}

function next() {
  if (idx + 1 < round.length) { idx++; showQuestion(); }
  else finish();
}

function finish() {
  show("endView");
  const pct = Math.round((score / round.length) * 100);
  $("finalScore").textContent = score + " / " + round.length + " (" + pct + "%)";
  const box = $("missed");
  box.innerHTML = "";
  if (!missed.length) {
    box.append(el("p", "", "Perfect! You got every one. 🎉"));
    return;
  }
  box.append(el("h3", "", "Review these"));
  missed.forEach((q) => {
    const row = el("div", "qrow");
    row.append(el("div", "jp", q.japanese), el("div", "", q.answer));
    const b = el("button", "btn btn-outline-dark", "🔊 Hear");
    b.type = "button";
    b.style.cssText = "padding:6px 12px;font-size:.85rem;margin-top:6px";
    b.addEventListener("click", () => speak(q.japanese));
    row.append(b);
    box.append(row);
  });
}

$("startBtn").addEventListener("click", start);
$("againBtn").addEventListener("click", start);
$("homeBtn").addEventListener("click", renderStart);
$("nextBtn").addEventListener("click", next);
$("replayBtn").addEventListener("click", () => round[idx] && speak(round[idx].japanese));

/* ---------- Admin: manage questions ---------- */
function renderAdmin() {
  $("adminPanel").hidden = !admin;
  if (!admin) return;

  $("seedBox").hidden = saved.length > 0;
  const list = $("adminList");
  list.innerHTML = "";
  if (!saved.length) {
    list.append(el("p", "note",
      "Students currently see the built-in questions. Add your own below, or copy the built-in ones to edit them."));
    return;
  }
  saved.forEach((q) => {
    const row = el("div", "qrow");
    row.append(el("div", "jp", q.japanese), el("div", "", "✔ " + q.answer),
      el("div", "note", "✘ " + wrongsOf(q).join(" · ")));
    const acts = el("div", "actions");
    const ed = el("button", "btn btn-outline-dark", "Edit");
    const del = el("button", "btn btn-danger", "Delete");
    ed.type = del.type = "button";
    ed.addEventListener("click", () => startEdit(q));
    del.addEventListener("click", async () => {
      if (!confirm("Delete this question?")) return;
      try {
        await removeItem(COL, q.id);
        saved = saved.filter((x) => x.id !== q.id);
        if (editingId === q.id) clearForm();
        renderAdmin(); renderStart();
      } catch (e) { alert("Could not delete: " + e.message); }
    });
    acts.append(ed, del);
    row.append(acts);
    list.append(row);
  });
}

function clearForm() {
  editingId = null;
  $("qForm").reset();
  $("formTitle").textContent = "Add a question";
  $("cancelEdit").hidden = true;
  $("formMsg").textContent = "";
}

function startEdit(q) {
  editingId = q.id;
  $("fJapanese").value = q.japanese;
  $("fAnswer").value = q.answer;
  $("fWrong1").value = q.wrong1 || "";
  $("fWrong2").value = q.wrong2 || "";
  $("fWrong3").value = q.wrong3 || "";
  $("formTitle").textContent = "Edit question";
  $("cancelEdit").hidden = false;
  $("formMsg").textContent = "";
  $("qForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

$("cancelEdit").addEventListener("click", clearForm);

$("qForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!admin) return;
  const data = {
    japanese: $("fJapanese").value.trim(),
    answer: $("fAnswer").value.trim(),
    wrong1: $("fWrong1").value.trim(),
    wrong2: $("fWrong2").value.trim(),
    wrong3: $("fWrong3").value.trim()
  };
  const msg = $("formMsg");
  if (!data.japanese || !data.answer || !wrongsOf(data).length) {
    msg.textContent = "Please fill in the Japanese text, the correct answer and at least one wrong answer.";
    return;
  }
  $("saveQ").disabled = true;
  try {
    if (editingId) {
      await updateItem(COL, editingId, data);
    } else {
      await addPlain(COL, data);
    }
    await loadSaved();
    clearForm();
    $("formMsg").textContent = "Saved ✔";
  } catch (err) {
    msg.textContent = "Could not save: " + err.message;
  }
  $("saveQ").disabled = false;
});

$("seedBtn").addEventListener("click", async () => {
  if (!admin || saved.length) return;
  $("seedBtn").disabled = true;
  try {
    await Promise.all(DEFAULTS.map((q) => addPlain(COL, q)));
    await loadSaved();
  } catch (err) {
    alert("Could not copy: " + err.message);
  }
  $("seedBtn").disabled = false;
});

async function loadSaved() {
  try {
    saved = (await getAll(COL)).filter((q) => q.japanese && q.answer && wrongsOf(q).length);
  } catch (e) {
    saved = [];     // the built-in questions still work
  }
  renderAdmin();
  if (!$("startView").hidden) renderStart();
}

/* ---------- Sign-in state (navigation only; practice is public) ---------- */
$("logoutBtn").addEventListener("click", () => signOut(auth));
onAuthStateChanged(auth, async (user) => {
  $("logoutBtn").hidden = !user;
  admin = !!user && (await isAdmin(user.uid));
  $("adminLink").hidden = !admin;
  renderAdmin();
});

if ("speechSynthesis" in window) speechSynthesis.getVoices();
renderStart();
loadSaved();
