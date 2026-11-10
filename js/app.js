// アプリ層：画面（ホーム・章・出題・復習・一覧・使い方・書き出し・セルフテスト）とルーティング。
(function () {
  'use strict';
  const { PLAN, QUESTION_TYPES: TYPE_LABEL, Catalog, Question, Progress, UNIT_DIGITS, Schedule } = MoT;
  const { esc, md, mdInline, fmt, stars, toast, copy, download } = MoT.View;

  const $app = document.getElementById('app');
  const h = html => { $app.innerHTML = html; };
  const $$ = (sel, f) => $app.querySelectorAll(sel).forEach(f);

  function statBar(st) {
    const p = n => (st.total ? n / st.total * 100 : 0) + '%';
    return `<div class="bar" title="定着 ${st.by[2]} / 学習中 ${st.by[1]} / 未学習 ${st.by[0]}"><i style="width:${p(st.by[2])};background:var(--ok)"></i><i style="width:${p(st.by[1])};background:var(--accent)"></i></div>
    <div class="small muted">定着 ${st.by[2]}・学習中 ${st.by[1]}・未学習 ${st.by[0]}（全${st.total}問）</div>`;
  }
  function renderNav() {
    const r = location.hash || '#/';
    const due = Progress.due().length;
    const items = [['#/', 'ホーム'], ['#/review', '今日の復習' + (due ? `<span class="badge">${due}</span>` : '')], ['#/stories', 'ケース'], ...(MoT.Drill ? [['#/drill', '財務諸表ドリル']] : []), ['#/cards', '一問一答'], ['#/guide', '使い方'], ['#/export', '書き出し']];
    document.getElementById('nav').innerHTML = items.map(([href, label]) =>
      `<a href="${href}" class="${(href === '#/' ? r === '#/' || r === '' : r.startsWith(href)) ? 'on' : ''}">${label}</a>`).join('');
  }
  function record(id, rating) { Progress.record(id, rating); renderNav(); }

  // ===== ホーム =====
  function viewHome() {
    const due = Progress.due().length, fresh = Progress.fresh().length;
    h(`<h1>MoT 財務・戦略 用語ドリル</h1>
    <div class="card hero"><div>
      <div class="muted small">今日の復習</div>
      <div class="big">${due}<span class="small muted" style="font-size:14px;font-weight:400"> 問　＋ 新しい問題 ${fresh} 問</span></div>
      <div class="small muted">間違えた問題は翌日、できた問題は 1→3→7→21→45日後 に自動で再出題します。</div></div>
      <a class="btn primary" href="#/review">今日の復習をはじめる</a></div>
    <h2>学ぶ順番（A → F）</h2>
    <p class="muted small">A〜Eは「キャッシュを生む → 資本効率をはかる → 資本の調達コスト → 企業価値 → 投資判断」という1本の流れ。Fは戦略の枠組み。全章を通して、架空の会社「ミナト精機」を例に使います。</p>
    <div class="grid">${PLAN.map(p => {
      const c = Catalog.chapter(p.id);
      if (!c) return `<div class="card ch-card off"><div class="ch-id">${p.id}章</div><h3>${p.title}</h3><ul>${p.items.map(i => `<li>${i}</li>`).join('')}</ul><div><span class="chip">準備中</span></div></div>`;
      return `<div class="card ch-card"><div class="ch-id">${p.id}章</div><h3>${c.title}</h3><ul>${p.items.map(i => `<li>${i}</li>`).join('')}</ul>
        ${statBar(Progress.chapterStats(p.id))}
        <div class="row" style="margin-top:6px"><a class="btn primary" href="#/ch/${p.id}/learn">解説を読む</a><a class="btn" href="#/ch/${p.id}/quiz">問題</a>${hasSims(c) ? `<a class="btn" href="#/ch/${p.id}/sim">シミュレーター</a>` : ''}</div></div>`;
    }).join('')}</div>
    ${MoT.Stories && MoT.Stories.list().length ? `<h2>G　ケーススタディ（実例のストーリー問題）</h2>
    <p class="muted small">A〜Fで学んだ指標を、実際の企業の出来事で使う。「何を判断したいから、どの資料を開くか」を場面ごとに選びながら進める。</p>
    <div class="grid">${MoT.Stories.list().map(MoT.Stories.cardHtml).join('')}</div>
    <div class="row"><a class="btn" href="#/stories">ケーススタディの一覧と「判断 × 資料」の対応表</a></div>` : ''}
    ${MoT.Drill ? `<h2>H　財務諸表ドリル（AGCの実データ）</h2>
    <p class="muted small">AGCの実際のB/S・P/L・C/F（2025年12月期の有価証券報告書）を左に並べ、そこから自分で数字を探して指標を計算する。答えると、使った項目が財務諸表の上で色分けされる。</p>
    <div class="card ch-card"><h3>財務諸表から計算する ${MoT.Drill.count}問</h3><ul><li>収益性（ROE・ROIC・デュポン分解）</li><li>効率（回転率・CCC）・安全性（流動比率・D/E・カバレッジ）</li><li>キャッシュフロー（EBITDA・FCF）・株価と株主還元（EPS・PBR・DOE・EV/EBITDA）</li></ul>
      <div class="row" style="margin-top:6px"><a class="btn primary" href="#/drill">はじめる</a></div></div>` : ''}
    ${MoT.CASE ? `<details class="card case"><summary>全章で使う例：架空の会社「ミナト精機」の数値</summary><div class="md" style="margin-top:10px">${md(MoT.CASE)}</div></details>` : ''}`);
  }
  const hasSims = c => (c.sims || []).some(id => window.SIMS[id]);

  // ===== 章ページ =====
  // 全体マップ：rows = [[{n:ノード名, s:補足, hl:強調}, {a:矢印の説明}, {t:記号}], ...]
  function mapHtml(rows) {
    if (!rows) return '';
    return `<div class="flow">${rows.map(r => `<div class="flow-row">${r.map(x =>
      x.n != null ? `<div class="node ${x.hl ? 'hl' : ''}">${esc(x.n)}${x.s ? `<small>${esc(x.s)}</small>` : ''}</div>`
      : x.a != null ? `<span class="arrow">${esc(x.a)}</span>` : `<span class="muted">${esc(x.t)}</span>`).join('')}</div>`).join('')}</div>`;
  }
  function viewChapter(id, tab) {
    const c = Catalog.chapter(id);
    if (!c) { h(`<p>この章はまだ準備中です。</p><a class="btn" href="#/">ホームへ</a>`); return; }
    const tabs = [['learn', '解説'], ['sim', 'シミュレーター'], ['quiz', '問題']].filter(([k]) => k !== 'sim' || hasSims(c));
    const head = `<div class="small muted"><a href="#/">ホーム</a> › ${id}章</div><h1>${id}章　${c.title}</h1>
      <nav class="tabs">${tabs.map(([k, l]) => `<a href="#/ch/${id}/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>`;
    if (tab === 'sim') return viewSims(c, head);
    if (tab === 'quiz') return viewQuizMenu(c, head);
    const pre = c.questions.filter(q => q.pretest);
    h(head + `
      <div class="card"><div class="md">${md(c.lead)}</div></div>
      ${pre.length ? `<div class="card" style="border-color:var(--accent)"><div class="sec" style="margin:0"><div class="lbl">STEP 0　事前テスト</div>
        <p style="margin:4px 0 10px">解説を読む前に、まず${pre.length}問だけ解いてみよう。<strong>間違えてかまいません。</strong>先に問いを持っておくと、解説が頭に残りやすくなります。</p>
        <button class="btn primary" data-act="pretest">事前テストを解く（${pre.length}問）</button></div></div>` : ''}
      <h2>全体マップ</h2>
      <div class="card">${mapHtml(c.map)}<div class="md" style="margin-top:12px">${md(c.mapText)}</div></div>
      <div class="term-nav">${c.terms.map(t => `<a class="chip acc" href="#/ch/${id}/learn/${t.id}">${t.id} ${esc(t.name)}</a>`).join('')}<a class="chip" href="#/ch/${id}/learn/sup">補足用語</a></div>
      ${c.terms.map(t => termHtml(c, t)).join('')}
      <div class="card term" id="sup"><h2 style="margin-top:0">補足用語</h2><p class="muted small">本文を理解するのに必要な周辺の用語。詳しくは関連する章で扱う。</p>
        ${c.supplements.map(s => `<div class="sec"><strong>${esc(s.name)}</strong><div class="md">${md(s.text)}</div></div>`).join('')}</div>`);
    $$('[data-act=pretest]', b => b.addEventListener('click', () => startSession(pre.map(q => Question.instantiate(q)), `${id}章 事前テスト`, `#/ch/${id}/learn`)));
    $$('[data-reveal]', b => b.addEventListener('click', () => { b.outerHTML = `<div class="oneliner">${esc(b.dataset.reveal)}</div>`; }));
    $$('[data-term]', b => b.addEventListener('click', () => {
      const qs = c.questions.filter(q => q.term === b.dataset.term && !q.pretest);
      startSession(qs.map(q => Question.instantiate(q)), `${b.dataset.term} ${Catalog.termName(id, b.dataset.term)} の問題`, `#/ch/${id}/learn/${b.dataset.term}`);
    }));
  }
  function termHtml(c, t) {
    const n = c.questions.filter(q => q.term === t.id && !q.pretest).length;
    const sec = (no, lbl, body) => body ? `<div class="sec"><div class="lbl">${no}　${lbl}</div><div class="md">${md(body)}</div></div>` : '';
    return `<div class="card term" id="${t.id}">
      <div class="term-head"><span class="ch-id">${t.id}</span><h2>${esc(t.name)}</h2>${t.en ? `<span class="muted small">${esc(t.en)}</span>` : ''}</div>
      <div class="sec"><div class="lbl">①　一言でいうと</div><button class="reveal" data-reveal="${esc(t.oneLiner)}">まず自分の言葉で一言にしてから、クリックして答え合わせ</button></div>
      ${sec('②', '定義・式', t.formula + '\n\n' + (t.symbols || ''))}
      ${sec('③', 'なぜそうなるか', t.why)}
      ${sec('　', '計算の手順', t.steps)}
      ${sec('④', '具体例', t.example)}
      ${sec('⑤', 'よくある誤解・ひっかけ', t.pitfalls)}
      ${sec('⑥', '似た用語・方法との違い', t.compare)}
      ${t.links && t.links.length ? `<div class="sec"><div class="lbl">⑦　つながる用語</div><div class="row">${t.links.map(l => `<span class="chip">${esc(l)}</span>`).join('')}</div></div>` : ''}
      <div class="sec"><div class="lbl">⑧　練習問題</div><button class="btn primary" data-term="${t.id}">${esc(t.name)} の問題を解く（${n}問）</button></div></div>`;
  }
  function viewQuizMenu(c, head) {
    const qs = c.questions;
    const sets = [
      ['all', '全問（シャッフル）', qs, 'すべての問題を、用語を混ぜて出題。似た概念を見分ける力がつく（交互練習）。'],
      ['pretest', '事前テスト', qs.filter(q => q.pretest), '解説を読む前に解く問題。'],
      ['inter', '似た用語を見分ける問題', qs.filter(q => q.interleave), '紛らわしい用語どうしを見分ける問題。'],
      ['weak', '苦手な問題', qs.filter(q => { const k = Progress.card(q.id); return k && k.box === 0; }), '最後に「忘れた」か不正解だった問題。'],
      ['new', 'まだ解いていない問題', qs.filter(q => Progress.isNew(q.id)), ''],
    ];
    h(head + `<div class="card">${statBar(Progress.chapterStats(c.id))}</div>
      <h2>まとめて解く</h2>
      <div class="grid">${sets.map(([k, l, list, d]) => `<div class="card ch-card"><h3>${l}</h3><div class="small muted">${d}</div>
        <div><button class="btn ${k === 'all' ? 'primary' : ''}" data-set="${k}" ${list.length ? '' : 'disabled'}>${list.length}問を解く</button></div></div>`).join('')}</div>
      <h2>用語別</h2>
      <div class="row">${c.terms.map(t => `<button class="btn" data-tset="${t.id}">${t.id} ${esc(t.name)}（${qs.filter(q => q.term === t.id).length}）</button>`).join('')}</div>
      <h2>形式別</h2>
      <div class="row">${Object.keys(TYPE_LABEL).map(k => { const n = qs.filter(q => q.type === k).length; return `<button class="btn" data-type="${k}" ${n ? '' : 'disabled'}>${TYPE_LABEL[k]}（${n}）</button>`; }).join('')}</div>
      <p class="small muted" style="margin-top:16px">一問一答・説明問題は自分で「覚えた／あいまい／忘れた」を選びます。選択・計算問題は自動で採点します。結果は復習スケジュールに反映されます。</p>`);
    const run = (list, title) => startSession(Question.shuffle(list).map(q => Question.instantiate(q)), title, `#/ch/${c.id}/quiz`);
    $$('[data-set]', b => b.addEventListener('click', () => { const s = sets.find(x => x[0] === b.dataset.set); run(s[2], `${c.id}章 ${s[1]}`); }));
    $$('[data-tset]', b => b.addEventListener('click', () => run(qs.filter(q => q.term === b.dataset.tset), `${b.dataset.tset} ${Catalog.termName(c.id, b.dataset.tset)}`)));
    $$('[data-type]', b => b.addEventListener('click', () => run(qs.filter(q => q.type === b.dataset.type), `${c.id}章 ${TYPE_LABEL[b.dataset.type]}`)));
  }
  function viewSims(c, head) {
    const ids = (c.sims || []).filter(id => window.SIMS[id]);
    h(head + ids.map(id => `<div class="card"><h2 style="margin-top:0">${SIMS[id].title}</h2><p class="muted small">${SIMS[id].desc}</p><div data-sim="${id}"></div></div>`).join(''));
    $$('[data-sim]', el => SIMS[el.dataset.sim].render(el));
  }

  // ===== 出題セッション =====
  let SES = null;
  function startSession(items, title, back) {
    if (!items.length) { toast('対象の問題がありません'); return; }
    SES = { items, i: 0, title, back: back || '#/', res: { good: 0, hard: 0, again: 0 }, wrong: [] };
    if (location.hash === '#/session') viewSession(); else location.hash = '#/session';
  }
  function viewSession() {
    if (!SES) { location.hash = '#/'; return; }
    if (SES.i >= SES.items.length) return viewSummary();
    const q = SES.items[SES.i], total = SES.items.length;
    h(`<div class="small muted"><a href="${SES.back}">← 戻る</a>　${esc(SES.title)}</div>
      <div class="progress" style="margin-top:8px"><i style="width:${SES.i / total * 100}%"></i></div>
      <div class="card" id="qcard">
        <div class="q-meta"><span class="chip acc">${q.id}</span><span class="chip">${q.term} ${esc(Catalog.termName(q.ch, q.term))}</span><span class="chip">${TYPE_LABEL[q.type]}</span>
          ${q.pretest ? '<span class="chip warn">事前テスト</span>' : ''}${q.interleave ? '<span class="chip">見分け</span>' : ''}<span class="small muted">${stars(q.level || 1)}　${SES.i + 1} / ${total}</span></div>
        <div class="q-text md">${md(q.q)}</div><div id="qbody"></div></div>`);
    ({ flash: qFlash, mcq: qMcq, num: qNum, explain: qExplain })[q.type](q, document.getElementById('qbody'));
  }
  function next(r) {
    const q = SES.items[SES.i];
    record(q.id, r); SES.res[r]++;
    if (r === 'again') { SES.wrong.push(q.id); if (!q._again) SES.items.push(Object.assign(Question.instantiate(Catalog.question(q.id)), { _again: true })); }
    SES.i++; viewSession(); window.scrollTo(0, 0);
  }
  const rateHtml = (lbl = '思い出せた？') => `<div class="rate"><div class="lbl">${lbl}</div><div class="row">
    <button class="btn ng" data-r="again">忘れた（明日もう一度）</button><button class="btn warn" data-r="hard">あいまい</button><button class="btn ok" data-r="good">覚えた</button></div></div>`;
  const bindRate = el => el.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => next(b.dataset.r)));

  function qFlash(q, el) {
    el.innerHTML = `<p class="small muted">頭の中で（できれば声に出して）答えてから、答えを見よう。</p><button class="btn primary" id="show">答えを見る</button>`;
    el.querySelector('#show').addEventListener('click', () => {
      el.innerHTML = `<div class="answer"><div class="md">${md(q.a)}</div>${q.explain ? `<div class="md small muted" style="margin-top:6px">${md(q.explain)}</div>` : ''}</div>${rateHtml()}`;
      bindRate(el);
    });
  }
  function qMcq(q, el) {
    el.innerHTML = `<div class="choices">${q.order.map((ci, k) => `<button class="choice" data-c="${ci}"><b>${'ABCDE'[k]}</b><span class="md">${md(q.choices[ci])}</span></button>`).join('')}</div><div id="res"></div>`;
    el.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => {
      const pick = +b.dataset.c, ok = pick === q.answer;
      el.querySelectorAll('.choice').forEach(x => { x.disabled = true; if (+x.dataset.c === q.answer) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      el.querySelector('#res').innerHTML = `<div class="answer ${ok ? 'ok' : 'ng'}"><div class="verdict">${ok ? '正解' : '不正解'}</div><div class="md">${md(q.explain)}</div></div>
        <div class="row" style="margin-top:12px"><button class="btn primary" data-r="${ok ? 'good' : 'again'}">次へ</button></div>`;
      bindRate(el);
    }));
  }
  function parseNum(s) {
    s = String(s).replace(/[０-９．－，]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[,\s%％倍円億万年]/g, '');
    return s === '' ? NaN : Number(s);
  }
  function qNum(q, el) {
    const d = UNIT_DIGITS[q.unit] ?? 2;
    el.innerHTML = `<div class="num-in"><input type="text" inputmode="decimal" id="ans" placeholder="数値を入力" autocomplete="off"><span>${esc(q.unit)}</span><button class="btn primary" id="chk">答え合わせ</button><button class="btn" id="skip">わからない・答えを見る</button></div>
      <p class="small muted">紙に途中式を書いてから入力しよう。小数は${d}桁程度、誤差${fmt((q.tol || 0.01) * 100, 1)}%以内なら正解。</p><div id="res"></div>`;
    const input = el.querySelector('#ans');
    setTimeout(() => input.focus(), 50);
    const check = skip => {
      const x = skip ? NaN : parseNum(input.value);
      if (!skip && isNaN(x)) { toast('数値を入力してください'); return; }
      const ok = !skip && Question.isCorrect(q, x, d);
      input.disabled = true; el.querySelector('#chk').disabled = true; el.querySelector('#skip').disabled = true;
      el.querySelector('#res').innerHTML = `<div class="answer ${ok ? 'ok' : 'ng'}"><div class="verdict">${ok ? '正解' : skip ? '答えを確認' : '不正解'}　正解：${fmt(q.answer, d)} ${esc(q.unit)}</div><div class="md">${md(q.explain)}</div></div>
        <div class="row" style="margin-top:12px"><button class="btn primary" data-r="${ok ? 'good' : 'again'}">次へ</button><button class="btn" id="again">数値を変えてもう1問（記録しない）</button></div>`;
      bindRate(el);
      el.querySelector('#again').addEventListener('click', () => { Object.assign(q, Question.instantiate(Catalog.question(q.id))); viewSession(); });
    };
    el.querySelector('#chk').addEventListener('click', () => check(false));
    el.querySelector('#skip').addEventListener('click', () => check(true));
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !input.disabled) check(false); });
  }
  function qExplain(q, el) {
    el.innerHTML = `<p class="small muted">人に説明するつもりで書こう（ファインマン・テクニック）。説明できない部分が、まだ理解できていない部分です。</p>
      <textarea id="mine" rows="5" placeholder="自分の説明を書く（声に出して説明するだけでもOK）"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn primary" id="show">模範解答と採点観点を見る</button></div>`;
    el.querySelector('#show').addEventListener('click', () => {
      const mine = el.querySelector('#mine').value;
      el.innerHTML = `<div class="answer"><div class="small muted">あなたの説明</div><div>${mine ? esc(mine).replace(/\n/g, '<br>') : '<span class="muted">（未記入）</span>'}</div></div>
        <div class="answer"><div class="verdict">模範解答</div><div class="md">${md(q.a)}</div></div>
        <div class="answer rubric"><div class="verdict">採点観点（自分でチェック）</div>${q.rubric.map(r => `<label><input type="checkbox"><span class="md">${md(r)}</span></label>`).join('')}</div>
        <div class="row" style="margin-top:10px"><button class="btn" id="gem">Geminiに採点してもらうプロンプトをコピー</button></div>${rateHtml('説明できた？')}`;
      el.querySelector('#gem').addEventListener('click', () => copy(
`次の問題に対する私の説明を、採点観点に沿って100点満点で採点してください。足りない観点を指摘し、私の説明を活かした改善例を示してください。

【問題】${q.q}
【採点観点】
${q.rubric.map(r => '- ' + r).join('\n')}
【模範解答】${q.a}
【私の説明】${mine || '（未記入）'}`));
      bindRate(el);
    });
  }
  function viewSummary() {
    const r = SES.res, n = r.good + r.hard + r.again, wrong = [...new Set(SES.wrong)];
    h(`<div class="small muted"><a href="${SES.back}">← 戻る</a></div><h1>おつかれさまでした</h1>
      <div class="card"><div class="kpis">${MoT.View.kpis([{ k: '覚えた・正解', v: r.good, tone: 'ok' }, { k: 'あいまい', v: r.hard }, { k: '忘れた・不正解', v: r.again, tone: 'ng' }, { k: '回答数', v: n }])}</div>
        ${wrong.length ? `<p>間違えた問題：${wrong.map(id => `<span class="chip">${id}</span>`).join(' ')}<br><span class="small muted">これらは明日の「今日の復習」にもう一度出ます。</span></p>` : '<p>全問クリア。次の復習日に再出題されます。</p>'}
        <div class="row"><a class="btn primary" href="${SES.back}">戻る</a><a class="btn" href="#/">ホーム</a></div></div>`);
  }

  // ===== 今日の復習 =====
  function viewReview() {
    const due = Progress.due(), fresh = Progress.fresh();
    const list = Question.shuffle(due).concat(fresh);
    if (!list.length) { h(`<h1>今日の復習</h1><div class="card"><p>今日の復習はありません。次の章を読むか、シミュレーターで遊んでみよう。</p><a class="btn" href="#/">ホーム</a></div>`); return; }
    startSession(list.map(q => Question.instantiate(q)), `今日の復習（復習 ${due.length}問＋新規 ${fresh.length}問）`, '#/');
  }

  // ===== 一問一答一覧 =====
  function viewCards() {
    h(`<h1>一問一答一覧</h1><p class="muted small">質問を見て答えを思い出してから開こう。印刷して持ち歩くこともできます。</p>
      ${Catalog.chapters.map(c => `<h2>${c.id}章　${c.title}</h2><div class="card">${c.questions.filter(q => q.type === 'flash' || q.type === 'mcq').map(q => `
        <details class="qa"><summary><span class="chip acc">${q.id}</span> <span class="md" style="display:inline">${mdInline(q.q)}</span></summary>
        <div class="a md">${q.type === 'flash' ? md(q.a) : '<strong>' + mdInline(q.choices[q.answer]) + '</strong>'}${md(q.explain)}</div></details>`).join('')}</div>`).join('')}`);
  }

  // ===== 使い方 =====
  const METHODS = [
    ['想起練習', '読み返すより「思い出す」方が記憶に残る（テスト効果）', '一問一答、選択・計算問題、「一言でいうと」を隠して答え合わせ'],
    ['分散学習', '間隔を空けて繰り返すと長く残る', '「今日の復習」で 1→3→7→21→45日後 に自動で再出題'],
    ['事前テスト', '学ぶ前に解いて間違えると、その後の学習が定着しやすい', '各章の STEP 0'],
    ['精緻化質問', '「なぜそうなるか」を自分で説明する', '各用語の「③ なぜそうなるか」、説明問題'],
    ['交互練習', '似た概念を混ぜて解くと見分ける力がつく', '全問シャッフル、「見分け」問題（ROE と ROIC など）'],
    ['二重符号化', '言葉と図をセットにする', '全体マップ、シミュレーターのグラフ'],
    ['具体例', '抽象的な定義を数字や場面に落とす', '架空の会社「ミナト精機」の例、数値が毎回変わる計算問題'],
    ['ファインマン・テクニック', '人に説明できるか確かめる', '説明問題＋Gemini での採点'],
  ];
  const GEMINI_PROMPT = `あなたは私のMoT（技術経営）財務の家庭教師です。添付の「解説＆問題集」の内容を根拠に、次のルールで学習を手伝ってください。

1. 問題は1問ずつ出す。私が答えるまで、正解や解説は見せない。
2. 私の答えを採点し、間違いのときは「どこで考え違いをしたか」を指摘してから解説する。
3. [計算] の問題は数値を変えて出題してよい。必ず途中式を示し、計算は検算する。
4. [説明] の問題は「採点観点」に沿って100点満点で採点し、足りない観点を指摘する。
5. 間違えた問題は、形を変えて後でもう一度出す。
6. ときどき「なぜそうなるのか？」と私に説明させる。
7. 似た用語（ROEとROIC、WACCと株主資本コストなど）は混ぜて出題する。
8. 資料にないことを聞かれたら、資料外の知識だと明示してから答える。

最初に、どの章を学ぶか私に聞いてください。`;

  function viewGuide() {
    h(`<h1>使い方</h1>
    <div class="card"><h2 style="margin-top:0">おすすめの1日の流れ（15〜20分）</h2>
      <ol><li><strong>今日の復習</strong>を解く（期限が来た問題＋新しい問題${Progress.NEW_PER_DAY}問）</li>
      <li>新しい章は <strong>事前テスト → 解説 → 用語別の問題</strong> の順に進める</li>
      <li>週に1回、<strong>シミュレーター</strong>で前提を動かし、「なぜそうなるか」を自分の言葉で説明してみる</li>
      <li>説明問題はGeminiに採点してもらう</li></ol></div>
    <div class="card"><h2 style="margin-top:0">このアプリに取り入れた学習法</h2>
      <div class="md"><table><thead><tr><th>学習法</th><th>内容</th><th>アプリのどこで使っているか</th></tr></thead><tbody>
      ${METHODS.map(m => `<tr><td><strong>${m[0]}</strong></td><td>${m[1]}</td><td>${m[2]}</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">主な出典：Dunlosky et al. (2013) の学習法レビュー、Roediger &amp; Karpicke (2006) のテスト効果、Bjork の「望ましい困難」。</p></div>
    <div class="card"><h2 style="margin-top:0">Gemini との併用</h2>
      <p>「書き出し」画面でダウンロードしたMarkdownファイルをGeminiに添付し、次の指示文を貼り付けて始めます。対話での深掘りや説明問題の採点はGemini、毎日のドリルと復習管理はこのアプリ、という分担です。</p>
      <textarea class="export" readonly style="min-height:260px">${esc(GEMINI_PROMPT)}</textarea>
      <div class="row" style="margin-top:8px"><button class="btn primary" id="cp">指示文をコピー</button></div></div>
    <div class="card"><h2 style="margin-top:0">記録について</h2>
      <p class="small">学習の記録は、このブラウザの中だけに保存されます（別のブラウザやPCとは共有されません。ブラウザのデータを消すと消えます）。</p>
      <div class="row"><button class="btn" id="bk">記録をファイルに保存</button><label class="btn">記録を読み込む<input type="file" id="rs" accept=".json" hidden></label><button class="btn ng" id="rst">記録をすべて消す</button></div></div>`);
    $app.querySelector('#cp').addEventListener('click', () => copy(GEMINI_PROMPT));
    $app.querySelector('#bk').addEventListener('click', () => download('mot-study-progress.json', JSON.stringify(Progress.state), 'application/json'));
    $app.querySelector('#rs').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { try { Progress.replace(JSON.parse(t)); renderNav(); toast('読み込みました'); } catch (err) { toast('読み込めませんでした'); } });
    });
    $app.querySelector('#rst').addEventListener('click', () => { if (confirm('学習の記録をすべて消します。よろしいですか？')) { Progress.reset(); renderNav(); toast('記録を消しました'); } });
  }

  // ===== Markdown 書き出し（Gemini 用） =====
  function buildMarkdown() {
    const L = [];
    L.push('# MoT 財務・戦略 用語 解説＆問題集', '');
    L.push('## このファイルの使い方（Geminiへの指示）', '', '以下の指示文に従って、このファイルの内容で私に出題してください。', '', '```', GEMINI_PROMPT, '```', '');
    L.push('## 取り入れている学習法', '', '| 学習法 | 内容 | 使い方 |', '|---|---|---|');
    METHODS.forEach(m => L.push(`| ${m[0]} | ${m[1]} | ${m[2]} |`));
    L.push('', '## 章の構成（全21項目＋ケーススタディ）', '');
    PLAN.forEach(p => L.push(`- **${p.id}章 ${p.title}**：${p.items.join('、')}${Catalog.chapter(p.id) ? '' : '（未収録）'}`));
    if (MoT.CASE) L.push('', '## 全章で使う例：架空の会社「ミナト精機」', '', MoT.CASE.trim());
    L.push('');
    Catalog.chapters.forEach(c => {
      L.push('---', '', `# ${c.id}章　${c.title}`, '', c.lead.trim(), '', '## 全体マップ', '', c.mapText.trim(), '');
      c.terms.forEach(t => {
        L.push(`## ${t.id}　${t.name}${t.en ? `（${t.en}）` : ''}`, '', `**① 一言でいうと：** ${t.oneLiner}`, '');
        const sec = (lbl, body) => { if (body) L.push(`### ${lbl}`, '', body.trim(), ''); };
        sec('② 定義・式', t.formula + '\n\n' + (t.symbols || ''));
        sec('③ なぜそうなるか', t.why); sec('計算の手順', t.steps); sec('④ 具体例', t.example);
        sec('⑤ よくある誤解・ひっかけ', t.pitfalls); sec('⑥ 似た用語・方法との違い', t.compare);
        if (t.links && t.links.length) L.push('### ⑦ つながる用語', '', t.links.map(x => '- ' + x).join('\n'), '');
      });
      L.push(`## ${c.id}章の補足用語`, '');
      c.supplements.forEach(s => L.push(`- **${s.name}**：${s.text.trim()}`));
      L.push('', `## ${c.id}章の問題`, '', '> 解答・解説はこの後の「解答・解説」にまとめています。先に自分で解いてから見てください。[計算] の問題は、Geminiが数値を変えて出題してもかまいません。', '');
      const insts = c.questions.map(q => Question.instantiate(q, Question.hash(q.id)));
      insts.forEach(q => {
        const tags = [q.pretest ? '事前テスト' : '', TYPE_LABEL[q.type], q.interleave ? '見分け' : '', stars(q.level || 1)].filter(Boolean).map(x => `[${x}]`).join('');
        L.push(`### ${q.id}　${tags}（${q.term} ${Catalog.termName(c.id, q.term)}）`, '', q.q.trim(), '');
        if (q.type === 'mcq') { q.choices.forEach((ch, i) => L.push(`${'ABCDE'[i]}. ${ch}`)); L.push(''); }
        if (q.type === 'num') L.push(`（答えの単位：${q.unit}）`, '');
      });
      L.push(`## ${c.id}章の解答・解説`, '');
      insts.forEach(q => {
        L.push(`### ${q.id}`, '');
        if (q.type === 'mcq') L.push(`**正解：${'ABCDE'[q.answer]}. ${q.choices[q.answer]}**`, '', q.explain.trim(), '');
        else if (q.type === 'num') L.push(`**正解：${fmt(q.answer, UNIT_DIGITS[q.unit] ?? 2)} ${q.unit}**（誤差${fmt((q.tol || 0.01) * 100, 1)}%以内なら正解）`, '', q.explain.trim(), '');
        else if (q.type === 'flash') L.push(`**答え：** ${q.a.trim()}`, '', q.explain ? q.explain.trim() : '', '');
        else L.push(`**模範解答：** ${q.a.trim()}`, '', '**採点観点：**', '', q.rubric.map(r => '- ' + r).join('\n'), '');
      });
    });
    if (MoT.Stories) L.push(MoT.Stories.toMarkdown());
    return L.join('\n').replace(/\n{3,}/g, '\n\n');
  }
  function viewExport() {
    const text = buildMarkdown();
    h(`<h1>書き出し（Gemini用Markdown）</h1>
      <div class="card"><p>解説・問題・解答をまとめたMarkdownファイルです。Gemini に添付して「このファイルの指示文に従って出題して」と送れば始められます。数式はLaTeX（$...$）で書いてあり、Geminiでもきれいに表示されます。</p>
      <div class="row"><button class="btn primary" id="dl">ダウンロード（.md）</button><button class="btn" id="cp">全文をコピー</button><span class="small muted">${text.length.toLocaleString()}文字</span></div></div>
      <textarea class="export" readonly id="md">${esc(text)}</textarea>`);
    $app.querySelector('#dl').addEventListener('click', () => download('MoT_財務_解説問題集.md', text));
    $app.querySelector('#cp').addEventListener('click', () => copy(text));
  }

  // ===== セルフテスト（教材データとシミュレーターの自動点検） =====
  function selfTest() {
    const errs = [], warns = [], info = [];
    const texOk = (src, where) => {
      if (!src || !window.katex) return;
      String(src).replace(/\$\$([\s\S]+?)\$\$/g, (m, t) => { chk(t, true); return ''; }).replace(/\$([^$\n]+?)\$/g, (m, t) => { chk(t, false); return ''; });
      function chk(t, d) { try { katex.renderToString(t, { displayMode: d, throwOnError: true, strict: 'ignore' }); } catch (e) { errs.push(`${where}: 数式エラー「${t.slice(0, 60)}」 ${e.message.slice(0, 80)}`); } }
    };
    const bad = (s) => /undefined|NaN|Infinity|\[object/.test(String(s));
    const ids = new Set();
    MoT.loadErrors.forEach(e => e.kind === 'missing' ? warns.push(`ファイルなし: ${e.file}`) : errs.push(`読み込みエラー: ${e.file}: ${e.msg}`));
    if (!window.katex) warns.push('KaTeX が読み込めていない（数式の点検をスキップ）');
    PLAN.forEach(p => { if (!Catalog.chapter(p.id)) warns.push(`${p.id}章：データ未登録`); });
    Catalog.chapters.forEach(c => {
      const where = `${c.id}章`;
      ['title', 'lead', 'mapText'].forEach(k => { if (!c[k]) errs.push(`${where}: ${k} がない`); });
      if (!c.map) warns.push(`${where}: map（全体マップの図）がない`);
      texOk(c.lead, where); texOk(c.mapText, where);
      const termIds = new Set(c.terms.map(t => t.id));
      c.terms.forEach(t => {
        ['id', 'name', 'oneLiner', 'formula', 'why', 'example', 'pitfalls', 'compare'].forEach(k => { if (!t[k]) errs.push(`${where} ${t.id}: ${k} がない`); });
        ['formula', 'symbols', 'why', 'steps', 'example', 'pitfalls', 'compare'].forEach(k => { texOk(t[k], `${where} ${t.id}.${k}`); if (t[k] && bad(t[k])) errs.push(`${where} ${t.id}.${k}: undefined等が混入`); });
        const n = c.questions.filter(q => q.term === t.id).length;
        if (n < 3) warns.push(`${where} ${t.id}: 問題が${n}問しかない`);
      });
      c.supplements.forEach(s => texOk(s.text, `${where} 補足 ${s.name}`));
      (c.sims || []).forEach(id => { if (!window.SIMS[id]) errs.push(`${where}: シミュレーター ${id} が未登録`); });
      const counts = {};
      c.questions.forEach(q => {
        const w = `${q.id}`;
        if (ids.has(q.id)) errs.push(`${w}: IDが重複`); ids.add(q.id);
        if (!new RegExp(`^Q-${c.id}-\\d{2}$`).test(q.id)) errs.push(`${w}: IDの形式が Q-${c.id}-NN でない`);
        if (!termIds.has(q.term)) errs.push(`${w}: term ${q.term} が章内にない`);
        if (!TYPE_LABEL[q.type]) errs.push(`${w}: type が不正`);
        counts[q.type] = (counts[q.type] || 0) + 1;
        try {
          if (q.type === 'mcq') { if (!Array.isArray(q.choices) || q.choices.length < 3 || !(q.answer >= 0 && q.answer < q.choices.length)) errs.push(`${w}: 選択肢か answer が不正`); q.choices.forEach(x => texOk(x, w)); }
          if (q.type === 'flash' && !q.a) errs.push(`${w}: a がない`);
          if (q.type === 'explain' && (!q.a || !Array.isArray(q.rubric) || q.rubric.length < 2)) errs.push(`${w}: a か rubric が不正`);
          if (q.type !== 'num') { texOk(q.q, w); texOk(q.a, w); texOk(q.explain, w); if (!q.q) errs.push(`${w}: q がない`); if (q.type !== 'explain' && !q.explain) warns.push(`${w}: explain がない`); }
          if (q.type === 'num') {
            if (typeof q.gen !== 'function') { errs.push(`${w}: gen がない`); return; }
            for (let s = 1; s <= 200; s++) {
              const x = Question.instantiate(q, s * 7919 + 13);
              if (!isFinite(x.answer)) { errs.push(`${w}: seed${s} で answer が有限でない`); break; }
              if (!x.q || !x.explain || !x.unit) { errs.push(`${w}: q/explain/unit がない`); break; }
              if (!(x.unit in UNIT_DIGITS)) warns.push(`${w}: 単位「${x.unit}」の表示桁が未定義（小数2桁で表示）`);
              if (bad(x.q) || bad(x.explain)) { errs.push(`${w}: seed${s} で文章に undefined/NaN`); break; }
              if (s <= 5) { texOk(x.q, w); texOk(x.explain, w); }
              if (!Question.isCorrect(x, x.answer, UNIT_DIGITS[x.unit] ?? 2)) { errs.push(`${w}: 正解値で正解判定にならない`); break; }
            }
          }
        } catch (e) { errs.push(`${w}: 例外 ${e.message}`); }
      });
      info.push(`${c.id}章: 用語${c.terms.length} / 問題${c.questions.length}（${Object.entries(counts).map(([k, v]) => TYPE_LABEL[k] + v).join('・')}）/ 事前テスト${c.questions.filter(q => q.pretest).length} / 見分け${c.questions.filter(q => q.interleave).length} / シミュレーター${(c.sims || []).length}`);
    });
    if (MoT.Drill) { try { MoT.Drill.selfTest(texOk, errs, warns, info); } catch (e) { errs.push('財務諸表ドリル: 例外 ' + e.message); } }
    if (MoT.Stories) { try { MoT.Stories.selfTest(texOk, errs, warns, info); } catch (e) { errs.push('ケーススタディ: 例外 ' + e.message); } }
    // シミュレーター：描画して、全スライダーを最小・最大・中間に動かしても例外が出ないか
    Object.keys(window.SIMS).forEach(id => {
      const box = document.createElement('div'); document.body.appendChild(box);
      try {
        SIMS[id].render(box);
        const rs = [...box.querySelectorAll('input[type=range]')];
        rs.forEach(r => [r.min, r.max, (+r.min + +r.max) / 2].forEach(v => { r.value = v; r.dispatchEvent(new Event('input')); }));
        if (bad(box.textContent)) errs.push(`sim ${id}: 表示に undefined/NaN`);
        info.push(`sim ${id}: OK（スライダー${rs.length}本）`);
      } catch (e) { errs.push(`sim ${id}: 例外 ${e.message}`); }
      box.remove();
    });
    try { const m = buildMarkdown(); if (bad(m)) warns.push('書き出しMarkdownに undefined/NaN 等の文字列あり'); info.push(`Markdown: ${m.length}文字`); } catch (e) { errs.push('Markdown書き出し: 例外 ' + e.message); }
    return { errs, warns, info };
  }
  function viewSelfTest() {
    const r = selfTest();
    const txt = [`RESULT: ${r.errs.length ? 'NG' : 'OK'}  errors=${r.errs.length} warnings=${r.warns.length}`, ...r.info.map(x => 'INFO ' + x), ...r.warns.map(x => 'WARN ' + x), ...r.errs.map(x => 'ERROR ' + x)].join('\n');
    h(`<h1>セルフテスト</h1><pre id="selftest-report" class="card" style="white-space:pre-wrap;font-size:12.5px">${esc(txt)}</pre>`);
  }

  // ===== ルーター =====
  function route() {
    renderNav();
    const p = (location.hash || '#/').slice(2).split('/');
    $app.classList.toggle('wide', p[0] === 'drill' && !!p[1]); // 財務諸表ドリルの設問画面は左右2列なので横幅を広げる
    window.scrollTo(0, 0);
    if (p[0] === 'ch') { viewChapter(p[1], p[2] || 'learn'); if (p[3]) { const el = document.getElementById(p[3]); if (el) el.scrollIntoView(); } }
    else if (p[0] === 'session') viewSession();
    else if (p[0] === 'review') viewReview();
    else if (p[0] === 'stories') MoT.Stories.viewList(h);
    else if (p[0] === 'story') MoT.Stories.viewStory(h, p[1]);
    else if (p[0] === 'drill' && MoT.Drill) { if (p[1]) MoT.Drill.viewQuestion(h, p[1]); else MoT.Drill.viewList(h); }
    else if (p[0] === 'cards') viewCards();
    else if (p[0] === 'guide') viewGuide();
    else if (p[0] === 'export') viewExport();
    else if (p[0] === 'selftest') viewSelfTest();
    else viewHome();
  }

  // 起動：章データを索引化し、記録を読み込む（セルフテストでは記録に触れない）
  Catalog.build(window.CHAPTERS);
  Progress.init((location.hash || '').startsWith('#/selftest') ? MoT.MemoryRepo : MoT.LocalStorageRepo);
  window.addEventListener('hashchange', route);
  route();
})();
