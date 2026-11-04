import { LESSONS } from "./lessons.js";
import { getItems } from "./database.js";

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let id = parseInt(new URLSearchParams(location.search).get("id"), 10);
if (!(id >= 1 && id <= LESSONS.length)) id = 1;

let cards = [], i = 0, flipped = false;

const sel = $("lessonSel");
LESSONS.forEach((l) => {
  const o = el("option", "", "Lesson " + l.id + " · " + l.title);
  o.value = l.id;
  sel.appendChild(o);
});
sel.value = id;

function show() {
  const box = $("flashText");
  box.innerHTML = "";
  const empty = cards.length === 0;
  $("prevBtn").disabled = empty;
  $("nextBtn").disabled = empty;
  $("shuffleBtn").disabled = empty;
  $("flash").classList.toggle("flipped", flipped);

  if (empty) {
    box.append(el("p", "note", "No vocabulary has been added to this lesson yet."));
    $("count").textContent = "";
    return;
  }
  const c = cards[i];
  if (!flipped) {
    box.append(el("div", "flash-big", c.japanese));
  } else {
    if (c.reading) box.append(el("div", "flash-reading", c.reading));
    if (c.romaji) box.append(el("div", "flash-romaji", c.romaji));
    box.append(el("div", "flash-meaning", c.meaning));
  }
  $("count").textContent = "Card " + (i + 1) + " of " + cards.length;
}

async function load() {
  const my = id;
  $("flashText").innerHTML = "";
  $("flashText").append(el("p", "note", "Loading..."));
  try {
    const items = await getItems("vocabulary", id);
    if (my !== id) return;
    cards = items.filter((x) => x.japanese && x.meaning);
  } catch (e) {
    if (my !== id) return;
    cards = [];
    i = 0; flipped = false; show();
    $("flashText").innerHTML = "";
    $("flashText").append(el("p", "note", "Could not load cards: " + e.message));
    return;
  }
  i = 0; flipped = false;
  show();
}

function move(step) {
  if (!cards.length) return;
  i = (i + step + cards.length) % cards.length;
  flipped = false;
  show();
}

function flip() {
  if (!cards.length) return;
  flipped = !flipped;
  show();
}

$("flash").addEventListener("click", flip);
$("prevBtn").addEventListener("click", () => move(-1));
$("nextBtn").addEventListener("click", () => move(1));
$("shuffleBtn").addEventListener("click", () => {
  for (let k = cards.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [cards[k], cards[j]] = [cards[j], cards[k]];
  }
  i = 0; flipped = false;
  show();
});

sel.addEventListener("change", () => {
  id = Number(sel.value);
  history.replaceState(null, "", "flashcards.html?id=" + id);
  load();
});

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "SELECT") return;
  if (e.key === "ArrowRight") move(1);
  else if (e.key === "ArrowLeft") move(-1);
  else if (e.key === " ") { e.preventDefault(); flip(); }
});

load();
