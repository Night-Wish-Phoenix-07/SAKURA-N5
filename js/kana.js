import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { isAdmin } from "./auth.js";

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* ---------- Chart data (hiragana is stored; katakana is converted) ---------- */

// "-" means an empty slot in the chart
const SECTIONS = [
  {
    key: "basic", title: "Basic sounds", jp: "清音",
    cols: ["a", "i", "u", "e", "o"],
    rows: [
      ["あ い う え お", "a i u e o"],
      ["か き く け こ", "ka ki ku ke ko"],
      ["さ し す せ そ", "sa shi su se so"],
      ["た ち つ て と", "ta chi tsu te to"],
      ["な に ぬ ね の", "na ni nu ne no"],
      ["は ひ ふ へ ほ", "ha hi fu he ho"],
      ["ま み む め も", "ma mi mu me mo"],
      ["や - ゆ - よ", "ya - yu - yo"],
      ["ら り る れ ろ", "ra ri ru re ro"],
      ["わ - - - を", "wa - - - wo"],
      ["ん - - - -", "n - - - -"]
    ]
  },
  {
    key: "dakuten", title: "Dakuten and handakuten", jp: "濁音・半濁音",
    cols: ["a", "i", "u", "e", "o"],
    rows: [
      ["が ぎ ぐ げ ご", "ga gi gu ge go"],
      ["ざ じ ず ぜ ぞ", "za ji zu ze zo"],
      ["だ ぢ づ で ど", "da ji zu de do"],
      ["ば び ぶ べ ぼ", "ba bi bu be bo"],
      ["ぱ ぴ ぷ ぺ ぽ", "pa pi pu pe po"]
    ]
  },
  {
    key: "combo", title: "Combination sounds", jp: "拗音",
    cols: ["ya", "yu", "yo"],
    rows: [
      ["きゃ きゅ きょ", "kya kyu kyo"],
      ["しゃ しゅ しょ", "sha shu sho"],
      ["ちゃ ちゅ ちょ", "cha chu cho"],
      ["にゃ にゅ にょ", "nya nyu nyo"],
      ["ひゃ ひゅ ひょ", "hya hyu hyo"],
      ["みゃ みゅ みょ", "mya myu myo"],
      ["りゃ りゅ りょ", "rya ryu ryo"],
      ["ぎゃ ぎゅ ぎょ", "gya gyu gyo"],
      ["じゃ じゅ じょ", "ja ju jo"],
      ["びゃ びゅ びょ", "bya byu byo"],
      ["ぴゃ ぴゅ ぴょ", "pya pyu pyo"]
    ]
  }
];

function toKatakana(s) {
  let out = "";
  for (const c of s) {
    const n = c.charCodeAt(0);
    out += n >= 0x3041 && n <= 0x3096 ? String.fromCharCode(n + 0x60) : c;
  }
  return out;
}

// Build the grid of cells for one section and one script
function cellsOf(sec, script) {
  return sec.rows.map(([k, r]) => {
    const ks = k.split(" "), rs = r.split(" ");
    return ks.map((ch, i) =>
      ch === "-" ? null : { ch: script === "katakana" ? toKatakana(ch) : ch, r: rs[i] });
  });
}

function allCells(script, keys) {
  const out = [];
  SECTIONS.filter((s) => !keys || keys.includes(s.key)).forEach((s) =>
    cellsOf(s, script).forEach((row) => row.forEach((c) => c && out.push(c))));
  return out;
}

/* ---------- Built-in example words (the admin can override any of them) ---------- */

function parse(str) {
  const m = {};
  str.split(";").forEach((p) => {
    const [ch, word, meaning] = p.split("|").map((x) => x.trim());
    if (ch && word) m[ch] = { word, meaning: meaning || "" };
  });
  return m;
}

