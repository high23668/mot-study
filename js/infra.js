// インフラ層：学習記録の保存先（ブラウザの localStorage）。保存方法を変えるときはここだけ差し替える。
(function () {
  'use strict';
  const MoT = (window.MoT = window.MoT || {});
  const KEY = 'mot-study-v1'; // 既存の記録を引き継ぐため、キー名は変えない

  MoT.LocalStorageRepo = {
    load() { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
    save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} },
  };

  // セルフテスト用：何も保存しない保存先
  MoT.MemoryRepo = { load() { return { cards: {} }; }, save() {} };
})();
