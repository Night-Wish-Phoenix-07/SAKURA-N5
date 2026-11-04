import { auth } from "./firebase-config.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { LESSONS } from "./lessons.js";
import { isAdmin } from "./auth.js";
import { getProgress, setLessonDone } from "./progress.js";
import { getLessonDoc, saveLessonDoc, seedLessons, getItems, addItem, updateItem, removeItem }
  from "./database.js";

const $ = (id) => document.getElementById(id);

const TYPES = {
  vocabulary: { label: "vocabulary", fields: [
    ["japanese", "Japanese"], ["reading", "Hiragana"],
    ["romaji", "Romaji"], ["meaning", "English meaning"]] },
  grammar: { label: "grammar", fields: [
    ["pattern", "Pattern"], ["explanation", "Explanation"],
    ["example", "Example (Japanese)"], ["exampleMeaning", "Example meaning"]] },
  kanji: { label: "kanji", fields: [
    ["character", "Kanji"], ["reading", "Readings"], ["meaning", "Meaning"]] }
};

let id = parseInt(new URLSearchParams(location.search).get("id"), 10);
if (!(id >= 1 && id <= LESSONS.length)) id = 1;
const base = LESSONS.find((l) => l.id === id);

let user = null, admin = false, done = false, tab = "overview", lessonData = {};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* ---------- Header ---------- */
function renderHeader() {
  const title = lessonData.title || base.title;
  $("lnum").textContent = "LESSON " + String(id).padStart(2, "0");
  $("ltitle").textContent = title;
  $("ltopic").textContent = lessonData.topic || base.topic;
  document.title = "Lesson " + id + " · " + title + " | SAKURA N5";
  $("prev").hidden = id === 1;
  $("next").hidden = id === LESSONS.length;
  $("prev").href = "lessons.html?id=" + (id - 1);
  $("next").href = "lessons.html?id=" + (id + 1);
}

/* ---------- Overview tab ---------- */
function renderOverview(box) {
  const s = el("div", "panel");
  s.append(el("h2", "", "Summary"));
  s.append(el("p", "pre", lessonData.summary || base.summary || "No summary has been added yet."));
  box.append(s);

  const p = el("div", "panel");
  p.append(el("h2", "", "Conversation and writing practice"));
  p.append(el("p", "pre", lessonData.practice || "No practice text has been added yet."));
  box.append(p);

  const c = el("div", "panel");
  c.append(el("h2", "", "Your progress"));
  if (user) {
    const b = el("button", "btn", done ? "✓ Completed (click to undo)" : "Mark as completed");
    b.onclick = async () => {
      b.disabled = true;
      try {
        await setLessonDone(user.uid, id, !done);
        done = !done;
        render();
      } catch (e) {
        alert("Could not save progress: " + e.message);
        b.disabled = false;
      }
    };
    c.append(b);
  } else {
    c.append(el("p", "note", "Sign in on the home page to save your progress."));
  }
  box.append(c);

  if (admin) box.append(buildLessonForm());
}

function buildLessonForm() {
  const f = el("div", "panel form");
  f.append(el("h3", "", "Edit lesson (admin)"));
  const fields = [["title", "Title", "input"], ["topic", "Topic", "input"],
                  ["summary", "Summary", "textarea"], ["practice", "Conversation and writing practice", "textarea"]];
  const inputs = {};
  fields.forEach(([k, label, kind]) => {
    const l = el("label", "", label);
    const i = el(kind);
    i.value = lessonData[k] || (k === "title" ? base.title : k === "topic" ? base.topic : k === "summary" ? (base.summary || "") : "");
    inputs[k] = i;
    l.append(i);
    f.append(l);
  });
  const save = el("button", "btn", "Save lesson");
  save.onclick = async () => {
    const data = {};
    fields.forEach(([k]) => (data[k] = inputs[k].value.trim()));
    save.disabled = true;
    try {
      await saveLessonDoc(id, data);
      lessonData = { ...lessonData, ...data };
      renderHeader();
      render();
    } catch (e) {
      alert("Could not save: " + e.message);
      save.disabled = false;
    }
  };
  f.append(save);

  const seed = el("button", "btn btn-outline-dark", "Create all 25 lesson records");
  seed.style.marginLeft = "8px";
  seed.onclick = async () => {
    if (!confirm("Create records for all 25 lessons? Lessons you already edited are not changed.")) return;
    seed.disabled = true;
    try {
      const n = await seedLessons(LESSONS);
      alert(n ? n + " lesson records created." : "All 25 lesson records already exist.");
    } catch (e) {
      alert("Could not create lessons: " + e.message);
    }
    seed.disabled = false;
  };
  f.append(seed);
  return f;
}

