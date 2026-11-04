import { db } from "./firebase-config.js";
import { collection, doc, writeBatch, serverTimestamp, Timestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { LESSONS } from "./lessons.js";
import { getAll } from "./database.js";

const $ = (id) => document.getElementById(id);
const s = (v) => String(v === undefined || v === null ? "" : v).trim();
const LETTERS = ["A", "B", "C", "D"];
const MOCK_SECTIONS = ["Vocabulary", "Grammar", "Reading"];
const WIDE = ["summary", "practice", "explanation", "passage", "question"];
const MID = ["title", "topic", "example", "exampleMeaning", "meaning", "pattern",
             "optionA", "optionB", "optionC", "optionD"];

const SHEETS = {
  Lessons: { col: "lessons", cols: ["id", "title", "topic", "summary", "practice"] },
  Vocabulary: { col: "vocabulary", lesson: true, req: "japanese",
    cols: ["id", "lessonId", "japanese", "reading", "romaji", "meaning", "delete"] },
  Grammar: { col: "grammar", lesson: true, req: "pattern",
    cols: ["id", "lessonId", "pattern", "explanation", "example", "exampleMeaning", "delete"] },
  Kanji: { col: "kanji", lesson: true, req: "character",
    cols: ["id", "lessonId", "character", "reading", "meaning", "delete"] },
  Quizzes: { col: "quizzes", lesson: true, quiz: true, req: "question",
    cols: ["id", "lessonId", "question", "optionA", "optionB", "optionC", "optionD",
           "answer", "explanation", "delete"] },
  MockExams: { col: "mockExams", quiz: true, req: "question",
    cols: ["id", "section", "passage", "question", "optionA", "optionB", "optionC", "optionD",
           "answer", "explanation", "delete"] }
};

const INSTRUCTIONS = [
  "SAKURA N5 content sheet",
  "",
  "1. Fill in the sheets Lessons, Vocabulary, Grammar, Kanji, Quizzes and MockExams. Do not rename the sheets or the column headers.",
  "2. Leave the 'id' column EMPTY for new rows. The website fills it in. Do not change an 'id' that is already there.",
  "3. To change an existing row, export the content from the Admin page, edit the cells in Excel, and import the file again.",
  "4. To delete a row, type YES in its 'delete' column (the row must have an id).",
  "5. 'lessonId' is the lesson number from 1 to 25.",
  "6. Quizzes and MockExams: 'answer' must be A, B, C or D. All four options are required.",
  "7. MockExams: 'section' must be Vocabulary, Grammar or Reading.",
  "8. The Lessons sheet: 'id' is the lesson number (1 to 25). It changes the title, topic, summary and practice text.",
  "9. Example rows in the template are normal rows. Change or delete them before importing.",
  "10. Write your own explanations and questions. Do not copy them from a textbook."
];

const TEMPLATE_ROWS = {
  Vocabulary: [{ lessonId: 1, japanese: "私", reading: "わたし", romaji: "watashi", meaning: "I / me" }],
  Grammar: [{ lessonId: 1, pattern: "AはBです", explanation: "Says that A is B. The particle は is read as 'wa'.",
    example: "わたしは学生です。", exampleMeaning: "I am a student." }],
  Kanji: [{ lessonId: 1, character: "学", reading: "ガク / まな(ぶ)", meaning: "study" }],
  Quizzes: [{ lessonId: 1, question: "「わたし」の意味は何ですか。", optionA: "you", optionB: "I / me",
    optionC: "he", optionD: "she", answer: "B", explanation: "私 (わたし) means I or me." }],
  MockExams: [{ section: "Vocabulary", passage: "", question: "「がくせい」の意味は何ですか。",
    optionA: "teacher", optionB: "student", optionC: "doctor", optionD: "friend",
    answer: "B", explanation: "学生 (がくせい) means student." }]
};

/* ---------- Build Excel files ---------- */
function toRow(name, d) {
  const S = SHEETS[name];
  const r = {};
  S.cols.forEach((c) => {
    if (c === "id") r.id = d.id;
    else if (c === "delete") r.delete = "";
    else if (S.quiz && c.startsWith("option")) r[c] = (d.options || [])[LETTERS.indexOf(c.slice(6))] || "";
    else if (S.quiz && c === "answer") r.answer = Number.isInteger(d.answer) ? LETTERS[d.answer] : "";
    else r[c] = d[c] === undefined || d[c] === null ? "" : d[c];
  });
  return r;
}

function lessonRows(lessonDocs) {
  return LESSONS.map((l) => {
    const d = lessonDocs.find((x) => x.id === String(l.id)) || {};
    return { id: l.id, title: d.title || l.title, topic: d.topic || l.topic,
             summary: d.summary || l.summary || "", practice: d.practice || "" };
  });
}

function buildWorkbook(rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(INSTRUCTIONS.map((t) => [t])), "Instructions");
  Object.keys(SHEETS).forEach((name) => {
    const S = SHEETS[name];
    const aoa = [S.cols, ...(rows[name] || []).map((r) => S.cols.map((c) => (r[c] === undefined ? "" : r[c])))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = S.cols.map((c) => ({ wch: WIDE.includes(c) ? 60 : MID.includes(c) ? 30 : 16 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  return wb;
}

function needXlsx() {
  if (typeof XLSX === "undefined") {
    alert("The Excel library did not load. Check your internet connection and refresh the page.");
    return true;
  }
  return false;
}

$("tplBtn")?.addEventListener("click", async () => {
  if (needXlsx()) return;
  const rows = { ...TEMPLATE_ROWS };
  rows.Lessons = lessonRows([]);
  XLSX.writeFile(buildWorkbook(rows), "sakura-n5-template.xlsx");
});

$("expBtn")?.addEventListener("click", async () => {
  if (needXlsx()) return;
  $("expBtn").disabled = true;
  try {
    const rows = { Lessons: lessonRows(await getAll("lessons")) };
    for (const name of ["Vocabulary", "Grammar", "Kanji", "Quizzes", "MockExams"]) {
      const docs = await getAll(SHEETS[name].col);
      if (SHEETS[name].lesson) docs.sort((a, b) => (a.lessonId || 0) - (b.lessonId || 0));
      rows[name] = docs.map((d) => toRow(name, d));
    }
    XLSX.writeFile(buildWorkbook(rows), "sakura-n5-content.xlsx");
  } catch (e) {
    alert("Could not export: " + e.message);
  }
  $("expBtn").disabled = false;
});

/* ---------- Read an Excel file and plan the changes ---------- */
function parseRow(name, r) {
  const S = SHEETS[name];
  const data = {};
  if (S.lesson) {
    const n = Number(s(r.lessonId));
    if (!Number.isInteger(n) || n < 1 || n > LESSONS.length)
      return { error: "lessonId must be a number from 1 to " + LESSONS.length };
    data.lessonId = n;
  }
  if (S.quiz) {
    const options = LETTERS.map((L) => s(r["option" + L]));
    if (options.some((o) => !o)) return { error: "all four options (optionA to optionD) are required" };
    const a = s(r.answer).toUpperCase();
    const idx = LETTERS.includes(a) ? LETTERS.indexOf(a) : ["1", "2", "3", "4"].includes(a) ? Number(a) - 1 : -1;
    if (idx < 0) return { error: "answer must be A, B, C or D" };
    data.options = options;
    data.answer = idx;
  }
  S.cols.forEach((c) => {
    if (["id", "delete", "lessonId", "answer"].includes(c) || c.startsWith("option")) return;
    data[c] = s(r[c]);
  });
  if (name === "MockExams" && !MOCK_SECTIONS.includes(data.section))
    return { error: "section must be Vocabulary, Grammar or Reading" };
  if (!data[S.req]) return { error: "'" + S.req + "' is empty" };
  return { data };
}

async function plan(wb) {
  const ops = [], errors = [], summary = {};
  let t = Date.now();

  for (const name of Object.keys(SHEETS)) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const S = SHEETS[name];
    const c = (summary[name] = { add: 0, update: 0, del: 0 });
    const existing = name === "Lessons" ? null : new Set((await getAll(S.col)).map((d) => d.id));
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    rows.forEach((raw, i) => {
      const r = {};
      Object.keys(raw).forEach((k) => (r[k.trim()] = raw[k]));
      if (Object.values(r).every((v) => s(v) === "")) return;
      const where = name + ", row " + (i + 2) + ": ";

      if (name === "Lessons") {
        const n = Number(s(r.id));
        if (!Number.isInteger(n) || n < 1 || n > LESSONS.length) {
          errors.push(where + "id must be a lesson number from 1 to " + LESSONS.length);
          return;
        }
        ops.push({ type: "setLesson", id: n, data: {
          id: n, volume: n <= 12 ? 1 : 2,
          title: s(r.title), topic: s(r.topic), summary: s(r.summary), practice: s(r.practice) } });
        c.update++;
        return;
      }

      const id = s(r.id);
      const del = s(r.delete).toUpperCase() === "YES";
      if (id && !existing.has(id)) { errors.push(where + "id '" + id + "' was not found. Leave id empty for a new row."); return; }
      if (del) {
        if (!id) { errors.push(where + "a row with no id cannot be deleted"); return; }
        ops.push({ type: "delete", col: S.col, id });
        c.del++;
        return;
      }
      const p = parseRow(name, r);
      if (p.error) { errors.push(where + p.error); return; }
      if (id) { ops.push({ type: "update", col: S.col, id, data: p.data }); c.update++; }
      else { ops.push({ type: "add", col: S.col, data: p.data, t: t++ }); c.add++; }
    });
  }
  return { ops, errors, summary };
}

/* ---------- Apply ---------- */
async function apply(ops) {
  const SIZE = 15;   // small groups keep every group within Firestore's rule-check limits
  let done = 0;
  try {
    for (let i = 0; i < ops.length; i += SIZE) {
      const batch = writeBatch(db);
      ops.slice(i, i + SIZE).forEach((op) => {
        if (op.type === "add")
          batch.set(doc(collection(db, op.col)), { ...op.data, createdAt: Timestamp.fromMillis(op.t) });
        else if (op.type === "update") batch.set(doc(db, op.col, op.id), op.data, { merge: true });
        else if (op.type === "delete") batch.delete(doc(db, op.col, op.id));
        else if (op.type === "setLesson")
          batch.set(doc(db, "lessons", String(op.id)), { ...op.data, updatedAt: serverTimestamp() }, { merge: true });
      });
      await batch.commit();
      done += Math.min(SIZE, ops.length - i);
      $("xlStatus").textContent = "Importing... " + done + " of " + ops.length;
    }
  } catch (e) {
    throw new Error(done + " of " + ops.length + " changes were saved before this error: " + e.message);
  }
}

/* ---------- Page wiring ---------- */
let pending = null;

function line(text) {
  const p = document.createElement("p");
  p.textContent = text;
  $("xlPreview").appendChild(p);
}

$("xlFile")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  pending = null;
  $("applyBtn").hidden = true;
  $("xlPreview").innerHTML = "";
  $("xlStatus").textContent = "";
  if (!file) return;
  if (needXlsx()) return;

  $("xlStatus").textContent = "Reading the file...";
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const { ops, errors, summary } = await plan(wb);
    $("xlStatus").textContent = "";

    Object.entries(summary).forEach(([name, c]) =>
      line(name + ": " + c.add + " new, " + c.update + " updated, " + c.del + " deleted"));

    if (errors.length) {
      line("");
      line("❌ Fix these " + errors.length + " problem(s) in Excel, then choose the file again:");
      errors.slice(0, 30).forEach((m) => line("• " + m));
      if (errors.length > 30) line("...and " + (errors.length - 30) + " more.");
      return;
    }
    if (!ops.length) { line("Nothing to import. The sheets are empty."); return; }
    line("");
    line("✅ The file is valid. " + ops.length + " change(s) are ready.");
    pending = ops;
    $("applyBtn").hidden = false;
  } catch (err) {
    $("xlStatus").textContent = "Could not read this file: " + err.message;
  }
});

$("applyBtn")?.addEventListener("click", async () => {
  if (!pending) return;
  const del = pending.filter((o) => o.type === "delete").length;
  let msg = "Import " + pending.length + " change(s) now?";
  if (del) msg += "\n\n" + del + " item(s) will be DELETED. This cannot be undone.";
  if (!confirm(msg)) return;

  $("applyBtn").disabled = true;
  try {
    await apply(pending);
    alert("Import finished.");
    location.reload();
  } catch (e) {
    alert(e.message + "\n\nBefore importing again, click 'Export current content' to see what was already saved.");
    $("applyBtn").disabled = false;
  }
});
