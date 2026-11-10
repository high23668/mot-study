// ドメイン層：教材（章・用語・問題）と学習ルール（復習スケジュール）。画面やブラウザAPIには依存しない。
(function () {
  'use strict';
  const MoT = (window.MoT = window.MoT || {});

  // 読み込みエラーの記録（セルフテストで表示）：構文エラーと、見つからないファイル
  MoT.loadErrors = [];
  window.addEventListener('error', e => {
    if (e.target && e.target.tagName === 'SCRIPT') MoT.loadErrors.push({ kind: 'missing', file: e.target.getAttribute('src') });
    else if (e.message) MoT.loadErrors.push({ kind: 'error', file: (e.filename || '').split('/').slice(-2).join('/'), msg: `${e.message} (行${e.lineno})` });
  }, true);

  // ---- 教材の全体計画（21項目） ----
  MoT.PLAN = [
    { id: 'A', title: 'お金の流れの基礎', items: ['設備投資と減価償却費', '運転資本と正味運転資本', 'EBITDA', 'NOPAT', 'フリー・キャッシュフロー'] },
    { id: 'B', title: '収益性', items: ['ROE, ROEの分解', 'ROICと分解', 'サステナブル成長率'] },
    { id: 'C', title: '資本コスト', items: ['資本コスト・株主資本コスト・WACC', 'CAPMによる株主資本コストの算出', '分散投資の効果'] },
    { id: 'D', title: '企業価値と株価', items: ['DCF法', 'PER', 'PBR', 'PBR＝ROE×PER', 'PBR＞1.0の条件'] },
    { id: 'E', title: '投資判断', items: ['NPV（正味現在価値）', 'IRR（内部収益率）', 'リアルオプション', 'VCメソッド'] },
    { id: 'F', title: '戦略分析', items: ['PPM分析', '5 forces'] },
  ];
  MoT.QUESTION_TYPES = { flash: '一問一答', mcq: '選択', num: '計算', explain: '説明' };

  // ---- 教材カタログ（章データファイルが window.CHAPTERS に登録したものを索引化） ----
  MoT.Catalog = {
    chapters: [], byChapter: {}, questions: [], byQuestion: {},
    build(list) {
      const order = MoT.PLAN.map(p => p.id);
      this.chapters = (list || []).slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      this.byChapter = {}; this.questions = []; this.byQuestion = {};
      this.chapters.forEach(c => {
        this.byChapter[c.id] = c;
        c.questions.forEach(q => { q.ch = c.id; this.questions.push(q); this.byQuestion[q.id] = q; });
      });
    },
    chapter(id) { return this.byChapter[id]; },
    question(id) { return this.byQuestion[id]; },
    termName(chId, termId) { const c = this.byChapter[chId]; const t = c && c.terms.find(x => x.id === termId); return t ? t.name : ''; },
  };

  // ---- 問題の出題インスタンス（計算問題は数値を毎回作り直す） ----
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const makeR = rnd => ({ int: (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick: arr => arr[Math.floor(rnd() * arr.length)] });
  function shuffle(a, rnd = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  MoT.Question = {
    shuffle, hash,
    // seed を渡すと同じ数値になる（Markdown書き出し用）。省略時はランダム。
    instantiate(q, seed) {
      const rnd = seed == null ? Math.random : mulberry32(seed);
      const inst = Object.assign({}, q);
      if (q.type === 'num') Object.assign(inst, q.gen(makeR(rnd)));
      if (q.type === 'mcq') inst.order = shuffle(q.choices.map((_, i) => i), rnd);
      return inst;
    },
    // 数値の答え合わせ：相対誤差 tol 以内、または表示桁の丸め誤差以内なら正解
    isCorrect(inst, value, digits) {
      return Math.abs(value - inst.answer) <= Math.abs(inst.answer) * (inst.tol || 0.01) + 0.5 * Math.pow(10, -digits);
    },
  };
  MoT.UNIT_DIGITS = { '円': 0, '万円': 0, '億円': 1, '倍': 2, '%': 1, '年': 1, 'ヶ月': 2, '日': 0, '回': 2 };

  // ---- 復習スケジュール（ボックス式の分散学習）：純粋な関数 ----
  const DAY = 86400000;
  MoT.Schedule = {
    INTERVALS: [0, 1, 3, 7, 21, 45], // ボックス番号ごとの次回までの日数
    MASTERED_BOX: 3,                 // このボックス以上を「定着」とみなす
    startOfDay(now) { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); },
    // rating: good（覚えた・正解） / hard（あいまい） / again（忘れた・不正解）
    review(card, rating, now) {
      const c = Object.assign({ box: 0, n: 0, ok: 0, ng: 0 }, card);
      c.n++; c.last = now;
      const day0 = this.startOfDay(now);
      if (rating === 'good') { c.box = Math.min(c.box + 1, this.INTERVALS.length - 1); c.ok++; c.due = day0 + this.INTERVALS[c.box] * DAY; }
      else if (rating === 'hard') { c.box = Math.max(c.box, 1); c.due = day0 + Math.max(1, Math.floor(this.INTERVALS[c.box] / 2)) * DAY; }
      else { c.box = 0; c.ng++; c.due = now; }
      return c;
    },
    isDue(card, now) { return !!card && card.due <= now; },
  };

  // ---- 学習の進捗（復習スケジュール × 記録の保存先） ----
  MoT.Progress = {
    NEW_PER_DAY: 10,
    repo: null, state: { cards: {} },
    init(repo) { this.repo = repo; this.state = repo.load() || { cards: {} }; if (!this.state.cards) this.state.cards = {}; },
    card(id) { return this.state.cards[id]; },
    isNew(id) { return !this.state.cards[id]; },
    record(id, rating) { this.state.cards[id] = MoT.Schedule.review(this.state.cards[id], rating, Date.now()); this.repo.save(this.state); },
    due() { const now = Date.now(); return MoT.Catalog.questions.filter(q => MoT.Schedule.isDue(this.state.cards[q.id], now)); },
    fresh(limit) {
      return MoT.Catalog.questions.filter(q => this.isNew(q.id))
        .sort((a, b) => (b.pretest ? 1 : 0) - (a.pretest ? 1 : 0)).slice(0, limit == null ? this.NEW_PER_DAY : limit);
    },
    chapterStats(chId) {
      const qs = MoT.Catalog.questions.filter(q => q.ch === chId);
      const by = [0, 0, 0]; // 未学習 / 学習中 / 定着
      qs.forEach(q => { const c = this.state.cards[q.id]; if (!c) by[0]++; else if (c.box >= MoT.Schedule.MASTERED_BOX) by[2]++; else by[1]++; });
      return { total: qs.length, by };
    },
    // ケーススタディの完了記録（復習スケジュールには入れない）：{ ok, n, last }
    story(id) { return (this.state.stories || {})[id]; },
    recordStory(id, res) { this.state.stories = this.state.stories || {}; this.state.stories[id] = { ok: res.ok, n: res.n, last: Date.now() }; this.repo.save(this.state); },
    // 財務諸表ドリルの正誤記録（復習スケジュールには入れない）：{ ok: 最後に正解したか, n: 回答数, nOk: 正解数, last }
    drill(id) { return (this.state.drill || {})[id]; },
    recordDrill(id, ok) {
      this.state.drill = this.state.drill || {};
      const r = this.state.drill[id] || { n: 0, nOk: 0 };
      this.state.drill[id] = { ok: !!ok, n: r.n + 1, nOk: r.nOk + (ok ? 1 : 0), last: Date.now() };
      this.repo.save(this.state);
    },
    replace(state) { if (!state || !state.cards) throw new Error('invalid'); this.state = state; this.repo.save(state); },
    reset() { this.state = { cards: {} }; this.repo.save(this.state); },
  };
})();
