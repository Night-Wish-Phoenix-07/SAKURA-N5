<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hiragana and Katakana | SAKURA N5</title>
  <link rel="stylesheet" href="../css/style.css">
  <link rel="stylesheet" href="../css/dashboard.css">
  <link rel="stylesheet" href="../css/lessons.css">
  <link rel="stylesheet" href="../css/responsive.css">
  <style>
    .kgrid{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:8px;
      max-width:calc(var(--cols) * 110px)}
    .khead{text-align:center;font-size:.8rem;color:#777;font-weight:600}
    .kempty{min-height:64px}
    .kcell{display:flex;flex-direction:column;align-items:center;justify-content:center;
      min-height:64px;padding:6px 2px;background:#fff;border:1px solid var(--border);
      border-radius:10px;cursor:pointer;font:inherit;transition:.15s}
    .kcell:hover{border-color:var(--indigo);transform:translateY(-1px)}
    .kcell.on{background:#fff0f3;border-color:var(--red)}
    .kch{font-size:clamp(1.3rem,6vw,1.9rem);color:var(--red);font-weight:600;line-height:1.2}
    .kro{font-size:.75rem;color:var(--indigo)}

    .detail{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
    .d-char{font-size:4.5rem;color:var(--red);font-weight:600;line-height:1;min-width:90px;text-align:center}
    .d-romaji{font-size:1.2rem;color:var(--indigo);font-weight:600;text-align:center}
    .d-info{flex:1;min-width:200px}
    .d-word{font-size:1.6rem;color:var(--indigo);font-weight:600}
    .d-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .d-actions .btn{padding:8px 14px;font-size:.9rem}
    .admin-box{margin-top:16px;padding-top:14px;border-top:1px dashed var(--border);width:100%}

    .q-char{font-size:6rem;color:var(--red);font-weight:600;text-align:center;line-height:1.2}
    .q-top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
    #qOpts{grid-template-columns:repeat(2,minmax(0,1fr))}
    #qOpts .opt{text-align:center;font-size:1.1rem}
    @media (max-width:640px){
      .d-char{font-size:3.5rem}
      .q-char{font-size:4.5rem}
    }
  </style>
</head>
<body>
  <header class="nav">
    <a class="logo" href="../index.html">🌸 SAKURA N5</a>
    <nav>
      <a href="../index.html#lessons">Lessons</a>
      <a href="kana.html">Kana</a>
      <a href="dashboard.html">Dashboard</a>
      <a href="admin.html" id="adminLink" hidden>Admin</a>
      <button id="logoutBtn" class="btn btn-outline" hidden>Sign out</button>
    </nav>
  </header>

  <main class="container">
    <p class="jp">ひらがな・カタカナ</p>
    <h1 class="page-title">Hiragana and Katakana</h1>

    <div class="tabs" id="scriptTabs">
      <button data-script="hiragana" class="active">Hiragana ひらがな</button>
      <button data-script="katakana">Katakana カタカナ</button>
    </div>
    <div class="tabs" id="modeTabs">
      <button data-mode="chart" class="active">Chart</button>
      <button data-mode="test">Test me</button>
    </div>

    <!-- CHART MODE -->
    <section id="chartView">
      <div class="panel">
        <p class="note" id="dEmpty">Tap any character in the chart to hear it and see an example word.</p>
        <div id="dBody" hidden>
          <div class="detail">
            <div>
              <div class="d-char" id="dChar"></div>
              <div class="d-romaji" id="dRomaji"></div>
            </div>
            <div class="d-info">
              <div id="dExample" hidden>
                <p class="note">Example word</p>
                <div class="d-word" id="dWord"></div>
                <p id="dMeaning"></p>
              </div>
              <p class="note" id="dNoExample" hidden>No example word has been added for this character yet.</p>
              <div class="d-actions">
                <button type="button" class="btn" id="hearChar">🔊 Hear character</button>
                <button type="button" class="btn btn-outline-dark" id="hearWord">🔊 Hear word</button>
              </div>
            </div>
          </div>

          <div class="admin-box" id="adminBox" hidden>
            <h3>Admin: edit example word</h3>
            <form class="form" id="adminForm">
              <label>Word <input id="fWord" type="text" maxlength="40" autocomplete="off"></label>
              <label>Meaning (English) <input id="fMeaning" type="text" maxlength="80" autocomplete="off"></label>
              <div class="row">
                <button class="btn" id="saveBtn" type="submit">Save</button>
                <button class="btn btn-outline-dark" id="resetBtn" type="button" hidden>Back to built-in example</button>
              </div>
              <p class="note" id="saveMsg"></p>
            </form>
          </div>
        </div>
        <p class="note" id="soundNote"></p>
      </div>

      <div id="chart"></div>

      <div class="panel">
        <h2>Good to know</h2>
        <p>A small <span class="jp">っ / ッ</span> makes the next consonant double, for example <span class="jp">きって</span> (<em>kitte</em>, stamp).</p>
        <p>In katakana, <span class="jp">ー</span> stretches the vowel before it, for example <span class="jp">コーヒー</span> (<em>kōhī</em>, coffee).</p>
        <p>Sound comes from your device's own Japanese voice, so it may differ a little between phones and computers.</p>
      </div>
    </section>

    <!-- TEST MODE -->
    <section id="testView" hidden>
      <div class="panel">
        <div class="q-top">
          <label class="pick">Practise
            <select id="testSet">
              <option value="all">All characters</option>
              <option value="basic">Basic sounds</option>
              <option value="dakuten">Dakuten and handakuten</option>
              <option value="combo">Combination sounds</option>
            </select>
          </label>
          <div class="score" id="qScore" style="font-size:1.3rem;margin:0">Score: 0 / 0</div>
        </div>
        <div class="q-char" id="qChar"></div>
        <p class="note" style="text-align:center">How do you read this character?</p>
        <div class="opts" id="qOpts"></div>
        <p id="qFeedback" style="text-align:center;font-weight:600;min-height:1.6em"></p>
        <div class="pager" style="justify-content:center">
          <button type="button" class="btn btn-outline-dark" id="qHear">🔊 Hear it</button>
          <button type="button" class="btn" id="qNext" hidden>Next →</button>
        </div>
      </div>
    </section>
  </main>

  <footer>SAKURA N5 · Free for everyone 🌸</footer>
  <script type="module" src="../js/kana.js"></script>
</body>
</html>
