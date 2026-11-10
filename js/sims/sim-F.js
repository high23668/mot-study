// F章のシミュレーター：PPMバブルチャート / 5 forces レーダーチャート
(function () {
  'use strict';
  const { fmt, pct, esc, slider, kpis, legend } = MoT.View;

  // スライダーの値を外から書き換える（slider() は現在値を返す関数しか返さないため）
  function setSlider(ctl, v, show) {
    const inp = ctl.querySelector('input'), out = ctl.querySelector('output');
    inp.value = v; out.textContent = show(+inp.value);
  }

  // ---------------- PPM ----------------
  const QUAD = {
    star: { name: '花形', en: 'Star', c: 'var(--accent)', plan: 'シェアを守るための投資を続ける。稼ぐ額も使う額も大きく、キャッシュはほぼトントン。市場の成長が止まると金のなる木になる。' },
    cow: { name: '金のなる木', en: 'Cash Cow', c: 'var(--ok)', plan: '大きな投資は抑えて、キャッシュを回収する。ここで稼いだ資金を問題児の育成に回す。' },
    qm: { name: '問題児', en: 'Question Mark', c: 'var(--c3)', plan: '勝てる見込みを見極める。見込みがあれば集中投資してシェアを上げ、花形に育てる。なければ早めに撤退する。' },
    dog: { name: '負け犬', en: 'Dog', c: 'var(--muted)', plan: '縮小・売却・撤退を検討する。ただし利益が出ている、他事業とのつながりが強い、などの理由で残すこともある。' },
  };
  const quadOf = (g, s, gb, sb) => (g >= gb ? (s >= sb ? 'star' : 'qm') : (s >= sb ? 'cow' : 'dog'));
  const BIZ0 = [
    { name: '工作機械', sales: 900, g: 2, s: 1.5 },
    { name: '産業用ロボット', sales: 600, g: 12, s: 1.2 },
    { name: 'AI外観検査', sales: 50, g: 25, s: 0.3 },
    { name: '鋳造部品', sales: 450, g: -1, s: 0.6 },
  ];

  SIMS.ppm = {
    title: 'PPMバブルチャート',
    desc: 'ミナト精機の4事業を、市場成長率と相対市場シェアの4象限に描く（円の大きさ＝売上高）。事業を選んで位置を動かしたり、境目を動かしたりして、象限の判定と「とるべき戦略」がどう変わるかを確かめよう。',
    render(box) {
      box.innerHTML = `<div class="sim-grid"><div><div class="row biz-btns" style="margin-bottom:12px"></div><div class="ctls"></div>
          <div class="row" style="margin-top:6px"><button class="btn reset">ミナト精機の値に戻す</button></div></div>
        <div><div class="kpis"></div><div class="chart"></div>
        ${legend([[QUAD.star.c, '花形'], [QUAD.cow.c, '金のなる木'], [QUAD.qm.c, '問題児'], [QUAD.dog.c, '負け犬'], ['var(--border)', '円の面積＝売上高']])}
        <div class="insight"></div></div></div>`;
      const biz = BIZ0.map(b => Object.assign({}, b));
      let sel = 2;
      const c = box.querySelector('.ctls');
      const showG = v => pct(v), showS = v => fmt(v, 1) + '倍';
      const g = {
        g: slider(c, { key: 'ppm-g', label: '選んだ事業の市場成長率', min: -5, max: 30, step: 1, value: biz[sel].g, show: showG }, () => { biz[sel].g = g.g(); draw(); }),
        s: slider(c, { key: 'ppm-s', label: '選んだ事業の相対市場シェア', min: 0.2, max: 5, step: 0.1, value: biz[sel].s, show: showS }, () => { biz[sel].s = g.s(); draw(); }),
        gb: slider(c, { key: 'ppm-gb', label: '境目：市場成長率', min: 0, max: 20, step: 1, value: 8, show: showG }, draw),
        sb: slider(c, { key: 'ppm-sb', label: '境目：相対シェア', min: 0.5, max: 2, step: 0.1, value: 1, show: showS }, draw),
      };
      const ctls = c.querySelectorAll('.ctl');
      const btnBox = box.querySelector('.biz-btns');
      function buttons() {
        btnBox.innerHTML = biz.map((b, i) => `<button class="btn ${i === sel ? 'primary' : ''}" data-i="${i}">${esc(b.name)}</button>`).join('');
      }
      btnBox.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        sel = +b.dataset.i;
        setSlider(ctls[0], biz[sel].g, showG); setSlider(ctls[1], biz[sel].s, showS);
        draw();
      });
      box.querySelector('.reset').addEventListener('click', () => {
        BIZ0.forEach((b, i) => Object.assign(biz[i], b));
        setSlider(ctls[0], biz[sel].g, showG); setSlider(ctls[1], biz[sel].s, showS);
        setSlider(ctls[2], 8, showG); setSlider(ctls[3], 1, showS);
        draw();
      });

      function chart(gb, sb) {
        const W = 560, H = 380, L = 44, R = 12, Tp = 12, B = H - 34;
        const sMax = 5, sMin = 0.2, gMax = 30, gMin = -5;
        const X = s => L + (Math.log(sMax) - Math.log(s)) / (Math.log(sMax) - Math.log(sMin)) * (W - L - R);
        const Y = v => Tp + (gMax - v) / (gMax - gMin) * (B - Tp);
        const xb = X(sb), yb = Y(gb);
        const rect = (x1, y1, x2, y2, q) => `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" style="fill:${QUAD[q].c};fill-opacity:0.07"/>`;
        const qlab = (x, y, q, anchor) => `<text x="${x}" y="${y}" text-anchor="${anchor}" style="fill:${QUAD[q].c};font-size:13px;font-weight:700">${QUAD[q].name}</text>`;
        const yt = [-5, 0, 5, 10, 15, 20, 25, 30], xt = [5, 2, 1, 0.5, 0.2];
        const order = biz.map((b, i) => i).sort((a, b) => biz[b].sales - biz[a].sales); // 大きい円を先に描く
        const bubbles = order.map(i => {
          const b = biz[i], q = quadOf(b.g, b.s, gb, sb), r = 1.25 * Math.sqrt(b.sales), cx = X(b.s), cy = Y(b.g);
          const inside = r >= 22;
          const lab = inside
            ? `<text x="${cx}" y="${cy - 2}" text-anchor="middle" style="fill:var(--text);font-size:11.5px;font-weight:700">${esc(b.name)}</text><text x="${cx}" y="${cy + 12}" text-anchor="middle" style="fill:var(--text);font-size:11px">${b.sales}億円</text>`
            : `<text x="${cx}" y="${cy - r - 5}" text-anchor="middle" style="fill:var(--text);font-size:11.5px;font-weight:700">${esc(b.name)}（${b.sales}億円）</text>`;
          return `<circle cx="${cx}" cy="${cy}" r="${r}" style="fill:${QUAD[q].c};fill-opacity:0.55;stroke:${i === sel ? 'var(--text)' : QUAD[q].c};stroke-width:${i === sel ? 2.5 : 1}"/>${lab}`;
        }).join('');
        return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="PPMバブルチャート">
          ${rect(L, Tp, xb, yb, 'star')}${rect(xb, Tp, W - R, yb, 'qm')}${rect(L, yb, xb, B, 'cow')}${rect(xb, yb, W - R, B, 'dog')}
          ${yt.map(t => `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--border)" stroke-width="0.5"/><text x="${L - 6}" y="${Y(t) + 4}" text-anchor="end">${t}%</text>`).join('')}
          ${xt.map(t => `<line x1="${X(t)}" x2="${X(t)}" y1="${Tp}" y2="${B}" stroke="var(--border)" stroke-width="0.5"/><text x="${X(t)}" y="${B + 15}" text-anchor="middle">${fmt(t, 1)}倍</text>`).join('')}
          <line x1="${xb}" x2="${xb}" y1="${Tp}" y2="${B}" stroke="var(--muted)" stroke-dasharray="5 4" stroke-width="1.5"/>
          <line x1="${L}" x2="${W - R}" y1="${yb}" y2="${yb}" stroke="var(--muted)" stroke-dasharray="5 4" stroke-width="1.5"/>
          ${qlab(L + 6, Tp + 16, 'star', 'start')}${qlab(W - R - 6, Tp + 16, 'qm', 'end')}${qlab(L + 6, B - 8, 'cow', 'start')}${qlab(W - R - 6, B - 8, 'dog', 'end')}
          ${bubbles}
          <text x="${L}" y="${B + 30}">縦軸：市場成長率　／　← 横軸：相対市場シェア（左ほど高い・対数目盛）</text>
        </svg>`;
      }

      function draw() {
        buttons();
        const gb = g.gb(), sb = g.sb();
        const qs = biz.map(b => quadOf(b.g, b.s, gb, sb));
        const total = biz.reduce((a, b) => a + b.sales, 0);
        const share = q => biz.reduce((a, b, i) => a + (qs[i] === q ? b.sales : 0), 0) / total * 100;
        const b = biz[sel], q = qs[sel];
        box.querySelector('.kpis').innerHTML = kpis([
          { k: `${esc(b.name)}の象限`, v: `<span style="color:${QUAD[q].c}">${QUAD[q].name}</span>` },
          { k: '金のなる木の売上比率', v: fmt(share('cow'), 1) + '%', tone: share('cow') > 0 ? 'ok' : 'ng' },
          { k: '花形＋問題児の売上比率', v: fmt(share('star') + share('qm'), 1) + '%', tone: share('star') + share('qm') > 0 ? '' : 'ng' },
          { k: '負け犬の売上比率', v: fmt(share('dog'), 1) + '%' },
        ]);
        box.querySelector('.chart').innerHTML = chart(gb, sb);
        const has = k => qs.includes(k);
        let port;
        if (!has('cow')) port = has('qm') || has('star')
          ? '金のなる木がなく、<strong>成長事業に回す資金源がありません</strong>。借入や増資に頼るか、育てる事業を絞る必要があります。'
          : '金のなる木も成長事業もありません。事業ポートフォリオを根本から見直す局面です。';
        else if (!has('star') && !has('qm')) port = '今は稼げていますが、<strong>将来の柱（花形・問題児）がありません</strong>。金のなる木の資金で新規事業を育てるか、成長分野を買収することを考えます。';
        else if (has('qm')) port = `金のなる木（売上の${fmt(share('cow'), 1)}%）の資金で問題児を育てて花形にする、という定石どおりの資金配分を描けます。`;
        else port = '金のなる木と花形がそろっています。次の世代の柱になる問題児（新規事業）がないので、種まきを考える時期です。';
        const ins = box.querySelector('.insight');
        ins.className = 'insight';
        ins.innerHTML = `<strong>${esc(b.name)}</strong>：市場成長率 ${pct(b.g)}（境目 ${pct(gb)}）、相対シェア ${fmt(b.s, 1)}倍（境目 ${fmt(sb, 1)}倍）→ <strong>${QUAD[q].name}</strong>。定石：${QUAD[q].plan}<br>${port} ただし象限は「キャッシュを生む／使う」の仮説です。実際の配分は事業別のFCFとROIC（ROIC > WACCか）で確かめます。`;
      }
      draw();
    },
  };

  // ---------------- 5 forces ----------------
  const FORCES = [
    { key: 'rival', name: '既存企業間の競争', v: 4, hint: '価格以外で競う軸を作る（性能・使いやすさ・サービス）。勝てるニッチに集中する。固定費を減らして値下げ競争に巻き込まれにくくする。' },
    { key: 'buyer', name: '買い手の交渉力', v: 4, hint: '製品を差別化して比べにくくする。ソフトウェアや保守と組み合わせてスイッチングコストを高める。特定の大口顧客への依存を下げる。' },
    { key: 'subst', name: '代替品の脅威', v: 2, hint: '代替品より費用対効果を高める（導入費の低減、短い立ち上げ期間）。代替品の技術を自社に取り込む。' },
    { key: 'entry', name: '新規参入の脅威', v: 4, hint: '参入障壁を高める（規模の経済、特許・技術、ブランド、販売・保守網、顧客との共同開発の実績）。' },
    { key: 'supp', name: '売り手の交渉力', v: 3, hint: '調達先を複数にする。重要部品を内製する。設計を工夫して標準品を使えるようにする。長期契約で供給を確保する。' },
  ];

  SIMS.fiveForces = {
    title: '5 forces レーダーチャート',
    desc: '5つの力の強さ（1＝弱い〜5＝強い）を設定すると、業界の魅力度（利益を出しやすいか）と、一番効いている力への打ち手のヒントを表示する。初期値は、ミナト精機の産業用ロボット業界の分析例。',
    render(box) {
      box.innerHTML = `<div class="sim-grid"><div><div class="ctls"></div>
          <div class="row" style="margin-top:6px"><button class="btn reset">産業用ロボット業界の例に戻す</button></div></div>
        <div><div class="kpis"></div><div class="chart"></div>
        ${legend([['var(--ng)', '5つの力の強さ（面積が大きいほど利益を出しにくい）'], ['var(--border)', '目盛：1〜5']])}
        <div class="insight"></div></div></div>`;
      const c = box.querySelector('.ctls');
      const lvl = ['', '1（弱い）', '2', '3', '4', '5（強い）'];
      const show = v => lvl[v] || String(v);
      const get = FORCES.map(f => slider(c, { key: 'ff-' + f.key, label: f.name, min: 1, max: 5, step: 1, value: f.v, show }, draw));
      const ctls = c.querySelectorAll('.ctl');
      box.querySelector('.reset').addEventListener('click', () => { FORCES.forEach((f, i) => setSlider(ctls[i], f.v, show)); draw(); });

      function radar(vals) {
        const W = 560, H = 330, cx = W / 2, cy = 165, R = 115, n = vals.length;
        const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
        const poly = (r, f) => Array.from({ length: n }, (_, i) => f ? pt(i, R * f(i) / 5) : pt(i, r)).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
        const grid = [1, 2, 3, 4, 5].map(k => `<polygon points="${poly(R * k / 5)}" style="fill:none;stroke:var(--border);stroke-width:${k === 5 ? 1.2 : 0.6}"/>`).join('');
        const spokes = vals.map((_, i) => { const p = pt(i, R); return `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="var(--border)" stroke-width="0.6"/>`; }).join('');
        const labels = vals.map((v, i) => {
          const p = pt(i, R + 20), anchor = Math.abs(p[0] - cx) < 5 ? 'middle' : p[0] > cx ? 'start' : 'end';
          const dy = p[1] < cy - R ? -4 : p[1] > cy + 40 ? 12 : 4;
          return `<text x="${p[0]}" y="${p[1] + dy}" text-anchor="${anchor}" style="fill:var(--text);font-size:13px;font-weight:700">${FORCES[i].name}（${v}）</text>`;
        }).join('');
        const dots = vals.map((v, i) => { const p = pt(i, R * v / 5); return `<circle cx="${p[0]}" cy="${p[1]}" r="4" style="fill:var(--ng);stroke:var(--surface);stroke-width:1.5"/>`; }).join('');
        const ticks = [1, 2, 3, 4, 5].map(k => `<text x="${cx + 4}" y="${cy - R * k / 5 + 4}">${k}</text>`).join('');
        return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="5 forcesのレーダーチャート">${grid}${spokes}
          <polygon points="${poly(0, i => vals[i])}" style="fill:var(--ng);fill-opacity:0.22;stroke:var(--ng);stroke-width:2"/>${dots}${ticks}${labels}</svg>`;
      }

      function draw() {
        const vals = get.map(f => f());
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length, mx = Math.max(...vals);
        const top = FORCES.filter((f, i) => vals[i] === mx);
        const judge = avg <= 2.2 ? { v: '高い', tone: 'ok', t: '利益を出しやすい業界です。平均的な会社でもROIC > WACCを保ちやすい構造です。ただし利益が大きい業界は参入を招きやすいので、参入障壁を守ることが大切です。' }
          : avg <= 3.2 ? { v: '中程度', tone: '', t: '利益の出やすさは中程度です。業界の平均ではROICがWACCを少し上回る程度と考えられ、立ち位置（差別化・ニッチ）で差がつきます。' }
          : { v: '低い', tone: 'ng', t: '利益を出しにくい業界です。平均的な会社のROICはWACC近くまで押し下げられやすく、5つの力をかわす立ち位置がないと価値を生みにくい構造です。' };
        box.querySelector('.kpis').innerHTML = kpis([
          { k: '平均の強さ（1〜5）', v: fmt(avg, 1) },
          { k: '業界の魅力度', v: judge.v, tone: judge.tone },
          { k: '一番強い力', v: `<span style="font-size:15px">${top.map(f => esc(f.name)).join('・')}（${mx}）</span>` },
        ]);
        box.querySelector('.chart').innerHTML = radar(vals);
        const ins = box.querySelector('.insight');
        ins.className = 'insight';
        if (mx <= 2) {
          ins.innerHTML = `業界の魅力度：<strong>${judge.v}</strong>。${judge.t} どの力も弱く、目立って利益を奪っている力はありません。`;
          return;
        }
        const extra = mx === 5 && avg <= 3.2 ? '平均は高くなくても、<strong>1つの力が極端に強いと利益は大きく削られます</strong>。' : '';
        ins.innerHTML = `業界の魅力度：<strong>${judge.v}</strong>。${judge.t}${extra}<br>${top.map(f => `<strong>${esc(f.name)}への打ち手</strong>：${f.hint}`).join('<br>')}`;
      }
      draw();
    },
  };
})();
