/* ============================================================
 * store.js — 本地状态管理（localStorage，数据不出本机）
 * ============================================================ */
(function (global) {
  'use strict';
  var KEY = 'mondriaan_fuel_v1';

  var state = {
    profile:null,
    diet:{},
    exercise:{ connected:null, days:{} },
    health:{},
    budget:{ daily:45, weekly:300 },
    pantry:[],
    plans:{},
    weightLog:[],
    onboarded:false
  };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        Object.keys(state).forEach(function (k) {
          if (parsed[k] !== undefined) state[k] = parsed[k];
        });
      }
    } catch (e) { /* 损坏则重置 */ }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('存储失败（可能空间不足）', e); }
  }

  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDaysKey(key, n) {
    var d = new Date(key + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return todayKey(d);
  }

  /* ---------------- 个人资料 ---------------- */
  function setProfile(p) {
    var prev = state.profile;
    state.profile = p;
    state.onboarded = true;
    // 记录体重曲线
    var tk = todayKey();
    if (!prev) {
      state.weightLog = [{ date:tk, weight:p.weight }];
      p.startWeight = p.startWeight || p.weight;
    } else if (!prev.weightLog) {
      // 兼容
    }
    var last = state.weightLog[state.weightLog.length - 1];
    if (!last || last.date !== tk) state.weightLog.push({ date:tk, weight:p.weight });
    else last.weight = p.weight;
    save();
  }
  function logWeight(weight) {
    var tk = todayKey();
    var last = state.weightLog[state.weightLog.length - 1];
    if (last && last.date === tk) last.weight = weight;
    else state.weightLog.push({ date:tk, weight:weight });
    save();
  }
  function resetAll() {
    localStorage.removeItem(KEY);
    state = { profile:null, diet:{}, exercise:{connected:null,days:{}}, health:{},
      budget:{daily:45,weekly:300}, pantry:[], plans:{}, weightLog:[], onboarded:false };
  }

  /* ---------------- 饮食打卡 ---------------- */
  function ensureDietDay(key) {
    key = key || todayKey();
    if (!state.diet[key]) state.diet[key] = { breakfast:[], lunch:[], dinner:[], snack:[] };
    return state.diet[key];
  }
  function addFood(meal, entry, key) {
    var day = ensureDietDay(key);
    if (!day[meal]) day[meal] = [];
    entry.uid = Date.now() + '' + Math.floor(Math.random() * 999);
    day[meal].push(entry);
    save();
  }
  function removeFood(uid, key) {
    var day = ensureDietDay(key);
    ['breakfast','lunch','dinner','snack'].forEach(function (m) {
      day[m] = day[m].filter(function (x) { return x.uid !== uid; });
    });
    save();
  }
  function dayIntake(key) {
    var day = state.diet[key || todayKey()] || { breakfast:[], lunch:[], dinner:[], snack:[] };
    var s = { kcal:0, p:0, c:0, f:0, count:0 };
    ['breakfast','lunch','dinner','snack'].forEach(function (m) {
      (day[m] || []).forEach(function (e) {
        s.kcal += e.kcal || 0; s.p += e.p || 0; s.c += e.c || 0; s.f += e.f || 0; s.count++;
      });
    });
    s.kcal = Math.round(s.kcal);
    ['p','c','f'].forEach(function (k) { s[k] = Math.round(s[k] * 10) / 10; });
    return s;
  }

  /* ---------------- 健康日志 ---------------- */
  function getHealth(key) { return state.health[key || todayKey()] || null; }
  function setHealth(h, key) { state.health[key || todayKey()] = h; save(); }
  function recentHealth(n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var k = addDaysKey(todayKey(), -i);
      out.push({ date:k, data:state.health[k] || null });
    }
    return out;
  }

  /* ---------------- 运动手表 ---------------- */
  var BRANDS = [
    { id:'apple', name:'Apple Watch', mark:'', color:'#111' },
    { id:'garmin', name:'Garmin', mark:'G', color:'1E4E9C' },
    { id:'fitbit', name:'Fitbit', mark:'F', color:'#3DB7E4' },
    { id:'huawei', name:'HUAWEI WATCH', mark:'H', color:'1E4E9C' },
    { id:'xiaomi', name:'小米手环', mark:'MI', color:'1E4E9C' }
  ];
  function connectWatch(brand) {
    state.exercise.connected = { id:brand.id, name:brand.name, since:todayKey() };
    save();
  }
  function disconnectWatch() { state.exercise.connected = null; save(); }

  /* 依据日期生成稳定的当日同步数据（无真实授权时的演示数据） */
  function syncedExercise(key) {
    key = key || todayKey();
    if (!state.exercise.connected) return null;
    if (state.exercise.days[key]) return state.exercise.days[key];
    var seed = 0;
    for (var i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) % 9973;
    var rnd = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    var data = {
      steps:Math.round(5200 + rnd() * 7200),
      minutes:Math.round(22 + rnd() * 55),
      kcal:Math.round(180 + rnd() * 460),
      standHours:8 + Math.floor(rnd() * 5),
      syncedAt:new Date().toISOString()
    };
    state.exercise.days[key] = data;
    save();
    return data;
  }
  function weekExercise() {
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var k = addDaysKey(todayKey(), -i);
      out.push({ date:k, data:state.exercise.connected ? syncedExercise(k) : null });
    }
    return out;
  }

  /* ---------------- 预算 ---------------- */
  function setBudget(daily, weekly) {
    state.budget.daily = Number(daily) || 0;
    state.budget.weekly = Number(weekly) || state.budget.daily * 7;
    save();
  }

  /* ---------------- 自选食材篮 ---------------- */
  function pantryAdd(id, g) {
    var ex = state.pantry.find(function (x) { return x.id === id; });
    if (ex) ex.g = Number(ex.g) + Number(g);
    else state.pantry.push({ id:id, g:Number(g) });
    save();
  }
  function pantrySet(id, g) {
    var ex = state.pantry.find(function (x) { return x.id === id; });
    if (ex) { if (g <= 0) state.pantry = state.pantry.filter(function (x) { return x.id !== id; }); else ex.g = Number(g); }
    else if (g > 0) state.pantry.push({ id:id, g:Number(g) });
    save();
  }
  function pantryClear() { state.pantry = []; save(); }
  function pantryTotals() {
    var E = global.FITENGINE, D = global.FITDATA;
    var list = state.pantry.map(function (x) {
      var ing = D.byId(D.INGREDIENTS, x.id);
      return ing ? E.nutritionOf(ing, x.g) : null;
    }).filter(Boolean);
    return E.sumNutrition(list);
  }

  /* ---------------- 食谱计划 ---------------- */
  function savePlan(dateStr, plan) { state.plans[dateStr] = plan; save(); }
  function getPlan(dateStr) { return state.plans[dateStr] || null; }

  global.FITSTORE = {
    state:state,
    save:save, load:load,
    todayKey:todayKey, addDaysKey:addDaysKey,
    setProfile:setProfile, logWeight:logWeight, resetAll:resetAll,
    ensureDietDay:ensureDietDay, addFood:addFood, removeFood:removeFood, dayIntake:dayIntake,
    getHealth:getHealth, setHealth:setHealth, recentHealth:recentHealth,
    BRANDS:BRANDS, connectWatch:connectWatch, disconnectWatch:disconnectWatch,
    syncedExercise:syncedExercise, weekExercise:weekExercise,
    setBudget:setBudget,
    pantryAdd:pantryAdd, pantrySet:pantrySet, pantryClear:pantryClear, pantryTotals:pantryTotals,
    savePlan:savePlan, getPlan:getPlan
  };
})(window);
