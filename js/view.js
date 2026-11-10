// 表示の共通部品：ミニMarkdown＋数式、数値の書式、スライダー、グラフ（SVG）、コピー・ダウンロード。
(function () {
  'use strict';
  const MoT = (window.MoT = window.MoT || {});

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function tex(t, display) {
    if (window.katex) { try { return katex.renderToString(t, { displayMode: display, throwOnError: false, strict: 'ignore' }); } catch (e) {} }
    return `<span class="tex-fallback">${esc(t)}</span>`;
  }
  const inl = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');

  // ミニMarkdown：段落 / - 箇条書き / 1. 番号付き / | 表 / > 補足 / **太字** / $数式$ / $$数式$$
  function md(src) {
    if (!src) return '';
    const maths = [];
    const s = String(src)
      .replace(/\$\$([\s\S]+?)\$\$/g, (m, t) => { maths.push([t, true]); return `\u0000${maths.length - 1}\u0000`; })
      .replace(/\$([^$\n]+?)\$/g, (m, t) => { maths.push([t, false]); return `\u0000${maths.length - 1}\u0000`; });
    const lines = esc(s).split('\n');
    const kind = l => /^\s*$/.test(l) ? 'blank' : /^\s*- /.test(l) ? 'ul' : /^\s*\d+\. /.test(l) ? 'ol' : /^\s*\|/.test(l) ? 'table' : /^\s*&gt; ?/.test(l) ? 'quote' : 'p';
    const out = []; let i = 0;
    while (i < lines.length) {
      const k = kind(lines[i]); const grp = [];
      while (i < lines.length && kind(lines[i]) === k) grp.push(lines[i++]);
      if (k === 'blank') continue;
      if (k === 'ul') out.push('<ul>' + grp.map(l => '<li>' + inl(l.replace(/^\s*- /, '')) + '</li>').join('') + '</ul>');
      else if (k === 'ol') out.push('<ol>' + grp.map(l => '<li>' + inl(l.replace(/^\s*\d+\. /, '')) + '</li>').join('') + '</ol>');
      else if (k === 'quote') out.push('<div class="note">' + grp.map(l => inl(l.replace(/^\s*&gt; ?/, ''))).join('<br>') + '</div>');
      else if (k === 'table') {
        const rows = grp.filter(l => !/^\s*\|?\s*:?-{2,}/.test(l)).map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => inl(c.trim())));
        out.push('<table><thead><tr>' + rows[0].map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
          rows.slice(1).map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
      } else out.push('<p>' + grp.map(l => inl(l.trim())).join('<br>') + '</p>');
    }
    return out.join('').replace(/\u0000(\d+)\u0000/g, (m, n) => tex(maths[n][0], maths[n][1]));
  }
  const mdInline = src => md(src).replace(/^<p>|<\/p>$/g, '');

  const fmt = (x, d = 1) => Number(x).toLocaleString('ja-JP', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = v => fmt(v, 1) + '%';
  const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);

  function toast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 1600); }
  function copy(text) {
    const done = () => toast('コピーしました');
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('コピーできませんでした'); } ta.remove(); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function download(name, text, type = 'text/markdown;charset=utf-8') {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // スライダー：o = {key, label, min, max, step, value, show(v)}。戻り値は現在値を返す関数。
  let sliderSeq = 0;
  function slider(box, o, onInput) {
    const id = 'sl-' + o.key + '-' + (++sliderSeq);
    const div = document.createElement('div'); div.className = 'ctl';
    div.innerHTML = `<label for="${id}"><span>${o.label}</span><output>${o.show(o.value)}</output></label><input type="range" id="${id}" min="${o.min}" max="${o.max}" step="${o.step}" value="${o.value}">`;
    box.appendChild(div);
    const inp = div.querySelector('input'), out = div.querySelector('output');
    inp.addEventListener('input', () => { out.textContent = o.show(+inp.value); onInput(); });
    return () => +inp.value;
  }
  // KPIタイル：items = [{k: 見出し, v: 値（HTML可）, tone: 'ok'|'ng'|''}]
  const kpis = items => items.map(it => `<div class="kpi ${it.tone || ''}"><div class="k">${it.k}</div><div class="v">${it.v}</div></div>`).join('');

  // 棒グラフ：bars = [{l: ラベル, v: 値, c: 色（CSS変数）}]、負の値も可
  function barChart(bars, opt = {}) {
    const W = 560, H = 200, pad = 26, bw = (W - pad) / bars.length;
    const max = Math.max(0, ...bars.map(b => b.v)), min = Math.min(0, ...bars.map(b => b.v));
    const span = (max - min) || 1, Y = v => 20 + (max - v) / span * (H - 34); // 上下に数値ラベルの余白を取る
    return `<svg viewBox="0 0 ${W} ${H + 34}" role="img" aria-label="${esc(opt.label || '棒グラフ')}">
      <line x1="${pad}" y1="${Y(0)}" x2="${W}" y2="${Y(0)}" stroke="var(--border)"/>
      ${bars.map((b, i) => { const x = pad + i * bw + bw * 0.15, y0 = Y(0), y1 = Y(b.v); const top = Math.min(y0, y1), hgt = Math.max(1, Math.abs(y1 - y0));
        return `<rect x="${x}" y="${top}" width="${bw * 0.7}" height="${hgt}" rx="3" fill="${b.c || 'var(--accent)'}"/>
        <text x="${x + bw * 0.35}" y="${b.v >= 0 ? top - 4 : top + hgt + 12}" text-anchor="middle">${fmt(b.v, opt.digits ?? 0)}</text>
        <text x="${x + bw * 0.35}" y="${H + 16}" text-anchor="middle">${esc(b.l)}</text>`; }).join('')}
      ${opt.unit ? `<text x="${pad}" y="${H + 32}">${esc(opt.unit)}</text>` : ''}</svg>`;
  }
  // 折れ線グラフ：series = [{pts: [[x,y],...], color, dash}]、opt = {xMin,xMax,yMin,yMax,xTicks:[{v,l}],yStep,hlines:[{y,label}],points:[{x,y,color}],xLabel,yLabel}
  function lineChart(series, opt) {
    const W = 560, H = 190, L = 40, R = 10;
    const X = x => L + (x - opt.xMin) / (opt.xMax - opt.xMin) * (W - L - R);
    const Y = y => H - (y - opt.yMin) / (opt.yMax - opt.yMin) * (H - 10);
    const clip = y => Math.max(opt.yMin, Math.min(opt.yMax, y));
    const yt = []; const st = opt.yStep || (opt.yMax - opt.yMin) / 4;
    for (let t = Math.ceil(opt.yMin / st) * st; t <= opt.yMax + 1e-9; t += st) yt.push(t);
    return `<svg viewBox="0 0 ${W} ${H + 34}" role="img" aria-label="${esc(opt.label || '折れ線グラフ')}">
      ${yt.map(t => `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--border)" stroke-width="${Math.abs(t) < 1e-9 ? 1 : 0.5}"/><text x="${L - 6}" y="${Y(t) + 4}" text-anchor="end">${fmt(t, opt.yDigits ?? 1)}</text>`).join('')}
      ${(opt.hlines || []).map(hl => `<line x1="${L}" x2="${W - R}" y1="${Y(hl.y)}" y2="${Y(hl.y)}" stroke="var(--muted)" stroke-dasharray="5 4"/>${hl.label ? `<text x="${W - R}" y="${Y(hl.y) - 4}" text-anchor="end">${esc(hl.label)}</text>` : ''}`).join('')}
      ${series.map(s => s.pts.length > 1 ? `<polyline fill="none" stroke="${s.color || 'var(--accent)'}" stroke-width="2.5" ${s.dash ? 'stroke-dasharray="6 4"' : ''} points="${s.pts.map(p => X(p[0]) + ',' + Y(clip(p[1]))).join(' ')}"/>` : '').join('')}
      ${(opt.points || []).map(p => `<circle cx="${X(p.x)}" cy="${Y(clip(p.y))}" r="5" fill="${p.color || 'var(--accent)'}" stroke="var(--surface)" stroke-width="2"/>`).join('')}
      ${(opt.xTicks || []).map(t => `<text x="${X(t.v)}" y="${H + 16}" text-anchor="middle">${esc(t.l)}</text>`).join('')}
      ${opt.xLabel ? `<text x="${W - R}" y="${H + 32}" text-anchor="end">${esc(opt.xLabel)}</text>` : ''}${opt.yLabel ? `<text x="${L}" y="${H + 32}">${esc(opt.yLabel)}</text>` : ''}</svg>`;
  }
  const legend = items => `<div class="legend">${items.map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>`;

  MoT.View = { esc, tex, md, mdInline, fmt, pct, stars, toast, copy, download, slider, kpis, barChart, lineChart, legend };
  window.SIMS = window.SIMS || {}; // シミュレーターの登録先（js/sims/sim-*.js が追加する）
})();