const DEFAULTS = {
  hiragana: parse(`
    あ|あめ|rain; い|いぬ|dog; う|うみ|sea; え|えき|station; お|おかね|money;
    か|かさ|umbrella; き|きた|north; く|くるま|car; け|けさ|this morning; こ|こども|child;
    さ|さかな|fish; し|しお|salt; す|すし|sushi; せ|せんせい|teacher; そ|そら|sky;
    た|たまご|egg; ち|ちず|map; つ|つくえ|desk; て|てがみ|letter; と|とり|bird;
    な|なつ|summer; に|にく|meat; ぬ|ぬいぐるみ|stuffed toy; ね|ねこ|cat; の|のむ|to drink;
    は|はな|flower; ひ|ひと|person; ふ|ふね|ship; へ|へや|room; ほ|ほし|star;
    ま|まど|window; み|みず|water; む|むし|insect; め|めがね|glasses; も|もり|forest;
    や|やま|mountain; ゆ|ゆき|snow; よ|よる|night;
    ら|らいねん|next year; り|りんご|apple; る|るす|being away from home; れ|れきし|history; ろ|ろく|six;
    わ|わたし|I; を|みずを のむ|drink water (を is a particle); ん|ほん|book;
    が|がくせい|student; ぎ|ぎんこう|bank; げ|げんき|healthy, well; ご|ごはん|rice, meal;
    ざ|ざっし|magazine; じ|じかん|time; ぜ|ぜんぶ|all; ぞ|ぞう|elephant;
    だ|だいがく|university; で|でんわ|telephone; ど|どうぞ|please;
    ば|ばしょ|place; び|びょういん|hospital; ぶ|ぶた|pig; べ|べんきょう|study; ぼ|ぼうし|hat;
    ぴ|えんぴつ|pencil; ぽ|さんぽ|walk;
    きゃ|きゃく|guest; しゃ|しゃしん|photograph; しゅ|しゅくだい|homework; しょ|しょくじ|meal;
    ちゃ|おちゃ|tea; ひゃ|ひゃく|hundred; りょ|りょこう|travel; ぎゅ|ぎゅうにゅう|milk;
    じゃ|じゃがいも|potato; びょ|びょういん|hospital
  `),
  katakana: parse(`
    ア|アイス|ice cream; イ|インク|ink; ウ|ウイスキー|whisky; エ|エアコン|air conditioner; オ|オレンジ|orange;
    カ|カメラ|camera; キ|キロ|kilo; ク|クラス|class; ケ|ケーキ|cake; コ|コーヒー|coffee;
    サ|サラダ|salad; シ|シャツ|shirt; ス|スーパー|supermarket; セ|セーター|sweater; ソ|ソファ|sofa;
    タ|タクシー|taxi; チ|チーズ|cheese; ツ|ツアー|tour; テ|テレビ|television; ト|トイレ|toilet;
    ナ|ナイフ|knife; ニ|ニュース|news; ヌ|ヌードル|noodles; ネ|ネクタイ|necktie; ノ|ノート|notebook;
    ハ|ハンバーガー|hamburger; ヒ|ヒーター|heater; フ|フォーク|fork; ヘ|ヘリコプター|helicopter; ホ|ホテル|hotel;
    マ|マスク|mask; ミ|ミルク|milk; ム|ムービー|movie; メ|メール|email; モ|モデル|model;
    ヤ|タイヤ|tyre; ユ|ユーモア|humour; ヨ|ヨーグルト|yogurt;
    ラ|ラジオ|radio; リ|リモコン|remote control; ル|ルール|rule; レ|レストラン|restaurant; ロ|ロボット|robot;
    ワ|ワイン|wine; ン|パン|bread;
    ガ|ガス|gas; ギ|ギター|guitar; グ|グラス|glass; ゲ|ゲーム|game; ゴ|ゴルフ|golf;
    ジ|ジーンズ|jeans; ズ|ズボン|trousers; ゼ|ゼロ|zero;
    ダ|ダンス|dance; デ|デパート|department store; ド|ドア|door;
    バ|バス|bus; ビ|ビール|beer; ブ|ブーツ|boots; ベ|ベッド|bed; ボ|ボールペン|ballpoint pen;
    パ|パン|bread; ピ|ピアノ|piano; プ|プール|pool; ペ|ペン|pen; ポ|ポスト|post box;
    キャ|キャベツ|cabbage; シャ|シャワー|shower; ショ|ショッピング|shopping; ニュ|ニュース|news;
    ミュ|ミュージック|music; ジャ|ジャム|jam; ジュ|ジュース|juice
  `)
};

