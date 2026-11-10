// ケーススタディ（ストーリー問題）：一覧・進行画面・Markdown書き出し・セルフテスト。
// 教材データは data/stories/*.js（window.STORIES）。用語ドリルの復習スケジュールとは別に、完了記録だけを残す。
(function () {
  'use strict';
  const { Question, Progress, UNIT_DIGITS } = MoT;
  const { esc, md, fmt, stars, toast, copy } = MoT.View;
  const KINDS = { scene: '場面', pick: '資料を選ぶ', mcq: '選択', num: '計算', explain: '説明' };
  const src = k => MoT.SOURCES.find(s => s.key === k);
  const srcChips = keys => keys.map(k => `<span class="chip src">${esc(src(k) ? src(k).name : k)}</span>`).join('');
  const list = () => (window.STORIES || []).slice().sort((a, b) => a.id.localeCompare(b.id, 'ja', { numeric: true }));
  const story = id => list().find(s => s.id === id);

  function parseNum(s) {
    s = String(s).replace(/[０-９．－，]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[△▲−]/g, '-').replace(/[,\s%％倍円億万年ヶ月]/g, '');
    return s === '' ? NaN : Number(s);
  }

  // ===== 一覧 =====
  function viewList(h) {
    h(`<div class="small muted"><a href="#/">ホーム</a> › ケーススタディ</div><h1>ケーススタディ</h1>
      <div class="card"><div class="md">${md(MoT.STORY_LEAD)}</div></div>
      <h2>判断したいこと × 見る資料</h2>
      <div class="card"><div class="md">${md(MoT.STORY_MATRIX)}</div></div>
      <h2>ストーリー</h2>
      <div class="grid">${list().map(cardHtml).join('')}</div>`);
  }
  function cardHtml(s) {
    const r = Progress.story(s.id);
    return `<div class="card ch-card"><div class="ch-id">${s.id}　${esc(s.period)}</div><h3>${esc(s.title)}</h3>
      <div>${esc(s.question)}</div>
      <div class="small muted">${stars(s.level || 2)}　約${s.minutes}分・${s.steps.filter(x => x.kind !== 'scene').length}問${r ? `　<b style="color:var(--ok)">完了 ${r.ok}/${r.n}</b>` : ''}</div>
      <div><a class="btn primary" href="#/story/${s.id}">${r ? 'もう一度' : 'はじめる'}</a></div></div>`;
  }

  // ===== 進行画面：ステップを1つずつ下に追加していく =====
  function viewStory(h, id) {
    const s = story(id);
    if (!s) { h(`<p>ケースが見つかりません。</p><a class="btn" href="#/stories">一覧へ</a>`); return; }
    const res = { ok: 0, n: 0 };
    h(`<div class="small muted"><a href="#/">ホーム</a> › <a href="#/stories">ケーススタディ</a> › ${s.id}</div>
      <h1>${s.id}　${esc(s.title)}</h1><p class="lead-q">${esc(s.question)}</p>
      <div class="small muted">${esc(s.period)}・約${s.minutes}分（使う資料は、場面ごとに自分で選ぶ）</div>
      <div class="card story-intro"><div class="md">${md(s.intro)}</div></div>
      <div id="steps"></div>`);
    const box = document.getElementById('steps');
    const add = i => {
      if (i >= s.steps.length) return finish();
      const st = s.steps[i], el = document.createElement('div');
      el.className = 'card step step-' + st.kind;
      el.innerHTML = `<div class="q-meta"><span class="chip acc">${st.id}</span><span class="chip">${KINDS[st.kind]}</span><span class="small muted">${i + 1} / ${s.steps.length}</span></div>
        ${st.title ? `<h3>${esc(st.title)}</h3>` : ''}<div class="md">${md(st.kind === 'scene' ? st.text : st.q)}</div><div class="sbody"></div>`;
      box.appendChild(el);
      const body = el.querySelector('.sbody');
      const done = ok => {
        if (ok != null) { res.n++; if (ok) res.ok++; }
        body.insertAdjacentHTML('beforeend', `<div class="row" style="margin-top:12px"><button class="btn primary nx">${i + 1 < s.steps.length ? '次へ' : '振り返りへ'}</button></div>`);
        body.querySelector('.nx').addEventListener('click', e => { e.target.closest('.row').remove(); add(i + 1); });
      };
      ({ scene: (_, __, d) => d(null), pick: sPick, mcq: sMcq, num: sNum, explain: sExplain })[st.kind](st, body, done);
      if (i > 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const finish = () => {
      Progress.recordStory(s.id, res);
      const el = document.createElement('div');
      el.className = 'card story-wrap';
      el.innerHTML = `<h2 style="margin-top:0">振り返り</h2><div class="kpis">${MoT.View.kpis([{ k: '正解・できた', v: res.ok, tone: 'ok' }, { k: '回答数', v: res.n }])}</div>
        <div class="sec"><div class="lbl">このケースで使った資料</div><div class="row">${srcChips(s.uses)}</div></div>
        <div class="md">${md(s.wrapup)}</div>
        <div class="sec"><div class="lbl">つながる用語（解説で復習）</div><div class="row">${s.terms.map(t => `<a class="chip" href="#/ch/${t[0]}/learn/${t.split(' ')[0]}">${esc(t)}</a>`).join('')}</div></div>
        <div class="sec"><div class="lbl">出典</div><ul class="small">${s.sources.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="row"><a class="btn primary" href="#/stories">ケース一覧へ</a><a class="btn" href="#/">ホーム</a></div>`;
      box.appendChild(el);
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    add(0);
  }

  // 資料を選ぶ：answer（必須）をすべて選び、answer＋optional 以外を選ばなければ正解
  function sPick(st, el, done) {
    const want = st.answer.length;
    el.innerHTML = `<p class="small muted">${want === 1 && !st.optional ? '1つ選ぶ' : 'あてはまるものを選ぶ'}（複数可）。選んだら「この資料を開く」。</p>
      <div class="choices src-choices">${MoT.SOURCES.map(s => `<label class="choice"><input type="checkbox" value="${s.key}"><span><b>${esc(s.name)}</b><br><span class="small muted">${esc(s.what)}</span></span></label>`).join('')}</div>
      <div class="row" style="margin-top:10px"><button class="btn primary chk">この資料を開く</button></div><div class="res"></div>`;
    el.querySelector('.chk').addEventListener('click', () => {
      const picked = [...el.querySelectorAll('input:checked')].map(x => x.value);
      if (!picked.length) { toast('資料を選んでください'); return; }
      const okSet = new Set(st.answer.concat(st.optional || []));
      const ok = st.answer.every(k => picked.includes(k)) && picked.every(k => okSet.has(k));
      el.querySelectorAll('label.choice').forEach(l => {
        const k = l.querySelector('input').value; l.querySelector('input').disabled = true;
        if (st.answer.includes(k)) l.classList.add('right'); else if (okSet.has(k)) l.classList.add('maybe'); else if (picked.includes(k)) l.classList.add('wrong');
      });
      el.querySelector('.chk').disabled = true;
      el.querySelector('.res').innerHTML = `<div class="answer ${ok ? 'ok' : 'ng'}"><div class="verdict">${ok ? '正解' : '惜しい'}　見るべき資料：${st.answer.map(k => src(k).name).join('、')}${st.optional ? `（${st.optional.map(k => src(k).name).join('・')}も可）` : ''}</div><div class="md">${md(st.explain)}</div></div>`;
      done(ok);
    });
  }
  function sMcq(st, el, done) {
    const order = Question.shuffle(st.choices.map((_, i) => i));
    el.innerHTML = `<div class="choices">${order.map((ci, k) => `<button class="choice" data-c="${ci}"><b>${'ABCDE'[k]}</b><span class="md">${md(st.choices[ci])}</span></button>`).join('')}</div><div class="res"></div>`;
    el.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => {
      const ok = +b.dataset.c === st.answer;
      el.querySelectorAll('.choice').forEach(x => { x.disabled = true; if (+x.dataset.c === st.answer) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      el.querySelector('.res').innerHTML = `<div class="answer ${ok ? 'ok' : 'ng'}"><div class="verdict">${ok ? '正解' : '不正解'}</div><div class="md">${md(st.explain)}</div></div>`;
      done(ok);
    }));
  }
  function sNum(st, el, done) {
    const d = UNIT_DIGITS[st.unit] ?? 2;
    el.innerHTML = `<div class="num-in"><input type="text" inputmode="decimal" placeholder="数値を入力" autocomplete="off"><span>${esc(st.unit)}</span><button class="btn primary chk">答え合わせ</button><button class="btn skip">わからない・答えを見る</button></div>
      <p class="small muted">途中式を紙に書いてから入力しよう。マイナスは「-」か「△」。誤差${fmt((st.tol || 0.01) * 100, 0)}%以内なら正解。</p><div class="res"></div>`;
    const input = el.querySelector('input');
    const check = skip => {
      const x = skip ? NaN : parseNum(input.value);
      if (!skip && isNaN(x)) { toast('数値を入力してください'); return; }
      const ok = !skip && Question.isCorrect(st, x, d);
      input.disabled = true; el.querySelector('.chk').disabled = true; el.querySelector('.skip').disabled = true;
      el.querySelector('.res').innerHTML = `<div class="answer ${ok ? 'ok' : 'ng'}"><div class="verdict">${ok ? '正解' : skip ? '答えを確認' : '不正解'}　正解：${fmt(st.answer, d)} ${esc(st.unit)}</div><div class="md">${md(st.explain)}</div></div>`;
      done(ok);
    };
    el.querySelector('.chk').addEventListener('click', () => check(false));
    el.querySelector('.skip').addEventListener('click', () => check(true));
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !input.disabled) check(false); });
  }
  function sExplain(st, el, done) {
    el.innerHTML = `<p class="small muted">会議で話すつもりで書こう。どの資料の、どの数字を根拠にしたかを入れる。</p>
      <textarea rows="7" placeholder="自分の提言を書く"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn primary show">模範解答と採点観点を見る</button></div>`;
    el.querySelector('.show').addEventListener('click', () => {
      const mine = el.querySelector('textarea').value;
      el.innerHTML = `<div class="answer"><div class="small muted">あなたの提言</div><div>${mine ? esc(mine).replace(/\n/g, '<br>') : '<span class="muted">（未記入）</span>'}</div></div>
        <div class="answer"><div class="verdict">模範解答</div><div class="md">${md(st.a)}</div></div>
        <div class="answer rubric"><div class="verdict">採点観点（できたものにチェック）</div>${st.rubric.map(r => `<label><input type="checkbox"><span class="md">${md(r)}</span></label>`).join('')}</div>
        <div class="row" style="margin-top:10px"><button class="btn gem">Geminiに採点してもらうプロンプトをコピー</button><button class="btn primary ev">採点を確定</button></div>`;
      el.querySelector('.gem').addEventListener('click', () => copy(
`ケーススタディの説明問題です。私の提言を、採点観点に沿って100点満点で採点してください。足りない観点を指摘し、私の提言を活かした改善例を示してください。

【問題】${st.q}
【採点観点】
${st.rubric.map(r => '- ' + r).join('\n')}
【模範解答】${st.a}
【私の提言】${mine || '（未記入）'}`));
      el.querySelector('.ev').addEventListener('click', e => {
        const c = el.querySelectorAll('.rubric input:checked').length;
        el.querySelectorAll('.rubric input').forEach(x => { x.disabled = true; });
        e.target.closest('.row').remove();
        done(c >= Math.ceil(st.rubric.length * 0.6)); // 観点の6割以上で「できた」
      });
    });
  }

  // ===== Markdown 書き出し =====
  function toMarkdown() {
    const L = ['---', '', '# ケーススタディ（ストーリー問題）', '', MoT.STORY_LEAD.trim(), '', '## 判断したいこと × 見る資料', '', MoT.STORY_MATRIX.trim(), '',
      '## 資料を選ぶ問題の選択肢', '', MoT.SOURCES.map(s => `- **${s.key}　${s.name}**：${s.what}`).join('\n'), ''];
    list().forEach(s => {
      L.push(`## ${s.id}　${s.title}：${s.question}（${s.period}）`, '', s.intro.trim(), '');
      s.steps.forEach(st => {
        if (st.kind === 'scene') { L.push(`### ${st.id}　[場面] ${st.title || ''}`, '', st.text.trim(), ''); return; }
        L.push(`### ${st.id}　[${KINDS[st.kind]}]`, '', st.q.trim(), '');
        if (st.kind === 'pick') L.push('（選択肢：' + MoT.SOURCES.map(x => x.key).join(' / ') + '）', '');
        if (st.kind === 'mcq') { st.choices.forEach((c, i) => L.push(`${'ABCDE'[i]}. ${c}`)); L.push(''); }
        if (st.kind === 'num') L.push(`（答えの単位：${st.unit}）`, '');
        L.push('<details><summary>解答・解説</summary>', '');
        if (st.kind === 'pick') L.push(`**正解：${st.answer.join('・')}**${st.optional ? `（${st.optional.join('・')}も可）` : ''}`, '', st.explain.trim(), '');
        if (st.kind === 'mcq') L.push(`**正解：${'ABCDE'[st.answer]}. ${st.choices[st.answer]}**`, '', st.explain.trim(), '');
        if (st.kind === 'num') L.push(`**正解：${fmt(st.answer, UNIT_DIGITS[st.unit] ?? 2)} ${st.unit}**`, '', st.explain.trim(), '');
        if (st.kind === 'explain') L.push(`**模範解答：**`, '', st.a.trim(), '', '**採点観点：**', '', st.rubric.map(r => '- ' + r).join('\n'), '');
        L.push('</details>', '');
      });
      L.push(`### ${s.id} 振り返り`, '', s.wrapup.trim(), '', '**つながる用語：** ' + s.terms.join('、'), '', '**出典：**', '', s.sources.map(x => '- ' + x).join('\n'), '');
    });
    return L.join('\n');
  }

  // ===== セルフテスト =====
  function selfTest(texOk, errs, warns, info) {
    const bad = s => /undefined|NaN|Infinity|\[object/.test(String(s));
    const keys = new Set(MoT.SOURCES.map(s => s.key)), ids = new Set();
    texOk(MoT.STORY_MATRIX, 'ケース表');
    list().forEach(s => {
      const w = `ケース${s.id}`;
      ['id', 'title', 'question', 'period', 'intro', 'wrapup'].forEach(k => { if (!s[k]) errs.push(`${w}: ${k} がない`); });
      if (!/^S\d+$/.test(s.id)) errs.push(`${w}: IDの形式が S数字 でない`);
      (s.uses || []).forEach(k => { if (!keys.has(k)) errs.push(`${w}: uses の ${k} が資料一覧にない`); });
      if (!(s.sources || []).length) warns.push(`${w}: 出典がない`);
      (s.terms || []).forEach(t => { if (!/^[A-F]\d /.test(t)) errs.push(`${w}: terms「${t}」は「A1 用語名」の形にする`); else if (!MoT.Catalog.termName(t[0], t.split(' ')[0])) warns.push(`${w}: 用語 ${t.split(' ')[0]} が教材にない`); });
      texOk(s.intro, w); texOk(s.wrapup, w);
      const counts = {};
      s.steps.forEach(st => {
        const v = `${st.id}`;
        if (ids.has(st.id)) errs.push(`${v}: IDが重複`); ids.add(st.id);
        if (!new RegExp(`^${s.id}-\\d{2}$`).test(st.id)) errs.push(`${v}: IDの形式が ${s.id}-NN でない`);
        if (!KINDS[st.kind]) { errs.push(`${v}: kind が不正`); return; }
        counts[st.kind] = (counts[st.kind] || 0) + 1;
        ['text', 'q', 'a', 'explain'].forEach(k => { if (st[k]) { texOk(st[k], v); if (bad(st[k])) errs.push(`${v}.${k}: undefined等が混入`); } });
        if (st.kind === 'scene' && !st.text) errs.push(`${v}: text がない`);
        if (st.kind !== 'scene' && !st.q) errs.push(`${v}: q がない`);
        if (st.kind === 'pick') {
          if (!Array.isArray(st.answer) || !st.answer.length) errs.push(`${v}: answer（資料のキーの配列）がない`);
          st.answer.concat(st.optional || []).forEach(k => { if (!keys.has(k)) errs.push(`${v}: 資料 ${k} が一覧にない`); });
          if (!st.explain) errs.push(`${v}: explain がない`);
        }
        if (st.kind === 'mcq') { if (!Array.isArray(st.choices) || st.choices.length < 3 || !(st.answer >= 0 && st.answer < st.choices.length)) errs.push(`${v}: 選択肢か answer が不正`); else st.choices.forEach(c => texOk(c, v)); if (!st.explain) errs.push(`${v}: explain がない`); }
        if (st.kind === 'num') {
          if (!isFinite(st.answer) || !st.unit || !st.explain) errs.push(`${v}: answer/unit/explain が不正`);
          else { if (!(st.unit in UNIT_DIGITS)) warns.push(`${v}: 単位「${st.unit}」の表示桁が未定義`); if (!Question.isCorrect(st, st.answer, UNIT_DIGITS[st.unit] ?? 2)) errs.push(`${v}: 正解値で正解判定にならない`); }
        }
        if (st.kind === 'explain' && (!st.a || !Array.isArray(st.rubric) || st.rubric.length < 2)) errs.push(`${v}: a か rubric が不正`);
      });
      if (!counts.pick) warns.push(`${w}: 「資料を選ぶ」問題がない`);
      // 通しの操作：正解を入れながら最後まで進め、振り返りが表示されるか（記録はセルフテスト用のメモリに入る）
      const host = document.createElement('div'); document.body.appendChild(host);
      try {
        viewStory(html => { host.innerHTML = html; }, s.id);
        for (let k = 0; k < s.steps.length; k++) {
          const st = s.steps[k], el = host.querySelectorAll('.step')[k];
          if (!el) { errs.push(`${w}: ${st.id} が表示されない`); break; }
          const q = sel => el.querySelector(sel);
          if (st.kind === 'pick') { el.querySelectorAll('input[type=checkbox]').forEach(x => { x.checked = st.answer.includes(x.value); }); q('.chk').click(); }
          if (st.kind === 'mcq') el.querySelector(`.choice[data-c="${st.answer}"]`).click();
          if (st.kind === 'num') { q('input').value = String(st.answer); q('.chk').click(); }
          if (st.kind === 'explain') { q('.show').click(); el.querySelectorAll('.rubric input').forEach(x => { x.checked = true; }); q('.ev').click(); }
          if (st.kind !== 'scene' && st.kind !== 'explain' && !q('.answer.ok')) errs.push(`${w}: ${st.id} が正解の入力で正解にならない`);
          if (bad(el.textContent)) errs.push(`${w}: ${st.id} の表示に undefined/NaN`);
          const nx = q('.nx'); if (!nx) { errs.push(`${w}: ${st.id} に「次へ」が出ない`); break; }
          nx.click();
        }
        const r = Progress.story(s.id);
        if (!host.querySelector('.story-wrap')) errs.push(`${w}: 振り返りが表示されない`);
        else if (!r || r.ok !== r.n) errs.push(`${w}: 全問正解の記録にならない（${r ? r.ok + '/' + r.n : '記録なし'}）`);
        else info.push(`${w}: 通しの操作 OK（${r.ok}/${r.n}）`);
      } catch (e) { errs.push(`${w}: 通しの操作で例外 ${e.message}`); }
      host.remove();
      info.push(`${w}: ステップ${s.steps.length}（${Object.entries(counts).map(([k, n]) => KINDS[k] + n).join('・')}）`);
    });
  }

  MoT.Stories = { list, viewList, viewStory, cardHtml, toMarkdown, selfTest };
})();
