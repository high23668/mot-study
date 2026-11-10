// B章のシミュレーター：ROEのデュポン分解 / ROICツリーとEVA
(function () {
  'use strict';
  const { fmt, pct, md, slider, kpis, barChart, lineChart, legend } = MoT.View;
  const sgn = v => (v >= 0 ? '+' : '') + fmt(v, 2);

  SIMS.dupont = {
    title: 'ROEのデュポン分解シミュレーター',
    desc: '売上高純利益率・総資産回転率・財務レバレッジを動かして、ROEがどう変わるかを見る。株主資本コストと比べ、レバレッジで上げたROEが業績の振れにどれだけ弱いかも確かめよう。初期値はミナト精機。',
    render(box) {
      box.innerHTML = `<div class="sim-grid"><div class="ctls"></div><div><div class="kpis"></div><div class="formula md"></div><div class="chart"></div>
        ${legend([['var(--accent)', 'レバレッジを変えたときのROE（利益率・回転率は今のまま）'], ['var(--muted)', '株主資本コスト']])}<div class="insight"></div></div></div>`;
      const c = box.querySelector('.ctls');
      const g = {
        m: slider(c, { key: 'm', label: '売上高純利益率', min: -5, max: 15, step: 0.25, value: 5, show: v => fmt(v, 2) + '%' }, draw),
        t: slider(c, { key: 't', label: '総資産回転率', min: 0.4, max: 2, step: 0.05, value: 0.8, show: v => fmt(v, 2) + '回' }, draw),
        l: slider(c, { key: 'l', label: '財務レバレッジ（総資産÷自己資本）', min: 1, max: 5, step: 0.01, value: 1.67, show: v => fmt(v, 2) + '倍' }, draw),
        re: slider(c, { key: 're', label: '株主資本コスト r_e', min: 6, max: 14, step: 0.25, value: 10.75, show: v => fmt(v, 2) + '%' }, draw),
      };
      function draw() {
        const m = g.m(), t = g.t(), l = g.l(), re = g.re();
        const roa = m * t, roe = roa * l, gap = roe - re, drop = t * l;
        box.querySelector('.formula').innerHTML = md(`$$ROE = ${fmt(m, 2)}\\% \\times ${fmt(t, 2)} \\times ${fmt(l, 2)} = ${fmt(roe, 2)}\\%$$`);
        box.querySelector('.kpis').innerHTML = kpis([
          { k: 'ROE', v: fmt(roe, 2) + '%', tone: roe >= re ? 'ok' : 'ng' },
          { k: 'ROE − 株主資本コスト', v: sgn(gap) + '%', tone: gap >= 0 ? 'ok' : 'ng' },
          { k: 'ROA（＝利益率×回転率）', v: fmt(roa, 2) + '%' },
          { k: '自己資本比率', v: fmt(100 / l, 0) + '%', tone: l > 3 ? 'ng' : '' },
        ]);
        const pts = [];
        for (let x = 1; x <= 5.0001; x += 0.05) pts.push([x, roa * x]);
        const ys = pts.map(p => p[1]).concat([re, roe, 0]);
        const yMax = Math.ceil(Math.max(...ys) / 5) * 5 || 5, yMin = Math.floor(Math.min(...ys) / 5) * 5;
        box.querySelector('.chart').innerHTML = lineChart([{ pts }], {
          xMin: 1, xMax: 5, yMin, yMax: yMax > yMin ? yMax : yMin + 5, yStep: 5, yDigits: 0, hlines: [{ y: re, label: '株主資本コスト ' + fmt(re, 2) + '%' }],
          points: [{ x: l, y: roe }], xTicks: [1, 2, 3, 4, 5].map(v => ({ v, l: v + '倍' })),
          xLabel: '財務レバレッジ →', yLabel: '縦軸：ROE（%）', label: '財務レバレッジとROEの関係',
        });
        const ins = box.querySelector('.insight');
        ins.className = 'insight';
        if (roa <= 0) {
          ins.className = 'insight warn';
          ins.innerHTML = `ROAが${fmt(roa, 2)}%と、資産でもうけを出せていません。この状態でレバレッジを上げると、<strong>ROEのマイナスが${fmt(l, 2)}倍に拡大</strong>します。まず利益率か回転率の改善が必要です。`;
          return;
        }
        const needM = re / (t * l), needL = re / roa;
        const lev = l > 3 ? `<br>ただし自己資本比率は${fmt(100 / l, 0)}%と薄く、純利益率が1ポイント下がるだけでROEは<strong>${fmt(drop, 2)}ポイント</strong>落ちます。<strong>レバレッジで作ったROEは、リスクの裏返し</strong>です（株主資本コストも上がりやすい）。`
          : `<br>純利益率が1ポイント下がると、ROEは${fmt(drop, 2)}ポイント（＝回転率×レバレッジ）落ちます。レバレッジを上げるほど、この落ち込みは大きくなります。`;
        ins.innerHTML = gap >= 0
          ? `ROEが株主資本コストを${fmt(gap, 2)}ポイント上回っています（PBR > 1 の条件：D5）。${lev}`
          : `ROEが株主資本コストに${fmt(-gap, 2)}ポイント足りません。今の回転率とレバレッジのままなら純利益率を<strong>${fmt(needM, 2)}%</strong>に、利益率と回転率のままならレバレッジを<strong>${fmt(needL, 2)}倍</strong>（自己資本比率${fmt(100 / needL, 0)}%）にする必要があります。${lev}`;
      }
      draw();
    },
  };

  SIMS.roicTree = {
    title: 'ROICツリー・EVAシミュレーター',
    desc: '原価率・販管費率・在庫日数・設備（有形固定資産）・売上高を動かして、ROICとEVAがどう変わるかを見る。「利益率を上げる」「在庫を減らす」「設備を減らす」「稼働率を上げて売上を増やす」のどれが効くかを比べよう。在庫削減や設備売却で浮いた現金は有利子負債の返済に充てる（投下資本が減る）と仮定。日数は売上高基準（A章は売上原価基準）。初期値はミナト精機。',
    render(box) {
      box.innerHTML = `<div class="sim-grid"><div class="ctls"></div><div><div class="kpis"></div><div class="tree"></div>
        <h3>今の設定から1つだけ改善したときのROICの増分（ポイント）</h3><div class="chart"></div><div class="insight"></div></div></div>`;
      const c = box.querySelector('.ctls');
      const g = {
        s: slider(c, { key: 's', label: '売上高（同じ設備で稼働率を上げる）', min: 1500, max: 2600, step: 50, value: 2000, show: v => v.toLocaleString() + '億円' }, draw),
        cr: slider(c, { key: 'cr', label: '原価率', min: 60, max: 90, step: 0.5, value: 75, show: pct }, draw),
        sg: slider(c, { key: 'sg', label: '販管費率', min: 10, max: 25, step: 0.5, value: 17.5, show: pct }, draw),
        tx: slider(c, { key: 'tx', label: '税率', min: 20, max: 40, step: 1, value: 30, show: v => v + '%' }, draw),
        inv: slider(c, { key: 'inv', label: '在庫日数（売上高基準）', min: 20, max: 120, step: 1, value: 64, show: v => v + '日' }, draw),
        fa: slider(c, { key: 'fa', label: '有形固定資産（設備）', min: 800, max: 2000, step: 50, value: 1400, show: v => v.toLocaleString() + '億円' }, draw),
        w: slider(c, { key: 'w', label: 'WACC', min: 5, max: 10, step: 0.1, value: 7.9, show: pct }, draw),
      };
      // 売上債権73日・仕入債務54.75日（売上高基準）、その他（その他の資産−その他の負債＋現預金）150は固定
      const AR = 73, AP = 54.75, OTHER = 150;
      function calc(p) {
        const opm = (100 - p.cr - p.sg) / 100, nopat = p.s * opm * (1 - p.tx / 100);
        const ar = p.s * AR / 365, inv = p.s * p.inv / 365, ap = p.s * AP / 365, nwc = ar + inv - ap;
        const ic = nwc + p.fa + OTHER, roic = nopat / ic * 100;
        return { opm, nopat, ar, inv, ap, nwc, ic, roic, nm: nopat / p.s * 100, turn: p.s / ic, eva: ic * (roic - p.w) / 100 };
      }
      const node = (n, s, hl) => `<div class="node ${hl ? 'hl' : ''}">${n}<small>${s}</small></div>`;
      function draw() {
        const p = { s: g.s(), cr: g.cr(), sg: g.sg(), tx: g.tx(), inv: g.inv(), fa: g.fa(), w: g.w() };
        const r = calc(p);
        box.querySelector('.kpis').innerHTML = kpis([
          { k: 'ROIC', v: fmt(r.roic, 2) + '%', tone: r.roic >= p.w ? 'ok' : 'ng' },
          { k: 'ROIC − WACC', v: sgn(r.roic - p.w) + '%', tone: r.roic >= p.w ? 'ok' : 'ng' },
          { k: 'EVA', v: `${fmt(r.eva, 0)}<span class="small"> 億円</span>`, tone: r.eva >= 0 ? 'ok' : 'ng' },
          { k: '投下資本', v: `${fmt(r.ic, 0)}<span class="small"> 億円</span>` },
        ]);
        box.querySelector('.tree').innerHTML = `<div class="flow" style="margin:10px 0">
          <div class="flow-row">${node('ROIC ' + fmt(r.roic, 2) + '%', 'NOPAT ' + fmt(r.nopat, 1) + ' ÷ 投下資本 ' + fmt(r.ic, 0), true)}<span class="muted">＝</span>
            ${node('税引後営業利益率 ' + fmt(r.nm, 2) + '%', '営業利益率 ' + fmt(r.opm * 100, 1) + '% ×（1−税率' + p.tx + '%）', true)}<span class="muted">×</span>
            ${node('投下資本回転率 ' + fmt(r.turn, 2) + '回', '売上高 ' + p.s.toLocaleString() + ' ÷ 投下資本', true)}</div>
          <div class="flow-row"><span class="arrow">利益率の枝</span>${node('原価率 ' + fmt(p.cr, 1) + '%', '歩留まり・材料・加工時間')}${node('販管費率 ' + fmt(p.sg, 1) + '%', '物流・間接工数')}</div>
          <div class="flow-row"><span class="arrow">回転率の枝</span>${node('正味運転資本 ' + fmt(r.nwc, 0), '売上債権' + fmt(r.ar, 0) + '＋在庫' + fmt(r.inv, 0) + '（' + p.inv + '日）−仕入債務' + fmt(r.ap, 0))}${node('有形固定資産 ' + p.fa.toLocaleString(), '回転率 ' + fmt(p.s / p.fa, 2) + '回（稼働率）')}${node('その他 150', '固定')}</div></div>`;
        // 1つだけ改善したときの効果
        const levers = [
          ['原価率−1pt', Object.assign({}, p, { cr: p.cr - 1 })],
          ['販管費率−1pt', Object.assign({}, p, { sg: p.sg - 1 })],
          ['在庫−10日', Object.assign({}, p, { inv: Math.max(0, p.inv - 10) })],
          ['設備−100億', Object.assign({}, p, { fa: p.fa - 100 })],
          ['売上+5%', Object.assign({}, p, { s: p.s * 1.05 })],
        ].map(([l, q]) => ({ l, v: calc(q).roic - r.roic }));
        const top = Math.max(...levers.map(b => b.v)), bests = levers.filter(b => b.v >= top - 1e-9), best = bests[0];
        // 棒の上の数値が切れないよう、上に余白を足す
        box.querySelector('.chart').innerHTML = barChart(levers.map(b => ({ l: b.l, v: b.v, c: bests.includes(b) ? 'var(--ok)' : 'var(--accent)' })),
          { digits: 2, unit: '単位：ポイント。削減分は有利子負債の返済に充てると仮定。売上+5%は原価率・販管費率とも据え置き', label: '改善策ごとのROICの増分' })
          .replace(/viewBox="0 0 (\d+) (\d+)"/, (m, w, h) => `viewBox="0 -16 ${w} ${+h + 16}"`);
        const ins = box.querySelector('.insight');
        ins.className = 'insight';
        if (r.nopat <= 0) {
          ins.className = 'insight warn';
          ins.innerHTML = `営業利益がマイナス（営業利益率${fmt(r.opm * 100, 1)}%）です。ROICもマイナスになり、在庫や設備を減らしても赤字は解消しません。まず原価率・販管費率の改善が必要です。`;
          return;
        }
        // 原価率1ptの改善と同じ効果を持つ在庫削減の日数
        const n1 = calc(Object.assign({}, p, { cr: p.cr - 1 })).nopat, dIc = r.ic * (1 - r.nopat / n1), days = dIc / (p.s / 365);
        const need = p.w / 100 * r.ic / (p.s * (1 - p.tx / 100)) * 100;
        ins.innerHTML = `いちばん効くのは<strong>「${bests.map(b => b.l).join('」「')}」</strong>（＋${fmt(best.v, 2)}ポイント）。原価率1ポイントの改善は、在庫を約${fmt(days, 0)}日分（売上高基準、約${fmt(dIc, 0)}億円）減らして有利子負債を返すのと同じ効果です。`
          + (r.roic >= p.w ? `<br>ROICがWACCを上回り、EVAは＋${fmt(r.eva, 0)}億円。資本コストを払っても価値が残っています。`
            : `<br>ROICはWACCに${fmt(p.w - r.roic, 2)}ポイント足りず、EVAは${fmt(r.eva, 0)}億円。今の投下資本のままなら、営業利益率を<strong>${fmt(need, 1)}%</strong>（今は${fmt(r.opm * 100, 1)}%）にする必要があります。`);
      }
      draw();
    },
  };
})();