/* ---------- State ---------- */

let script = "hiragana";      // "hiragana" or "katakana"
let mode = "chart";           // "chart" or "test"
let admin = false;
let selected = null;          // { ch, r }
const custom = { hiragana: {}, katakana: {} };   // admin-saved examples from Firestore

function getExample(ch) {
  if (custom[script][ch]) return { ...custom[script][ch], custom: true };
  if (DEFAULTS[script][ch]) return { ...DEFAULTS[script][ch], custom: false };
  return null;
}

/* ---------- Sound (browser's built-in Japanese voice) ---------- */

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

/* ---------- Chart ---------- */

function renderChart() {
  const box = $("chart");
  box.innerHTML = "";
  SECTIONS.forEach((sec) => {
    const wrap = el("section", "panel");
    const h = el("h2", "", sec.title + " ");
    h.append(el("span", "jp", "· " + sec.jp));
    wrap.append(h);

    const grid = el("div", "kgrid");
    grid.style.setProperty("--cols", sec.cols.length);
    sec.cols.forEach((c) => grid.append(el("div", "khead", c)));

    cellsOf(sec, script).forEach((row) =>
      row.forEach((c) => {
        if (!c) { grid.append(el("div", "kempty")); return; }
        const b = el("button", "kcell");
        b.type = "button";
        b.dataset.ch = c.ch;
        b.setAttribute("aria-label", c.ch + ", " + c.r);
        b.append(el("span", "kch", c.ch), el("span", "kro", c.r));
        if (selected && selected.ch === c.ch) b.classList.add("on");
        b.addEventListener("click", () => select(c));
        grid.append(b);
      }));
    wrap.append(grid);
    box.append(wrap);
  });
}

function select(c) {
  selected = c;
  document.querySelectorAll(".kcell").forEach((b) =>
    b.classList.toggle("on", b.dataset.ch === c.ch));
  renderDetail();
  speak(c.ch);
}

function renderDetail() {
  const has = !!selected;
  $("dEmpty").hidden = has;
  $("dBody").hidden = !has;
  if (!has) return;

  $("dChar").textContent = selected.ch;
  $("dRomaji").textContent = selected.r;

  const ex = getExample(selected.ch);
  $("dExample").hidden = !ex;
  $("dNoExample").hidden = !!ex;
  if (ex) {
    $("dWord").textContent = ex.word;
    $("dMeaning").textContent = ex.meaning;
  }

  $("adminBox").hidden = !admin;
  if (admin) {
    $("fWord").value = ex ? ex.word : "";
    $("fMeaning").value = ex ? ex.meaning : "";
    $("resetBtn").hidden = !(ex && ex.custom);
    $("saveMsg").textContent = "";
  }
}

$("hearChar").addEventListener("click", () => selected && speak(selected.ch));
$("hearWord").addEventListener("click", () => {
  const ex = selected && getExample(selected.ch);
  if (ex) speak(ex.word);
});

/* ---------- Admin: edit example word ---------- */

$("adminForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!admin || !selected) return;
  const word = $("fWord").value.trim();
  const meaning = $("fMeaning").value.trim();
  const msg = $("saveMsg");
  if (!word) { msg.textContent = "Please type an example word."; return; }
  $("saveBtn").disabled = true;
  try {
    await setDoc(doc(db, script, selected.ch), {
      char: selected.ch, word, meaning, updatedAt: serverTimestamp()
    });
    custom[script][selected.ch] = { word, meaning };
    renderDetail();
    $("saveMsg").textContent = "Saved ✔";
  } catch (err) {
    msg.textContent = "Could not save: " + err.message;
  }
  $("saveBtn").disabled = false;
});

$("resetBtn").addEventListener("click", async () => {
  if (!admin || !selected) return;
  if (!confirm("Remove your saved example for " + selected.ch + " and go back to the built-in one?")) return;
  try {
    await deleteDoc(doc(db, script, selected.ch));
    delete custom[script][selected.ch];
    renderDetail();
    $("saveMsg").textContent = "Reset ✔";
  } catch (err) {
    $("saveMsg").textContent = "Could not reset: " + err.message;
  }
});

