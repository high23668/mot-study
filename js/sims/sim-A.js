// A章のシミュレーター：営業利益からFCFまでの滝グラフ / 売上成長とCCC（運転資本がFCFを食う）
(function () {
  'use strict';
  const { fmt, pct, md, slider, kpis, lineChart, legend, esc } = MoT.View;
  const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), 0);

  // 滝グラフ：steps = [{l: ラベル（\nで改行）, v: 値, total: true なら0から立てる棒}]
  function waterfall(steps, opt = {}) {
    const W = 560, H = 210, top = 18, pad = 6, bw = (W - pad * 2) / steps.length;
    let run = 0;
    const segs = steps.map(s => {
      if (s.total) { run = s.v; return Object.assign({ a: 0, b: s.v }, s); }
      const a = run; run += s.v; return Object.assign({ a, b: run }, s);
    });
    const vals = segs.flatMap(s => [s.a, s.b]).concat(0);
    const max = Math.max(...vals), min = Math.min(...vals), span = (max - min) || 1;
    const Y = v => top + (max - v) / span * (H - top - 14);
    const color = s => s.c || (s.total ? 'var(--accent)' : s.v >= 0 ? 'var(--ok)' : 'var(--ng)');
    return `<svg viewBox="0 0 ${W} ${H + 52}" role="img" aria-label="${esc(opt.label || '滝グラフ')}">
      <line x1="${pad}" x2="${W - pad}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--border)"/>
      ${segs.map((s, i) => {
        const x = pad + i * bw + bw * 0.14, w = bw * 0.72, y1 = Math.min(Y(s.a), Y(s.b)), h = Math.max(1, Math.abs(Y(s.a) - Y(s.b)));
        const up = s.b >= s.a, ty = up ? y1 - 4 : y1 + h + 12;
        const conn = i < segs.length - 1 ? `<line x1="${x + w}" x2="${x + bw}" y1="${Y(s.b)}" y2="${Y(s.b)}" stroke="var(--muted)" stroke-dasharray="3 3"/>` : '';
        const lines = s.l.split('\n');
        return `<rect x="${x}" y="${y1}" width="${w}" height="${h}" rx="3" fill="${color(s)}"/>${conn}
          <text x="${x + w / 2}" y="${ty}" text-anchor="middle">${s.total ? fmt(s.v, 0) : sgn(s.v)}</text>
          ${lines.map((t, j) => `<text x="${x + w / 2}" y="${H + 14 + j * 13}" text-anchor="middle">${esc(t)}</text>`).join('')}`;
      }).join('')}
      ${opt.unit ? `<text x="${pad}" y="${H + 48}">${esc(opt.unit)}</text>` : ''}</svg>`;
  }

  SIMS.fcfBridge = {
    title: '営業利益からFCFまで（滝グラフ）',
    desc: '営業利益から税・減価償却費・設備投資・運転資本の増加を1段ずつ足し引きして、FCFまでたどる。初期値はミナト精機。利益とお金がどこでずれるかを体感しよう。',
    render(box) {
      box.innerHTML = `<div class="sim-grid"><div class="ctls"></div><div><div class="kpis"></div><div class="formula md"></div><div class="chart"></div>
        ${legend([['var(--accent)', '利益（営業利益・NOPAT）'], ['var(--ok)', '足す'], ['var(--ng)', '引く'], ['var(--tv)', 'FCF']])}<div class="insight"></div></div></div>`;
      const c = box.querySelector('.ctls');
      const g = {
        s: slider(c, { key: 's', label: '売上高', min: 500, max: 4000, step: 100, value: 2000, show: v => v.toLocaleString() + '億円' }, draw),
        m: slider(c, { key: 'm', label: '営業利益率', min: -5, max: 20, step: 0.5, value: 7.5, show: pct }, draw),
        t: slider(c, { key: 't', label: '税率', min: 0, max: 45, step: 1, value: 30, show: v => v + '%' }, draw),
        d: slider(c, { key: 'd', label: '減価償却費', min: 0, max: 300, step: 5, value: 90, show: v => v + '億円' }, draw),
        cx: slider(c, { key: 'cx', label: '設備投資', min: 0, max: 400, step: 5, value: 85, show: v => v + '億円' }, draw),
        w: slider(c, { key: 'w', label: '正味運転資本の増加', min: -50, max: 200, step: 5, value: 10, show: v => v + '億円' }, draw),
      };
      function draw() {
        const s = g.s(), m = g.m() / 100, t = g.t() / 100, d = g.d(), cx = g.cx(), w = g.w();
        const ebit = s * m, tax = Math.max(0, ebit) * t, nopat = ebit - tax, ebitda = ebit + d;
        const fcf = nopat + d - cx - w, shield = d * t;
        box.querySelector('.kpis').innerHTML = kpis([
          { k: 'EBITDA', v: `${fmt(ebitda, 0)}<span class="small"> 億円</span>` },
          { k: 'NOPAT', v: `${fmt(nopat, 1)}<span class="small"> 億円</span>`, tone: nopat < 0 ? 'ng' : '' },
          { k: 'FCF', v: `${fmt(fcf, 1)}<span class="small"> 億円</span>`, tone: fcf >= 0 ? 'ok' : 'ng' },
          { k: '減価償却の節税効果', v: `${fmt(shield, 1)}<span class="small"> 億円</span>` },
        ]);
        box.querySelector('.formula').innerHTML = md(`$$FCF = ${fmt(nopat, 1)} + ${fmt(d, 0)} - ${fmt(cx, 0)} - ${w < 0 ? '(' + fmt(w, 0) + ')' : fmt(w, 0)} = ${fmt(fcf, 1)}$$`);
        box.querySelector('.chart').innerHTML = waterfall([
          { l: '営業利益', v: ebit, total: true },
          { l: '−税', v: -tax },
          { l: 'NOPAT', v: nopat, total: true },
          { l: '＋減価\n償却費', v: d },
          { l: '−設備\n投資', v: -cx },
          { l: '−運転資本\nの増加', v: -w },
          { l: 'FCF', v: fcf, total: true, c: 'var(--tv)' },
        ], { unit: '単位：億円　営業利益 ×（1−税率）＝ NOPAT → 減価償却費を足し戻し、設備投資と運転資本の増加を引く', label: '営業利益からFCFまでの滝グラフ' });
        const ins = box.querySelector('.insight');
        const msgs = [];
        if (ebit < 0) msgs.push('営業赤字なので、税はゼロとして計算しています（NOPAT ＝ 営業利益）。');
        if (fcf < 0 && (cx > d || w > 0)) msgs.push(`FCFはマイナスです。設備投資が減価償却費を <strong>${fmt(cx - d, 0)}億円</strong> 上回り、運転資本も ${fmt(w, 0)}億円 増えています。成長のための投資なら、マイナスでも悪いとは限りません（将来のリターンが資本コストを上回るかで判断）。`);
        else if (nopat > 0) msgs.push(`FCFはNOPATの <strong>${fmt(fcf / nopat * 100, 0)}%</strong>。利益とお金の差は「設備投資 − 減価償却費」（${sgn(cx - d)}億円）と「運転資本の増加」（${sgn(w)}億円）で決まります。`);
        msgs.push(`EBITDA（${fmt(ebitda, 0)}）とFCF（${fmt(fcf, 0)}）の差は ${fmt(ebitda - fcf, 0)}億円。EBITDAを「自由に使えるお金」と見ると過大評価になります。`);
        ins.className = 'insight' + (fcf < 0 ? ' warn' : '');
        ins.innerHTML = msgs.join('<br>');
      }
      draw();
    },
  };

  // CCCの時間軸の図
  function cccBar(inv, ar, ap) {
    const W = 560, L = 8, R = 12, maxD = Math.max(inv + ar, ap, 30);
    const X = d => L + d / maxD * (W - L - R);
    const ccc = inv + ar - ap;
    const ticks = []; const st = maxD > 200 ? 50 : maxD > 100 ? 25 : 10;
    for (let t = 0; t <= maxD + 1e-9; t += st) ticks.push(t);
    const rect = (a, b, y, c) => `<rect x="${X(a)}" y="${y}" width="${Math.max(1, X(b) - X(a))}" height="14" rx="3" fill="${c}"/>`;
    return `<svg viewBox="0 0 ${W} 152" role="img" aria-label="CCCの時間軸">
      ${ticks.map(t => `<line x1="${X(t)}" x2="${X(t)}" y1="16" y2="112" stroke="var(--border)" stroke-width="0.5"/><text x="${X(t)}" y="126" text-anchor="middle">${t}</text>`).join('')}
      <text x="${L}" y="13">仕入 → 在庫 ${fmt(inv, 1)}日 → 売上（売上債権 ${fmt(ar, 1)}日）→ 代金を回収</text>
      ${rect(0, inv, 18, 'var(--c3)')}${rect(inv, inv + ar, 18, 'var(--tv)')}
      <text x="${L}" y="49">仕入代金の支払いまで（仕入債務 ${fmt(ap, 1)}日）</text>
      ${rect(0, ap, 54, 'var(--ok)')}
      <text x="${L}" y="85">${ccc >= 0 ? `CCC ${fmt(ccc, 1)}日：自社がお金を立て替えている期間` : `CCC ${fmt(ccc, 1)}日：回収が支払いより先（立て替え不要）`}</text>
      ${ccc >= 0 ? rect(ap, inv + ar, 90, 'var(--ng)') : rect(inv + ar, ap, 90, 'var(--ok)')}
      <text x="${W - R}" y="148" text-anchor="end">日数 →</text></svg>`;
  }

  SIMS.ccc = {
    title: '売上成長と運転資本（CCC）',
    desc: '売上が伸びると、売上債権と在庫が増えてキャッシュを吸収する。回転日数（CCC）と成長率を動かして、来期のFCFがどう変わるかを見よう。初期値はミナト精機（前期末の正味運転資本450億円）。',
    render(box) {
      box.innerHTML = `<div class="sim-grid"><div class="ctls"></div><div><div class="kpis"></div><div class="chart cccbar"></div>
        ${legend([['var(--c3)', '在庫'], ['var(--tv)', '売上債権'], ['var(--ok)', '仕入債務'], ['var(--ng)', 'CCC（立て替え）']])}
        <h3>売上成長率と来期のFCF（今の回転日数のまま）</h3><div class="chart line"></div>
        ${legend([['var(--accent)', '来期のFCF'], ['var(--muted)', 'FCF＝0']])}
        <p class="small muted">前提（ミナト精機）：売上高2,000億円・売上原価率75%・営業利益率7.5%・税率30%・減価償却費90・設備投資85（成長しても一定と単純化）。</p>
        <div class="insight"></div></div></div>`;
      const c = box.querySelector('.ctls');
      const g = {
        gr: slider(c, { key: 'gr', label: '来期の売上成長率', min: -10, max: 40, step: 1, value: 10, show: v => v + '%' }, draw),
        ar: slider(c, { key: 'ar', label: '売上債権回転日数', min: 0, max: 150, step: 0.1, value: 73, show: v => fmt(v, 1) + '日' }, draw),
        inv: slider(c, { key: 'inv', label: '棚卸資産回転日数', min: 0, max: 150, step: 0.1, value: 85.2, show: v => fmt(v, 1) + '日' }, draw),
        ap: slider(c, { key: 'ap', label: '仕入債務回転日数', min: 0, max: 150, step: 0.1, value: 73, show: v => fmt(v, 1) + '日' }, draw),
      };
      const S0 = 2000, COGS = 0.75, M = 0.075, TAX = 0.3, D = 90, CX = 85, NWC0 = 450;
      const model = (gr, ar, inv, ap) => {
        const s1 = S0 * (1 + gr), c1 = s1 * COGS;
        const nwc1 = s1 * ar / 365 + c1 * inv / 365 - c1 * ap / 365;
        const nopat = s1 * M * (1 - TAX), dw = nwc1 - NWC0;
        return { s1, nwc1, nopat, dw, fcf: nopat + D - CX - dw };
      };
      function draw() {
        const gr = g.gr() / 100, ar = g.ar(), inv = g.inv(), ap = g.ap();
        const r = model(gr, ar, inv, ap), ccc = ar + inv - ap;
        box.querySelector('.kpis').innerHTML = kpis([
          { k: 'CCC', v: `${fmt(ccc, 1)}<span class="small"> 日</span>`, tone: ccc > 85.2 + 0.05 ? 'ng' : ccc < 85.2 - 0.05 ? 'ok' : '' },
          { k: '来期末の正味運転資本', v: `${fmt(r.nwc1, 0)}<span class="small"> 億円</span>` },
          { k: '運転資本の増加', v: `${sgn(r.dw)}<span class="small"> 億円</span>`, tone: r.dw > 0.5 ? 'ng' : r.dw < -0.5 ? 'ok' : '' },
          { k: '来期のFCF', v: `${fmt(r.fcf, 0)}<span class="small"> 億円</span>`, tone: r.fcf >= 0 ? 'ok' : 'ng' },
        ]);
        box.querySelector('.cccbar').innerHTML = cccBar(inv, ar, ap);
        // 成長率とFCFの関係（回転日数は今の設定のまま）
        const pts = [];
        for (let x = -10; x <= 40; x += 1) pts.push([x, model(x / 100, ar, inv, ap).fcf]);
        const ys = pts.map(p => p[1]).concat(0);
        const st = 50, yMin = Math.floor(Math.min(...ys) / st) * st, yMax = Math.max(yMin + st, Math.ceil(Math.max(...ys) / st) * st);
        const span = yMax - yMin, yStep = span > 600 ? 200 : span > 300 ? 100 : 50;
        box.querySelector('.line').innerHTML = lineChart([{ pts }], {
          xMin: -10, xMax: 40, yMin, yMax, yStep, yDigits: 0, hlines: [{ y: 0 }],
          points: [{ x: gr * 100, y: r.fcf, color: r.fcf >= 0 ? 'var(--accent)' : 'var(--ng)' }],
          xTicks: [-10, 0, 10, 20, 30, 40].map(v => ({ v, l: v + '%' })),
          xLabel: '売上成長率 →', yLabel: '縦軸：来期のFCF（億円）', label: '売上成長率と来期のFCF',
        });
        // FCF＝0になる成長率：FCF(g) = (1+g)(NOPAT0 − K) + (D − CX + NWC0)、K = 前期売上での正味運転資本
        const K = model(0, ar, inv, ap).nwc1, n0 = S0 * M * (1 - TAX), cst = D - CX + NWC0;
        const be = K > n0 ? cst / (K - n0) - 1 : null;
        const ins = box.querySelector('.insight');
        const ten = S0 * (1 + gr) / 365 * 10;
        const msgs = [];
        if (r.fcf < 0) msgs.push(`<strong>黒字（NOPAT ${fmt(r.nopat, 0)}億円）なのに、FCFはマイナス</strong>です。運転資本が ${fmt(r.dw, 0)}億円 増え、利益以上の現金を事業が吸い込んでいます。外部からの資金調達が必要になり、放置すると黒字倒産のおそれがあります。`);
        else if (r.dw > 0.5) msgs.push(`売上成長などで運転資本が <strong>${fmt(r.dw, 0)}億円</strong> 増え、その分FCFが減っています（NOPAT ${fmt(r.nopat, 0)} → FCF ${fmt(r.fcf, 0)}）。`);
        else if (r.dw < -0.5) msgs.push(`運転資本が ${fmt(-r.dw, 0)}億円 減り、その分の現金が戻ってFCFを押し上げています。`);
        else msgs.push('運転資本はほとんど変わらず、FCFへの影響はほぼありません。');
        if (be != null && be > -0.1 && be < 1) msgs.push(`今の回転日数のままだと、売上成長率が約 <strong>${fmt(be * 100, 0)}%</strong> を超えるとFCFがマイナスになります。`);
        msgs.push(`売上債権回転日数を10日短くすると、約 ${fmt(ten, 0)}億円 の現金が浮きます。`);
        ins.className = 'insight' + (r.fcf < 0 ? ' warn' : '');
        ins.innerHTML = msgs.join('<br>');
      }
      draw();
    },
  };
})();
