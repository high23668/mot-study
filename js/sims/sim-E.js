// E章のシミュレーター：NPVプロファイル（NPVとIRR） / リアルオプション（ディシジョンツリー）
(function () {
  'use strict';
  const { fmt, pct, md, slider, kpis, barChart, lineChart, legend } = MoT.View;

  // 目盛りの間隔を「1, 2, 5 × 10^k」に丸める
  function niceStep(span) {
    const raw = Math.max(span, 1e-9) / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }
  const sgn = v => (v >= 0 ? '+' : '−') + fmt(Math.abs(v), 1);

  SIMS.npvProfile = {
    title: 'NPVプロファイル（NPVとIRR）',
    desc: '投資額や年間キャッシュフローを動かし、割引率とNPVの関係を見よう。曲線がゼロを切る点がIRR、点線がハードルレート（WACC）の位置。',
    render(box) {
      box.innerHTML = `<div class="sim-grid"><div class="ctls"></div><div><div class="kpis"></div><div class="chart"></div>
        ${legend([['var(--accent)', 'NPV（割引率を変えたとき）'], ['var(--muted)', 'ハードルレート（WACC）'], ['var(--ok)', 'IRR（NPV＝0の点）']])}
        <div class="formula md"></div><div class="insight"></div></div></div>`;
      const c = box.querySelector('.ctls');
      const g = {
        inv: slider(c, { key: 'inv', label: '初期投資（設備＋運転資本）', min: 20, max: 300, step: 5, value: 110, show: v => v + '億円' }, draw),
        cf: slider(c, { key: 'cf', label: '1年目のキャッシュフロー', min: 5, max: 80, step: 0.5, value: 30.5, show: v => fmt(v, 1) + '億円' }, draw),
        gr: slider(c, { key: 'gr', label: 'キャッシュフローの成長率（毎年）', min: -10, max: 10, step: 1, value: 0, show: v => v + '%' }, draw),
        n: slider(c, { key: 'n', label: '期間 N', min: 2, max: 15, step: 1, value: 5, show: v => v + '年' }, draw),
        rec: slider(c, { key: 'rec', label: '最終年の回収額（運転資本・売却）', min: 0, max: 60, step: 1, value: 10, show: v => v + '億円' }, draw),
        w: slider(c, { key: 'w', label: 'ハードルレート（WACC）', min: 2, max: 20, step: 0.5, value: 8, show: pct }, draw),
      };
      const flows = (inv, cf, gr, n, rec) => {
        const a = [-inv];
        for (let t = 1; t <= n; t++) a.push(cf * Math.pow(1 + gr, t - 1) + (t === n ? rec : 0));
        return a;
      };
      const npv = (r, a) => a.reduce((s, x, t) => s + x / Math.pow(1 + r, t), 0);
      function irr(a) {
        // 普通の投資（最初だけマイナス）なのでNPVは割引率について単調に減少し、解は1つ
        let lo = -0.95, hi = 10;
        if (npv(lo, a) < 0 || npv(hi, a) > 0) return null;
        for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (npv(m, a) > 0) lo = m; else hi = m; }
        return (lo + hi) / 2;
      }
      function draw() {
        const inv = g.inv(), cf = g.cf(), gr = g.gr() / 100, n = g.n(), rec = g.rec(), w = g.w() / 100;
        const a = flows(inv, cf, gr, n, rec);
        const v = npv(w, a), r = irr(a);
        let cum = 0, pb = null;
        for (let t = 1; t < a.length; t++) { const prev = cum; cum += a[t]; if (pb == null && cum - inv >= 0) pb = t - 1 + (inv - prev) / a[t]; }
        const pvIn = v + inv;
        box.querySelector('.kpis').innerHTML = kpis([
          { k: `NPV（${pct(w * 100)}で割引）`, v: `${sgn(v)}<span class="small"> 億円</span>`, tone: v >= 0 ? 'ok' : 'ng' },
          { k: 'IRR', v: r == null ? '計算不能' : pct(r * 100), tone: r == null ? 'ng' : r >= w ? 'ok' : 'ng' },
          { k: '回収期間', v: pb == null ? '回収できない' : fmt(pb, 1) + '<span class="small"> 年</span>', tone: pb == null ? 'ng' : '' },
          { k: '収益性指数（PI）', v: fmt(pvIn / inv, 2) },
        ]);
        // NPVプロファイル（横軸：割引率 0〜30%）
        const xMax = 0.3, pts = [];
        for (let x = 0; x <= xMax + 1e-9; x += 0.005) pts.push([x, npv(x, a)]);
        const ys = pts.map(p => p[1]);
        let yMin = Math.min(0, ...ys), yMax = Math.max(0, ...ys);
        const st = niceStep(yMax - yMin);
        yMin = Math.floor(yMin / st) * st; yMax = Math.ceil(yMax / st) * st; if (yMax === yMin) yMax = yMin + st;
        const points = [{ x: w, y: v, color: 'var(--accent)' }];
        if (r != null && r >= 0 && r <= xMax) points.push({ x: r, y: 0, color: 'var(--ok)' });
        box.querySelector('.chart').innerHTML = lineChart([
          { pts },
          { pts: [[w, yMin], [w, yMax]], color: 'var(--muted)', dash: true },
        ], {
          xMin: 0, xMax, yMin, yMax, yStep: st, yDigits: st < 1 ? 1 : 0, hlines: [{ y: 0, label: 'NPV＝0' }], points,
          xTicks: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3].map(x => ({ v: x, l: Math.round(x * 100) + '%' })),
          xLabel: '割引率 →', yLabel: '縦軸：NPV（億円）', label: '割引率とNPVの関係（NPVプロファイル）',
        });
        const cfs = a.slice(1).map(x => fmt(x, 1));
        box.querySelector('.formula').innerHTML = md(`CF：0年目 ${fmt(-inv, 0)}、1〜${n}年目 ${cfs.length > 6 ? cfs.slice(0, 3).join('、') + '、…、' + cfs[cfs.length - 1] : cfs.join('、')}（億円）`);
        const ins = box.querySelector('.insight');
        if (r == null) {
          ins.className = 'insight warn';
          ins.innerHTML = 'この設定ではIRRが見つかりません（キャッシュフローがほとんど戻らない）。年間CFを増やすか、初期投資を減らしてください。';
          return;
        }
        ins.className = 'insight';
        const where = r > xMax ? `IRR（${pct(r * 100)}）はグラフの右端（30%）より外にあります。` : r < 0 ? `IRRがマイナス（${pct(r * 100)}）です。割り引かなくても投資額を回収できません。` : '';
        ins.innerHTML = where + (v >= 0
          ? `ハードルレート ${pct(w * 100)} では NPV ${sgn(v)}億円でプラス、IRR ${pct(r * 100)} も ${pct(w * 100)} を上回るので<strong>投資する</strong>。割引率が IRR まで上がっても損はしない（余裕は ${fmt((r - w) * 100, 1)}%ポイント）。`
          : `ハードルレート ${pct(w * 100)} では NPV ${sgn(v)}億円でマイナス、IRR ${pct(r * 100)} がハードルレートを下回るので<strong>見送る</strong>。曲線が NPV＝0 を切る点（IRR）が、点線（WACC）より左にある。`);
      }
      draw();
    },
  };

  SIMS.realOption = {
    title: 'リアルオプション（段階投資のディシジョンツリー）',
    desc: '「最初から全額投資」と「まず小さく実証→成功なら拡大、失敗なら撤退」を比べよう。成功時と失敗時の差（不確実性）を広げると、柔軟性（オプション）の価値が増えることが分かる。',
    render(box) {
      box.innerHTML = `<div class="sim-grid"><div class="ctls"></div><div><div class="kpis"></div><div class="chart tree"></div>
        <h3>不確実性とNPV（期待値は今の設定のまま、成功時と失敗時の差だけを広げる）</h3><div class="chart line"></div>
        ${legend([['var(--accent)', '案B：段階投資（拡張NPV）'], ['var(--ng)', '案A：一括投資（静的NPV）']])}<div class="insight"></div></div></div>`;
      const c = box.querySelector('.ctls');
      const g = {
        p: slider(c, { key: 'p', label: '成功の確率 p', min: 10, max: 90, step: 5, value: 40, show: v => v + '%' }, draw),
        vs: slider(c, { key: 'vs', label: '成功時の事業価値（1年後時点）', min: 50, max: 400, step: 10, value: 200, show: v => v + '億円' }, draw),
        vf: slider(c, { key: 'vf', label: '失敗時の事業価値（1年後時点）', min: 0, max: 150, step: 5, value: 30, show: v => v + '億円' }, draw),
        i1: slider(c, { key: 'i1', label: '実証投資 I₁（今）', min: 0, max: 40, step: 1, value: 10, show: v => v + '億円' }, draw),
        i2: slider(c, { key: 'i2', label: '拡大投資 I₂（案Bは1年後）', min: 10, max: 200, step: 5, value: 90, show: v => v + '億円' }, draw),
        s: slider(c, { key: 's', label: '撤退時の回収額 S', min: 0, max: 30, step: 1, value: 2, show: v => v + '億円' }, draw),
        r: slider(c, { key: 'r', label: '割引率', min: 4, max: 20, step: 0.5, value: 10, show: pct }, draw),
      };
      const calc = (p, vs, vf, i1, i2, s, r) => {
        const d = 1 + r;
        const stat = -(i1 + i2) + (p * vs + (1 - p) * vf) / d;
        const bs = Math.max(vs - i2, s), bf = Math.max(vf - i2, s);
        const stag = -i1 + (p * bs + (1 - p) * bf) / d;
        return { stat, stag, opt: stag - stat, bs, bf };
      };
      function tree(p, vs, vf, i1, i2, s, res) {
        const W = 560, H = 210;
        const leaf = (x, y, txt, on) => `<text x="${x}" y="${y}" style="${on ? 'fill:var(--accent);font-weight:700' : ''}">${txt}</text>`;
        const line = (x1, y1, x2, y2, on) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${on ? 'var(--accent)' : 'var(--border)'}" stroke-width="${on ? 2.5 : 1.5}"/>`;
        const sExp = vs - i2 >= s, fExp = vf - i2 >= s;
        return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="段階投資のディシジョンツリー">
          ${line(70, 105, 160, 105, true)}
          ${line(160, 105, 290, 50, true)}${line(160, 105, 290, 160, true)}
          ${line(290, 50, 360, 25, sExp)}${line(290, 50, 360, 75, !sExp)}
          ${line(290, 160, 360, 135, fExp)}${line(290, 160, 360, 185, !fExp)}
          <rect x="18" y="93" width="52" height="24" rx="3" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/>
          <text x="44" y="109" text-anchor="middle">今</text>
          <circle cx="160" cy="105" r="11" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/>
          <rect x="280" y="40" width="20" height="20" rx="2" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/>
          <rect x="280" y="150" width="20" height="20" rx="2" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/>
          <text x="80" y="98">実証 −${fmt(i1, 0)}</text>
          <text x="140" y="132">1年後に判明</text>
          <text x="196" y="66">成功 ${fmt(p * 100, 0)}%</text>
          <text x="196" y="156">失敗 ${fmt((1 - p) * 100, 0)}%</text>
          ${leaf(366, 29, `拡大：${fmt(vs, 0)} − ${fmt(i2, 0)} ＝ ${fmt(vs - i2, 0)}`, sExp)}
          ${leaf(366, 79, `撤退：回収 ${fmt(s, 0)}`, !sExp)}
          ${leaf(366, 139, `拡大：${fmt(vf, 0)} − ${fmt(i2, 0)} ＝ ${fmt(vf - i2, 0)}`, fExp)}
          ${leaf(366, 189, `撤退：回収 ${fmt(s, 0)}`, !fExp)}
          <text x="18" y="205">□＝自分が選ぶ点（有利な方＝太線）　○＝確率で決まる点　単位：億円（1年後時点の価値）</text>
        </svg>`;
      }
      function draw() {
        const p = g.p() / 100, vs = g.vs(), vf = g.vf(), i1 = g.i1(), i2 = g.i2(), s = g.s(), r = g.r() / 100;
        const kp = box.querySelector('.kpis'), ins = box.querySelector('.insight');
        if (vs < vf) {
          kp.innerHTML = kpis([{ k: '設定', v: '見直しが必要', tone: 'ng' }]);
          box.querySelector('.tree').innerHTML = ''; box.querySelector('.line').innerHTML = '';
          ins.className = 'insight warn'; ins.innerHTML = '成功時の事業価値が失敗時より小さくなっています。成功時 ≧ 失敗時 になるように設定してください。';
          return;
        }
        const res = calc(p, vs, vf, i1, i2, s, r);
        kp.innerHTML = kpis([
          { k: '案A：一括投資（静的NPV）', v: `${sgn(res.stat)}<span class="small"> 億円</span>`, tone: res.stat >= 0 ? 'ok' : 'ng' },
          { k: '案B：段階投資（拡張NPV）', v: `${sgn(res.stag)}<span class="small"> 億円</span>`, tone: res.stag >= 0 ? 'ok' : 'ng' },
          { k: 'オプションの価値（B − A）', v: `${sgn(res.opt)}<span class="small"> 億円</span>` },
        ]);
        box.querySelector('.tree').innerHTML = tree(p, vs, vf, i1, i2, s, res);
        // 期待値 E を固定し、差 sp = 成功時 − 失敗時 を 0 から（失敗時の価値が 0 になるまで）広げる
        const E = p * vs + (1 - p) * vf, s0 = vs - vf, sMax = Math.max(E / p, s0, 1);
        const pa = [], pb = [];
        for (let k = 0; k <= 60; k++) {
          const sp = sMax * k / 60, v1 = E + sp * (1 - p), v2 = E - sp * p;
          const x = calc(p, v1, v2, i1, i2, s, r); pa.push([sp, x.stat]); pb.push([sp, x.stag]);
        }
        const ys = pa.concat(pb).map(q => q[1]);
        let yMin = Math.min(0, ...ys), yMax = Math.max(0, ...ys);
        const st = niceStep(yMax - yMin);
        yMin = Math.floor(yMin / st) * st; yMax = Math.ceil(yMax / st) * st; if (yMax === yMin) yMax = yMin + st;
        const tStep = niceStep(sMax), ticks = [];
        for (let t = 0; t <= sMax + 1e-9; t += tStep) ticks.push({ v: t, l: fmt(t, 0) });
        box.querySelector('.line').innerHTML = lineChart([{ pts: pb }, { pts: pa, color: 'var(--ng)', dash: true }], {
          xMin: 0, xMax: sMax, yMin, yMax, yStep: st, yDigits: st < 1 ? 1 : 0, hlines: [{ y: 0, label: 'NPV＝0' }],
          points: [{ x: s0, y: res.stag, color: 'var(--accent)' }, { x: s0, y: res.stat, color: 'var(--ng)' }],
          xTicks: ticks, xLabel: '成功時と失敗時の差（億円）→ 不確実性が大きい', yLabel: '縦軸：NPV（億円）', label: '不確実性とNPVの関係',
        });
        const flip = res.stat < 0 && res.stag >= 0;
        const both = res.stat >= 0 && res.stag >= 0;
        const expandFail = vf - i2 >= s, abandonWin = vs - i2 < s;
        ins.className = 'insight';
        ins.innerHTML = (flip ? `一括投資では NPV ${sgn(res.stat)}億円で<strong>見送り</strong>になる事業が、段階投資にすると ${sgn(res.stag)}億円で<strong>投資すべき</strong>に変わります。`
          : both ? `どちらの進め方でもNPVはプラスです。段階投資の方が ${sgn(res.opt)}億円 有利です。`
          : res.stag < 0 ? `段階投資にしてもNPVはマイナス（${sgn(res.stag)}億円）です。柔軟性があっても、この事業は割に合いません。`
          : `一括投資の方が有利です。`)
          + (expandFail ? ' 失敗しても拡大した方が得な設定なので、撤退の権利はほとんど効いていません（価値は主に拡大投資を1年待つことから生まれています）。'
            : abandonWin ? ' 成功しても拡大が割に合わない設定です。'
            : ` 下のグラフのとおり、期待値が同じでも成功と失敗の差（不確実性）が大きいほど、段階投資の価値は上がり、一括投資は変わりません。`);
      }
      draw();
    },
  };
})();
