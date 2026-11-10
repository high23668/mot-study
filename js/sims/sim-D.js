// D章のシミュレーター：DCF法 / PBR・ROE・株主資本コスト
(function () {
  'use strict';
  const { fmt, pct, md, slider, kpis, barChart, lineChart, legend } = MoT.View;

  SIMS.dcf = {
    title: 'DCF法シミュレーター',
    desc: '前提を動かして、事業価値がどれだけ動くか、TV（ターミナルバリュー）がどれだけの割合を占めるかを体感しよう。',
    render(box) {
      box.innerHTML = `<div class="sim-grid"><div class="ctls"></div><div><div class="kpis"></div><div class="chart"></div>
        ${legend([['var(--accent)', '各年のFCFの現在価値'], ['var(--tv)', 'TVの現在価値']])}
        <h3>感応度：事業価値（億円）</h3><div class="sens-box" style="overflow-x:auto"></div><div class="insight"></div></div></div>`;
      const c = box.querySelector('.ctls');
      const g = {
        f1: slider(c, { key: 'f1', label: '1年目のFCF', min: 20, max: 300, step: 10, value: 100, show: v => v + '億円' }, draw),
        gr: slider(c, { key: 'gr', label: '予測期間中の成長率', min: 0, max: 15, step: 0.5, value: 10, show: pct }, draw),
        n: slider(c, { key: 'n', label: '予測期間 N', min: 3, max: 10, step: 1, value: 5, show: v => v + '年' }, draw),
        w: slider(c, { key: 'w', label: 'WACC（割引率）', min: 4, max: 15, step: 0.5, value: 8, show: pct }, draw),
        g: slider(c, { key: 'g', label: '永久成長率 g（N年目より後）', min: 0, max: 5, step: 0.5, value: 2, show: pct }, draw),
        nd: slider(c, { key: 'nd', label: '純有利子負債', min: 0, max: 1500, step: 50, value: 400, show: v => v + '億円' }, draw),
        sh: slider(c, { key: 'sh', label: '発行済株式数', min: 1000, max: 20000, step: 1000, value: 5000, show: v => v.toLocaleString() + '万株' }, draw),
      };
      function calc(f1, gr, n, w, gg) {
        const pv = []; let f = f1;
        for (let t = 1; t <= n; t++) { pv.push(f / Math.pow(1 + w, t)); if (t < n) f *= 1 + gr; }
        if (w <= gg) return { pv, bad: true };
        const tv = f * (1 + gg) / (w - gg), ptv = tv / Math.pow(1 + w, n);
        return { pv, tv, ptv, ev: pv.reduce((a, b) => a + b, 0) + ptv };
      }
      function draw() {
        const f1 = g.f1(), gr = g.gr() / 100, n = g.n(), w = g.w() / 100, gg = g.g() / 100, nd = g.nd(), sh = g.sh();
        const r = calc(f1, gr, n, w, gg);
        const kp = box.querySelector('.kpis'), ins = box.querySelector('.insight');
        if (r.bad) {
          kp.innerHTML = kpis([{ k: '事業価値', v: '計算不能', tone: 'ng' }]);
          box.querySelector('.chart').innerHTML = ''; box.querySelector('.sens-box').innerHTML = '';
          ins.className = 'insight warn'; ins.innerHTML = '永久成長率 g が WACC 以上になっています。分母（WACC − g）がゼロ以下になり、永久成長モデルは成り立ちません。';
          return;
        }
        const eq = r.ev - nd, px = eq * 1e8 / (sh * 1e4);
        kp.innerHTML = kpis([
          { k: '事業価値', v: `${fmt(r.ev, 0)}<span class="small"> 億円</span>` },
          { k: 'うちTVの割合', v: `${fmt(r.ptv / r.ev * 100, 0)}%` },
          { k: '株式価値', v: `${fmt(eq, 0)}<span class="small"> 億円</span>` },
          { k: '理論株価', v: px > 0 ? `${fmt(px, 0)}<span class="small"> 円</span>` : '債務超過', tone: px > 0 ? '' : 'ng' },
        ]);
        const bars = r.pv.map((v, i) => ({ l: (i + 1) + '年', v })).concat([{ l: 'TV', v: r.ptv, c: 'var(--tv)' }]);
        box.querySelector('.chart').innerHTML = barChart(bars, { unit: `単位：億円（現在価値）　TVは${n}年目時点で ${fmt(r.tv, 0)}億円 → ÷(1+WACC)^${n} で今の価値に`, label: '各年のFCFとTVの現在価値' });
        const ws = [-1, -0.5, 0, 0.5, 1], gs = [-1, 0, 1];
        box.querySelector('.sens-box').innerHTML = `<table class="sens"><thead><tr><th>g ＼ WACC</th>${ws.map(d => `<th>${fmt(w * 100 + d, 1)}%</th>`).join('')}</tr></thead><tbody>
          ${gs.map(dg => `<tr><th>${fmt(gg * 100 + dg, 1)}%</th>${ws.map(dw => { const x = calc(f1, gr, n, w + dw / 100, gg + dg / 100); const ok = !x.bad && gg + dg / 100 >= 0; return `<td class="${dw === 0 && dg === 0 ? 'c' : ''}">${ok ? fmt(x.ev, 0) : '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
        const lo = calc(f1, gr, n, w - 0.01, gg);
        ins.className = 'insight';
        ins.innerHTML = lo.bad ? 'WACCを1%下げると g 以下になり、計算できなくなります。' :
          `WACCを1%下げるだけで、事業価値は <strong>${fmt((lo.ev / r.ev - 1) * 100, 0)}%</strong> 増えます。TVが価値の${fmt(r.ptv / r.ev * 100, 0)}%を占めるので、割引率と g の前提が結果を大きく左右します。`;
      }
      draw();
    },
  };

  SIMS.pbr = {
    title: 'PBR・ROE・株主資本コスト シミュレーター',
    desc: '定率成長の配当割引モデルで、ROE・株主資本コスト・内部留保率からPERとPBRを計算する。「ROE > 株主資本コスト」のときだけ、再投資で価値が増えることを確かめよう。',
    render(box) {
      box.innerHTML = `<div class="sim-grid"><div class="ctls"></div><div><div class="kpis"></div><div class="formula md"></div><div class="chart"></div>
        ${legend([['var(--accent)', '内部留保率を変えたときのPBR'], ['var(--muted)', 'PBR＝1倍']])}<div class="insight"></div></div></div>`;
      const c = box.querySelector('.ctls');
      const g = {
        roe: slider(c, { key: 'roe', label: 'ROE', min: 0, max: 20, step: 0.5, value: 6.5, show: pct }, draw),
        re: slider(c, { key: 're', label: '株主資本コスト r_e', min: 4, max: 12, step: 0.25, value: 10.75, show: v => fmt(v, 2) + '%' }, draw),
        b: slider(c, { key: 'b', label: '内部留保率 b（＝1−配当性向）', min: 0, max: 90, step: 5, value: 70, show: v => v + '%' }, draw),
      };
      const pbrOf = (roe, re, b) => { const gg = roe * b; return gg >= re ? null : roe * (1 - b) / (re - gg); };
      function draw() {
        const roe = g.roe() / 100, re = g.re() / 100, b = g.b() / 100, gg = roe * b;
        const pbr = pbrOf(roe, re, b);
        const kp = box.querySelector('.kpis'), ins = box.querySelector('.insight');
        box.querySelector('.formula').innerHTML = md(`$$g = ROE \\times b = ${fmt(gg * 100, 1)}\\%,\\quad PBR = \\frac{ROE(1-b)}{r_e - g}$$`);
        if (pbr == null) {
          kp.innerHTML = kpis([{ k: 'PBR', v: '計算不能', tone: 'ng' }]);
          ins.className = 'insight warn'; ins.innerHTML = `成長率 g（${fmt(gg * 100, 1)}%）が株主資本コスト以上です。このモデルは r_e > g が前提なので、内部留保率を下げてください。`;
        } else {
          kp.innerHTML = kpis([
            { k: '成長率 g', v: pct(gg * 100) },
            { k: 'PER（予想）', v: roe > 0 ? fmt(pbr / roe, 1) + '倍' : '—' },
            { k: 'PBR', v: fmt(pbr, 2) + '倍', tone: pbr >= 1 ? 'ok' : 'ng' },
            { k: 'ROE − r_e', v: (roe - re >= 0 ? '+' : '') + pct((roe - re) * 100), tone: roe >= re ? 'ok' : 'ng' },
          ]);
          ins.className = 'insight';
          ins.innerHTML = Math.abs(roe - re) < 1e-9 ? 'ROE ＝ 株主資本コスト のとき、内部留保率に関係なく PBR は 1倍になります。'
            : roe > re ? 'ROE が株主資本コストを上回っています（PBR > 1）。<strong>利益を再投資するほど PBR は上がります</strong>（グラフは右上がり）。'
            : 'ROE が株主資本コストを下回っています（PBR < 1）。<strong>再投資するほど価値を壊します</strong>（グラフは右下がり）。配当や自社株買いで株主に返す方が合理的です。';
        }
        const pts = [];
        for (let x = 0; x <= 0.9001; x += 0.01) { const p = pbrOf(roe, re, x); if (p != null && p < 6) pts.push([x, p]); }
        const ymax = Math.max(2, Math.ceil(Math.max(1, ...pts.map(p => p[1])) * 2) / 2);
        box.querySelector('.chart').innerHTML = lineChart([{ pts }], {
          xMin: 0, xMax: 0.9, yMin: 0, yMax: ymax, yStep: ymax > 3 ? 1 : 0.5, hlines: [{ y: 1 }],
          points: pbr != null && pbr < 6 ? [{ x: b, y: pbr }] : [], xTicks: [0, 0.3, 0.6, 0.9].map(v => ({ v, l: v * 100 + '%' })),
          xLabel: '内部留保率 b →', yLabel: '縦軸：PBR（倍）', label: '内部留保率とPBRの関係',
        });
      }
      draw();
    },
  };
})();