/* ---------- Vocabulary / Grammar / Kanji tabs ---------- */
function buildItemForm(col, item) {
  const T = TYPES[col];
  const f = el("div", "panel form");
  f.append(el("h3", "", item ? "Edit item" : "Add " + T.label));
  const inputs = {};
  T.fields.forEach(([k, label]) => {
    const l = el("label", "", label);
    const i = el(k === "explanation" ? "textarea" : "input");
    i.value = (item && item[k]) || "";
    inputs[k] = i;
    l.append(i);
    f.append(l);
  });
  const row = el("div", "row");
  const save = el("button", "btn", item ? "Save changes" : "Add");
  save.onclick = async () => {
    const data = {};
    T.fields.forEach(([k]) => (data[k] = inputs[k].value.trim()));
    if (!data[T.fields[0][0]]) { alert("Please fill in the first field."); return; }
    save.disabled = true;
    try {
      if (item) await updateItem(col, item.id, data);
      else await addItem(col, id, data);
      render();
    } catch (e) {
      alert("Could not save: " + e.message);
      save.disabled = false;
    }
  };
  row.append(save);
  if (item) {
    const cancel = el("button", "btn btn-outline-dark", "Cancel");
    cancel.onclick = () => render();
    row.append(cancel);
  }
  f.append(row);
  return f;
}

function buildItemCard(col, item) {
  const T = TYPES[col];
  const card = el("div", "item");
  T.fields.forEach(([k], i) => {
    if (!item[k]) return;
    card.append(el("p", i === 0 ? "big" : "", item[k]));
  });
  if (admin) {
    const a = el("div", "actions");
    const edit = el("button", "btn", "Edit");
    edit.onclick = () => card.replaceWith(buildItemForm(col, item));
    const del = el("button", "btn btn-danger", "Delete");
    del.onclick = async () => {
      if (!confirm("Delete this item? This cannot be undone.")) return;
      try { await removeItem(col, item.id); render(); }
      catch (e) { alert("Could not delete: " + e.message); }
    };
    a.append(edit, del);
    card.append(a);
  }
  return card;
}

async function renderItems(box, col) {
  box.append(el("p", "note", "Loading..."));
  let items = [];
  try {
    items = await getItems(col, id);
  } catch (e) {
    if (tab === col) { box.innerHTML = ""; box.append(el("p", "note", "Could not load: " + e.message)); }
    return;
  }
  if (tab !== col) return;            // user switched tabs while loading
  box.innerHTML = "";
  if (admin) box.append(buildItemForm(col, null));
  if (!items.length) {
    box.append(el("p", "note", "Nothing here yet" + (admin ? ". Use the form above to add the first item." : ".")));
    return;
  }
  const grid = el("div", "items");
  items.forEach((it) => grid.append(buildItemCard(col, it)));
  box.append(grid);
}

/* ---------- Main render ---------- */
function render() {
  document.querySelectorAll("#tabs button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab));
  const box = $("content");
  box.innerHTML = "";
  if (tab === "overview") renderOverview(box);
  else renderItems(box, tab);
}

$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  tab = b.dataset.tab;
  render();
});

try { lessonData = (await getLessonDoc(id)) || {}; } catch { lessonData = {}; }
renderHeader();

onAuthStateChanged(auth, async (u) => {
  user = u; admin = false; done = false;
  if (u) {
    admin = await isAdmin(u.uid);
    try { done = !!(await getProgress(u.uid))[id]; } catch {}
  }
  $("adminLink").hidden = !admin;
  $("logoutBtn").hidden = !u;
  render();
});
