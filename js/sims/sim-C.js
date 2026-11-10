// C章のシミュレーター：WACC計算機（CAPM・節税効果・負債比率） / 分散投資の効果
(function () {
  'use strict';
  const { fmt, pct, md, slider, kpis, lineChart, legend } = MoT.View;

  // lineChart と同じ座標系で、点の横に文字を添える（W=560, H=190, L=40, R=10）
  function labels(svg, items, opt) {
    const X = x => 40 + (x - opt.xMin) / (opt.xMax - opt.xMin) * 510;
    const Y = y => 190 - (y - opt.yMin) / (opt.yMax - opt.yMin) * 180;
    const t = items.map(it => `<text x="${X(it.x) + (it.dx ?? 8)}" y="${Y(it.y) + (it.dy ?? -6)}" text-anchor="${it.anchor || 'start'}" fill="${it.color || 'currentColor'}">${it.l}</text>`).join('');
    return svg.replace(/<\/svg>\s*$/, t + '</svg>');
  }

  // ===== WACC計算機 =====
  SIMS.wacc = {
    title: 'WACC計算機（CAPM・節税効果・負債比率）',
    desc: 'CAPMで株主資本コストを出し、負債コストと時価の比率で加重平均してWACCを計算する。(1−t) の効果と、「借入を増やすとWACCは下がるのか」をグラフで確かめよう。',
    render(box) {
      box.innerHTML = `<div class="sim-grid"><div class="ctls"></div><div><div class="kpis"></div><div class="formula md"></div>
        <h3>負債比率を変えたときのWACC</h3><div class="chart"></div>
        ${legend([['var(--accent)', 'βの上昇を織り込む（ハマダの式）'], ['var(--c3)', 'βを固定したまま（よくある誤解）'], ['var(--muted)', 'ROIC']])}
        <div class="insight"></div></div></div>`;
      const c = box.querySelector('.ctls');
      const g = {
        rf: slider(c, { key: 'rf', label: 'リスクフリーレート r_f', min: 0, max: 3, step: 0.1, value: 1.0, show: pct }, draw),
        b: slider(c, { key: 'b', label: 'β（今の負債比率での値）', min: 0.5, max: 2.5, step: 0.05, value: 1.5, show: v => fmt(v, 2) }, draw),
        m: slider(c, { key: 'm', label: 'マーケット・リスクプレミアム', min: 3, max: 9, step: 0.5, value: 6.5, show: pct }, draw),
        rd: slider(c, { key: 'rd', label: '負債コスト r_d（税引前）', min: 0.5, max: 5, step: 0.1, value: 1.5, show: pct }, draw),
        t: slider(c, { key: 't', label: '税率 t', min: 0, max: 40, step: 1, value: 30, show: v => v + '%' }, draw),
        d0: slider(c, { key: 'd0', label: '今の負債比率 D/(D+E)（時価）', min: 0, max: 70, step: 0.1, value: 29.4, show: pct }, draw),
        d1: slider(c, { key: 'd1', label: '変更後の負債比率（借入を増減）', min: 0, max: 80, step: 0.1, value: 29.4, show: pct }, draw),
        roic: slider(c, { key: 'roic', label: 'ROIC（比べる相手）', min: 0, max: 15, step: 0.25, value: 5.25, show: v => fmt(v, 2) + '%' }, draw),
      };
      c.insertAdjacentHTML('beforeend', '<p class="small muted">初期値はミナト精機（D 500億円：E 1,200億円 → 負債比率29.4%）。</p>');
      // 負債比率 d のときの β・re・WACC。βU は「今の負債比率 d0 で β」となるように逆算する
      const calc = (p, d, adjust) => {
        const de = x => x / (1 - x);
        const bu = p.b / (1 + (1 - p.t) * de(p.d0));
        const bl = adjust ? bu * (1 + (1 - p.t) * de(d)) : p.b;
        const re = p.rf + bl * p.m, rdat = p.rd * (1 - p.t);
        return { bu, bl, re, rdat, w: d * rdat + (1 - d) * re, wNoTax: d * p.rd + (1 - d) * re };
      };
      function draw() {
        const p = { rf: g.rf(), b: g.b(), m: g.m(), rd: g.rd(), t: g.t() / 100, d0: g.d0() / 100 };
        const d1 = g.d1() / 100, roic = g.roic();
        const now = calc(p, p.d0, true), aft = calc(p, d1, true), fix = calc(p, d1, false);
        const spread = roic - aft.w;
        box.querySelector('.kpis').innerHTML = kpis([
          { k: '株主資本コスト r_e', v: fmt(aft.re, 2) + '%' },
          { k: '税引後の負債コスト', v: fmt(aft.rdat, 2) + '%' },
          { k: 'WACC', v: fmt(aft.w, 2) + '%', tone: spread >= 0 ? 'ok' : 'ng' },
          { k: 'ROIC − WACC', v: (spread >= 0 ? '+' : '') + fmt(spread, 2) + '%', tone: spread >= 0 ? 'ok' : 'ng' },
        ]);
        const changed = Math.abs(d1 - p.d0) > 1e-9;
        box.querySelector('.formula').innerHTML = md(`
$$r_e = ${fmt(p.rf, 1)}\\% + ${fmt(aft.bl, 2)}\\times${fmt(p.m, 1)}\\% = ${fmt(aft.re, 2)}\\%$$
$$WACC = ${fmt(d1 * 100, 1)}\\%\\times${fmt(p.rd, 1)}\\%\\times(1-${fmt(p.t, 2)}) + ${fmt((1 - d1) * 100, 1)}\\%\\times${fmt(aft.re, 2)}\\% = ${fmt(aft.w, 2)}\\%$$
| 比べてみる | WACC |
|---|---|
| 正しい計算${changed ? '（βの上昇を織り込む）' : ''} | **${fmt(aft.w, 2)}%** |
| (1−t) を忘れた場合 | ${fmt(aft.wNoTax, 2)}% |
${changed ? `| βを ${fmt(p.b, 2)} のまま固定した場合 | ${fmt(fix.w, 2)}% |\n` : ''}| 今の負債比率（${fmt(p.d0 * 100, 1)}%）のWACC | ${fmt(now.w, 2)}% |`);
        // グラフ：負債比率 0〜80% の WACC
        const adj = [], fx = [];
        for (let i = 0; i <= 80; i++) { const d = i / 100; adj.push([d, calc(p, d, true).w]); fx.push([d, calc(p, d, false).w]); }
        const all = adj.concat(fx).map(q => q[1]).concat([roic]);
        const yMax = Math.ceil(Math.max(...all) / 2) * 2 + 2, yMin = Math.max(0, Math.floor(Math.min(...all) / 2) * 2 - 2);
        const step = yMax - yMin > 16 ? 4 : 2;
        const opt = {
          xMin: 0, xMax: 0.8, yMin, yMax, yStep: step, yDigits: 0, hlines: [{ y: roic, label: `ROIC ${fmt(roic, 2)}%` }],
          points: [{ x: p.d0, y: now.w, color: 'var(--muted)' }, { x: d1, y: aft.w }],
          xTicks: [0, 0.2, 0.4, 0.6, 0.8].map(v => ({ v, l: v * 100 + '%' })),
          xLabel: '負債比率 D/(D+E) →', yLabel: '縦軸：WACC（%）', label: '負債比率とWACCの関係',
        };
        box.querySelector('.chart').innerHTML = lineChart([{ pts: fx, color: 'var(--c3)', dash: true }, { pts: adj }], opt);
        // 気づき
        const ins = box.querySelector('.insight');
        const taxEff = aft.wNoTax - aft.w;
        let s = `(1−t) の節税効果で、WACCは <strong>${fmt(taxEff, 2)}%</strong> 下がっています。`;
        if (changed) {
          const dir = d1 > p.d0 ? '増やす' : '減らす';
          s += ` 借入を${dir}と β は ${fmt(p.b, 2)} → <strong>${fmt(aft.bl, 2)}</strong> に変わり、株主資本コストは ${fmt(now.re, 2)}% → ${fmt(aft.re, 2)}% になります。` +
            ` βを固定すると WACC は ${fmt(fix.w, 2)}% と計算されますが、実際の変化は ${fmt(now.w, 2)}% → ${fmt(aft.w, 2)}% にとどまります（残る差は主に節税効果）。`;
        } else {
          s += ' 「変更後の負債比率」を動かして、借入を増やしたときのWACCを2本の線で比べてみよう。';
        }
        s += spread >= 0 ? ' ROIC が WACC を上回っており、事業は資本コスト以上に稼いでいます。' : ` ROIC が WACC を <strong>${fmt(-spread, 2)}%</strong> 下回っています。資本構成をいじるより、ROIC を上げることが本筋です。`;
        ins.className = 'insight'; ins.innerHTML = s;
      }
      draw();
    },
  };

  // ===== 分散投資の効果 =====
  SIMS.diversify = {
    title: '分散投資の効果（2つの株 / 銘柄数）',
    desc: '①相関係数と配分を動かして、リターンは加重平均のままリスクだけが下がることを確かめる。②銘柄数を増やすと固有リスクが消え、市場リスクの水準で下げ止まることを確かめる。',
    render(box) {
      box.innerHTML = `<h3>① 2つの株を組み合わせる</h3>
        <div class="sim-grid"><div class="ctls c1"></div><div><div class="kpis k1"></div><div class="chart ch1"></div>
        ${legend([['var(--accent)', '配分を0〜100%動かしたときの組み合わせ'], ['var(--muted)', '相関1のとき（効果なし）'], ['var(--ok)', 'リスク最小の組み合わせ']])}
        <div class="insight i1"></div></div></div>
        <h3>② 銘柄数を増やす</h3>
        <div class="sim-grid"><div class="ctls c2"></div><div><div class="kpis k2"></div><div class="chart ch2"></div>
        ${legend([['var(--accent)', 'ポートフォリオの標準偏差'], ['var(--muted)', '市場リスク（分散しても消えない水準）']])}
        <div class="insight i2"></div></div></div>`;
      // ---- ① 2資産 ----
      const A = { r: 10, s: 30 }, B = { r: 5, s: 15 };
      const c1 = box.querySelector('.c1');
      const g1 = {
        rho: slider(c1, { key: 'rho', label: '相関係数 ρ', min: -1, max: 1, step: 0.05, value: 0.2, show: v => fmt(v, 2) }, draw1),
        w: slider(c1, { key: 'w', label: '株A（成長株）への配分', min: 0, max: 100, step: 5, value: 50, show: v => v + '%（B ' + (100 - v) + '%）' }, draw1),
      };
      c1.insertAdjacentHTML('beforeend', '<p class="small muted">株A：期待リターン10%、標準偏差30%。株B：期待リターン5%、標準偏差15%（説明用の仮定）。</p>');
      const port = (w, rho) => ({ r: w * A.r + (1 - w) * B.r, s: Math.sqrt(Math.max(0, w * w * A.s * A.s + (1 - w) ** 2 * B.s * B.s + 2 * w * (1 - w) * rho * A.s * B.s)) });
      function draw1() {
        const rho = g1.rho(), w = g1.w() / 100, p = port(w, rho), avg = w * A.s + (1 - w) * B.s;
        const den = A.s * A.s + B.s * B.s - 2 * rho * A.s * B.s;
        let wm = den > 1e-9 ? (B.s * B.s - rho * A.s * B.s) / den : 0;
        wm = Math.min(1, Math.max(0, wm));
        const pm = port(wm, rho);
        box.querySelector('.k1').innerHTML = kpis([
          { k: '期待リターン', v: pct(p.r) },
          { k: 'リスク（標準偏差）', v: pct(p.s) },
          { k: '加重平均の標準偏差', v: pct(avg) },
          { k: 'リスクの減少（分散効果）', v: pct(avg - p.s), tone: avg - p.s > 0.05 ? 'ok' : '' },
        ]);
        const curve = [];
        for (let i = 0; i <= 100; i++) { const q = port(i / 100, rho); curve.push([q.s, q.r]); }
        const opt = {
          xMin: 0, xMax: 35, yMin: 4, yMax: 11, yStep: 1, yDigits: 0,
          points: [{ x: A.s, y: A.r, color: 'var(--c3)' }, { x: B.s, y: B.r, color: 'var(--c3)' }, { x: pm.s, y: pm.r, color: 'var(--ok)' }, { x: p.s, y: p.r }],
          xTicks: [0, 5, 10, 15, 20, 25, 30, 35].map(v => ({ v, l: v + '%' })),
          xLabel: 'リスク（標準偏差）→', yLabel: '縦軸：期待リターン（%）', label: '2つの株の組み合わせのリスクとリターン',
        };
        const svg = lineChart([{ pts: [[B.s, B.r], [A.s, A.r]], color: 'var(--muted)', dash: true }, { pts: curve }], opt);
        box.querySelector('.ch1').innerHTML = labels(svg, [{ x: A.s, y: A.r, l: '株A', dx: -8, anchor: 'end' }, { x: B.s, y: B.r, l: '株B', dy: 16 }], opt);
        const ins = box.querySelector('.i1');
        let s;
        if (rho >= 0.999) s = '相関が1なので、2つの株は完全に同じ向きに動きます。打ち消し合いが起きず、リスクは加重平均のまま（グラフは直線）です。';
        else if (rho <= -0.999) s = `相関が−1なので、株Aを${fmt(wm * 100, 0)}%にするとリスクを<strong>ゼロ</strong>にできます（期待リターン ${pct(pm.r)}）。現実にはこのような組み合わせはほぼありません。`;
        else s = `期待リターンは ${pct(p.r)}（加重平均）のまま、リスクは加重平均 ${pct(avg)} より <strong>${fmt(avg - p.s, 1)}%</strong> 小さくなっています。`;
        if (rho < 0.999 && rho > -0.999 && wm > 0.001) s += ` リスクが最小になるのは株Aが約${fmt(wm * 100, 0)}%のとき（標準偏差 ${pct(pm.s)}）で、<strong>安定株B単独（15%）よりリスクが低く、リターンは高い</strong>。`;
        ins.className = 'insight'; ins.innerHTML = s;
      }
      // ---- ② N銘柄 ----
      const c2 = box.querySelector('.c2');
      const g2 = {
        n: slider(c2, { key: 'n', label: '銘柄数 N（等しい金額ずつ）', min: 1, max: 50, step: 1, value: 10, show: v => v + '銘柄' }, draw2),
        s: slider(c2, { key: 's', label: '1銘柄の標準偏差 σ', min: 15, max: 50, step: 5, value: 30, show: v => v + '%' }, draw2),
        rho: slider(c2, { key: 'rho2', label: '銘柄どうしの平均の相関 ρ', min: 0, max: 0.8, step: 0.05, value: 0.25, show: v => fmt(v, 2) }, draw2),
      };
      const sdN = (n, s, rho) => Math.sqrt(s * s / n + (1 - 1 / n) * rho * s * s);
      function draw2() {
        const n = g2.n(), s = g2.s(), rho = g2.rho(), sp = sdN(n, s, rho), lim = Math.sqrt(rho) * s;
        const idio = s * s - rho * s * s, left = sp * sp - lim * lim; // 分散で見た固有リスク
        const gone = idio > 1e-9 ? (1 - left / idio) * 100 : 100;
        box.querySelector('.k2').innerHTML = kpis([
          { k: `${n}銘柄の標準偏差`, v: pct(sp) },
          { k: '市場リスク（下限）', v: pct(lim) },
          { k: '消えた固有リスク', v: fmt(gone, 0) + '%', tone: gone >= 90 ? 'ok' : '' },
          { k: '1銘柄の分散のうち市場リスク', v: fmt(rho * 100, 0) + '%' },
        ]);
        const pts = []; for (let k = 1; k <= 50; k++) pts.push([k, sdN(k, s, rho)]);
        const yMax = Math.ceil(s / 10) * 10;
        box.querySelector('.ch2').innerHTML = lineChart([{ pts }], {
          xMin: 1, xMax: 50, yMin: 0, yMax, yStep: 10, yDigits: 0, hlines: [{ y: lim, label: `市場リスク ${pct(lim)}` }],
          points: [{ x: n, y: sp }], xTicks: [1, 10, 20, 30, 40, 50].map(v => ({ v, l: String(v) })),
          xLabel: '銘柄数 N →', yLabel: '縦軸：標準偏差（%）', label: '銘柄数とポートフォリオのリスク',
        });
        const ins = box.querySelector('.i2');
        if (rho < 1e-9) {
          ins.className = 'insight warn';
          ins.innerHTML = '相関が0だと、銘柄を増やすほどリスクはゼロに近づきます。しかし現実の株は景気や金利で一緒に動く（相関がプラス）ので、市場リスクは必ず残ります。';
        } else {
          ins.className = 'insight';
          ins.innerHTML = `${n}銘柄で、消せる固有リスク（分散で見て）の <strong>${fmt(gone, 0)}%</strong> が消えています。いくら増やしても標準偏差は <strong>${pct(lim)}</strong>（＝√ρ × σ）で下げ止まります。この消せない部分にだけ、市場は見返りを払います（→ CAPM の β）。`;
        }
      }
      draw1(); draw2();
    },
  };
})();
