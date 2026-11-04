import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { LESSONS } from "./lessons.js";
import { isAdmin } from "./auth.js";
import { getAll } from "./database.js";

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let words = [];

/* ---------- Sound (the browser's built-in Japanese voice) ---------- */
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
  u.rate = 0.8;
  if (ja) u.voice = ja;
  speechSynthesis.speak(u);
}

/* ---------- Filters ---------- */
const sel = $("lessonSel");
const all = el("option", "", "All lessons");
all.value = "all";
sel.append(all);
LESSONS.forEach((l) => {
  const o = el("option", "", "Lesson " + l.id + " · " + l.title);
  o.value = l.id;
  sel.append(o);
});

function render() {
  const q = $("search").value.trim().toLowerCase();
  const lid = sel.value;
  const list = words.filter((w) => {
    if (lid !== "all" && w.lessonId !== Number(lid)) return false;
    if (!q) return true;
    return [w.japanese, w.reading, w.romaji, w.meaning]
      .some((f) => (f || "").toLowerCase().includes(q));
  });

  const box = $("list");
  box.innerHTML = "";
  $("count").textContent = list.length + " of " + words.length + " words";

  if (!list.length) {
    $("empty").hidden = false;
    $("empty").textContent = words.length
      ? "No words match your search."
      : "No vocabulary has been added yet.";
    return;
  }
  $("empty").hidden = true;

  list.forEach((w) => {
    const card = el("div", "item");
    card.append(el("div", "big", w.japanese));
    if (w.reading && w.reading !== w.japanese) card.append(el("p", "", w.reading));
    if (w.romaji) card.append(el("p", "note", w.romaji));
    card.append(el("p", "", w.meaning));

    const acts = el("div", "actions");
    const hear = el("button", "btn btn-outline-dark", "🔊 Hear");
    hear.type = "button";
    hear.addEventListener("click", () => speak(w.reading || w.japanese));
    const a = el("a", "btn btn-outline-dark", "Lesson " + w.lessonId);
    a.href = "lessons.html?id=" + w.lessonId;
    acts.append(hear, a);
    card.append(acts);
    box.append(card);
  });
}

$("search").addEventListener("input", render);
sel.addEventListener("change", render);

/* ---------- Load ---------- */
async function load() {
  $("empty").hidden = false;
  $("empty").textContent = "Loading...";
  try {
    const items = await getAll("vocabulary");
    words = items
      .filter((x) => x.japanese && x.meaning)
      .sort((a, b) => (a.lessonId || 0) - (b.lessonId || 0));   // stable: keeps order inside a lesson
  } catch (e) {
    $("empty").textContent = "Could not load vocabulary: " + e.message;
    return;
  }
  render();
}

/* ---------- Sign-in state (navigation only; the page is public) ---------- */
$("logoutBtn").addEventListener("click", () => signOut(auth));
onAuthStateChanged(auth, async (user) => {
  $("logoutBtn").hidden = !user;
  $("adminLink").hidden = !(user && (await isAdmin(user.uid)));
});

if ("speechSynthesis" in window) speechSynthesis.getVoices();
load();
