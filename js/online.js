/* ============================================================
 * online.js — 联网数据接口（OpenFoodFacts 权威营养数据库）
 * - 实时拉取食物热量/三大营养素（每 100g 口径）
 * - 超时/离线自动回退本地食物库，UI 标注数据来源
 * ============================================================ */
(function (global) {
  'use strict';

  var OFF_SEARCH = 'https://world.openfoodfacts.org/cgi/search.pl';
  var TIMEOUT = 6000;
  var cache = {}; // query -> {ts, items}
  var CACHE_TTL = 30 * 60 * 1000; // 30 分钟

  function online() { return navigator.onLine !== false; }

  function fetchJson(url) {
    return new Promise(function (resolve, reject) {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); reject(new Error('timeout')); }, TIMEOUT);
      fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      }).then(function (j) { clearTimeout(timer); resolve(j); })
        .catch(function (e) { clearTimeout(timer); reject(e); });
    });
  }

  function toFood(p) {
    var n = p.nutriments || {};
    var kcal = n['energy-kcal_100g'];
    if (kcal == null && n['energy-kj_100g'] != null) kcal = n['energy-kj_100g'] / 4.184;
    if (kcal == null || !p.product_name) return null;
    return {
      id:'off_' + (p.code || p.product_name),
      name:String(p.product_name).slice(0, 40),
      kcal:Math.round(kcal),
      p:Math.round((n.proteins_100g || 0) * 10) / 10,
      c:Math.round((n.carbohydrates_100g || 0) * 10) / 10,
      f:Math.round((n.fat_100g || 0) * 10) / 10,
      std:100, source:'online'
    };
  }

  /* 搜索食物（联网）。resolve(null) 表示不可用（离线/超时/无结果），调用方回退本地库 */
  function searchFood(q) {
    if (!q || !online()) return Promise.resolve(null);
    if (cache[q] && Date.now() - cache[q].ts < CACHE_TTL) return Promise.resolve(cache[q].items);
    var url = OFF_SEARCH + '?search_terms=' + encodeURIComponent(q) +
      '&search_simple=1&action=process&json=1&page_size=12&lc=zh' +
      '&fields=code,product_name,nutriments';
    return fetchJson(url).then(function (j) {
      var items = (j.products || []).map(toFood).filter(Boolean).slice(0, 10);
      cache[q] = { ts:Date.now(), items:items };
      return items;
    }).catch(function () { return null; });
  }

  /* 单食物热量校准：返回 {kcal,p,c,f} 每 100g 或 null */
  function lookupKcal(name) {
    return searchFood(name).then(function (items) {
      return items && items.length ? items[0] : null;
    });
  }

  global.FITONLINE = {
    online:online,
    searchFood:searchFood,
    lookupKcal:lookupKcal,
    sourceName:'OpenFoodFacts 全球食物营养数据库'
  };
})(window);