async function loadCustom() {
  for (const s of ["hiragana", "katakana"]) {
    try {
      const snap = await getDocs(collection(db, s));
      snap.docs.forEach((d) => {
        const x = d.data();
        if (x.word) custom[s][d.id] = { word: x.word, meaning: x.meaning || "" };
      });
    } catch (err) {
      /* the built-in examples still work if this fails */
    }
  }
  renderDetail();
}

/* ---------- Test me ---------- */

const quiz = { score: 0, total: 0, cur: null, last: "", done: false };

function shuffle(a) {
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a;
}

function poolKeys() {
  const v = $("testSet").value;
  return v === "all" ? null : [v];
}

function updateScore() {
  $("qScore").textContent = "Score: " + quiz.score + " / " + quiz.total;
}

function nextQuestion() {
  const pool = allCells(script, poolKeys());
  let cur;
  do { cur = pool[Math.floor(Math.random() * pool.length)]; }
  while (pool.length > 1 && cur.ch === quiz.last);
  quiz.cur = cur; quiz.last = cur.ch; quiz.done = false;

  // three wrong answers with different romaji from the right one
  const romajis = [...new Set(allCells(script).map((c) => c.r))].filter((r) => r !== cur.r);
  const opts = shuffle([cur.r, ...shuffle(romajis).slice(0, 3)]);

  $("qChar").textContent = cur.ch;
  const box = $("qOpts");
  box.innerHTML = "";
  opts.forEach((r) => {
    const b = el("button", "opt", r);
    b.type = "button";
    b.addEventListener("click", () => answer(b, r));
    box.append(b);
  });
  $("qNext").hidden = true;
  $("qFeedback").textContent = "";
  updateScore();
}

function answer(btn, r) {
  if (quiz.done) return;
  quiz.done = true;
  quiz.total++;
  const ok = r === quiz.cur.r;
  if (ok) quiz.score++;
  document.querySelectorAll("#qOpts .opt").forEach((b) => {
    b.disabled = true;
    if (b.textContent === quiz.cur.r) b.classList.add("correct");
  });
  if (!ok) btn.classList.add("wrong");
  $("qFeedback").textContent = ok ? "Correct! 🌸" : "Not quite. It is “" + quiz.cur.r + "”.";
  $("qNext").hidden = false;
  updateScore();
}

$("qNext").addEventListener("click", nextQuestion);
$("qHear").addEventListener("click", () => quiz.cur && speak(quiz.cur.ch));
$("testSet").addEventListener("change", () => {
  quiz.score = 0; quiz.total = 0; quiz.last = "";
  nextQuestion();
});

/* ---------- Tabs ---------- */

function setScript(s) {
  script = s;
  selected = null;
  document.querySelectorAll("#scriptTabs button").forEach((b) =>
    b.classList.toggle("active", b.dataset.script === s));
  renderChart();
  renderDetail();
  quiz.score = 0; quiz.total = 0; quiz.last = "";
  if (mode === "test") nextQuestion();
}

function setMode(m) {
  mode = m;
  document.querySelectorAll("#modeTabs button").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === m));
  $("chartView").hidden = m !== "chart";
  $("testView").hidden = m !== "test";
  if (m === "test") nextQuestion();
}

document.querySelectorAll("#scriptTabs button").forEach((b) =>
  b.addEventListener("click", () => setScript(b.dataset.script)));
document.querySelectorAll("#modeTabs button").forEach((b) =>
  b.addEventListener("click", () => setMode(b.dataset.mode)));

/* ---------- Sign-in state (navigation only; the page itself is public) ---------- */

$("logoutBtn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  $("logoutBtn").hidden = !user;
  admin = false;
  if (user) admin = await isAdmin(user.uid);
  $("adminLink").hidden = !admin;
  renderDetail();
});

if ("speechSynthesis" in window) speechSynthesis.getVoices();  // wakes up the voice list

renderChart();
renderDetail();
loadCustom();
