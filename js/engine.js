/* ============================================================
 * engine.js — 营养 / 身体数据 / 食谱生成计算引擎
 * 能量系数：碳水 4 kcal/g · 蛋白质 4 kcal/g · 脂肪 9 kcal/g
 * 公式：Mifflin-St Jeor(BMR) · Deurenberg(体脂率估算)
 * 标准：《中国居民膳食指南（2022）》
 * ============================================================ */
(function (global) {
  'use strict';
  var D = global.FITDATA;
  var G = D.GUIDELINES;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function r0(v) { return Math.round(v); }

  /* 每 100g 膳食纤维(g) 估算表（数据未覆盖项用分类默认值） */
  var FIBER = {
    oats:10.6, whole_bread:6.0, rice_brown:1.8, quinoa:2.8, sweet_potato:3.0,
    corn:2.9, potato:1.3, soba:2.0, pasta:4.0, chickpea:7.6,
    broccoli:2.6, spinach:1.7, tomato:0.5, cucumber:0.5, carrot:2.8, lettuce:1.1,
    pepper:1.4, blueberry:2.4, apple:1.5, banana:1.7, orange:1.2, kiwi:2.5,
    fungus:7.0, mushroom:2.3, kelp:0.9, laver:21.6, avocado:6.7,
    mixed_nuts:8.0, walnut:6.7, black_sesame:14.0
  };
  function fiberOf(ing) {
    if (FIBER[ing.id] != null) return FIBER[ing.id];
    if (ing.cat === 'vit' || ing.cat === 'mineral') return 1.0;
    return 0;
  }

  /* ---------------- 身体指标 ---------------- */
  function bmi(p) { return p.weight / Math.pow(p.height / 100, 2); }

  function bodyFat(p) {
    // Deurenberg: BF% = 1.20·BMI + 0.23·年龄 − 10.8·性别(男1) − 5.4
    var sex = p.gender === 'male' ? 1 : 0;
    return clamp(1.20 * bmi(p) + 0.23 * p.age - 10.8 * sex - 5.4, 5, 55);
  }

  function bmr(p) {
    // Mifflin-St Jeor
    var v = 10 * p.weight + 6.25 * p.height - 5 * p.age;
    return p.gender === 'male' ? v + 5 : v - 161;
  }

  function occupation(p) {
    return D.byId(D.OCCUPATIONS, p.occupation) || D.OCCUPATIONS[0];
  }

  function tdee(p) { return bmr(p) * occupation(p).factor; }

  /* 体型估算（cm）：供 3D 模型与围度展示，公式为人群均值近似模型 */
  function measurements(p) {
    var male = p.gender === 'male';
    var H = p.height, f = clamp(bmi(p) / 22, 0.82, 1.35);
    var bf = bodyFat(p) / 100, bfAdj = 1 + (bf - (male ? 0.18 : 0.26)) * 0.55;
    return {
      shoulder:r1((male ? H * 0.238 : H * 0.222) * f),
      chest:   r1((male ? H * 0.515 : H * 0.500) * f * bfAdj),
      waist:   r1((male ? H * 0.420 : H * 0.385) * f * bfAdj),
      hip:     r1((male ? H * 0.415 : H * 0.445) * f * bfAdj),
      thigh:   r1((male ? H * 0.270 : H * 0.262) * f),
      upperArm:r1((male ? H * 0.108 : H * 0.098) * f),
      calf:    r1((male ? H * 0.142 : H * 0.136) * f)
    };
  }

  function primaryGoal(p) {
    if (p.goals && p.goals.fatloss) return 'fatloss';
    if (p.goals && p.goals.muscle) return 'muscle';
    if (p.goals && p.goals.posture) return 'posture';
    return 'keep';
  }

  /* ---------------- 能量与宏量目标 ---------------- */
  function targetKcal(p) {
    var t = tdee(p), goal = primaryGoal(p), floor = G.kcalFloor[p.gender] || 1200;
    if (goal === 'fatloss') return Math.max(floor, r0(t - 400));
    if (goal === 'muscle') return r0(t + 300);
    return r0(t);
  }

  function targetMacros(p) {
    var E = targetKcal(p), goal = primaryGoal(p);
    var Pg = G.proteinFactor[goal] * p.weight;
    var Fg = E * 0.25 / 9;                 // 脂肪供能约 25%
    var Cg = Math.max(0, (E - Pg * 4 - Fg * 9) / 4);
    return {
      kcal:E,
      protein:r1(Pg),
      fat:r1(Fg),
      carbs:r1(Cg),
      fiber:G.fiber_g[0],
      veg:G.veg_g, fruit:G.fruit_g,
      oil:G.oil_g, water:G.water_ml[p.gender] || 1500,
      salt:G.salt_g
    };
  }

  /* 每日热量状态：总消耗 = 基础代谢 + 职业活动 + 刻意运动 */
  function calorieStatus(p, intakeKcal, exerciseKcal) {
    var b = bmr(p), occ = b * (occupation(p).factor - 1), ex = exerciseKcal || 0;
    var burn = b + occ + ex;
    var deficit = burn - intakeKcal;
    var goal = primaryGoal(p);
    var label, ok;
    if (goal === 'fatloss') { ok = deficit >= 250 && deficit <= 600; label = deficit > 0 ? '热量缺口' : '热量盈余'; }
    else if (goal === 'muscle') { ok = deficit <= 0 && deficit >= -450; label = deficit > 0 ? '热量缺口' : '热量盈余'; }
    else { ok = Math.abs(deficit) <= 250; label = '热量平衡'; }
    return { bmr:r0(b), activity:r0(occ), exercise:r0(ex), burn:r0(burn), intake:r0(intakeKcal),
             deficit:r0(deficit), label:label, ok:ok, goal:goal };
  }

  /* ---------------- 食材营养计算（精确到克） ---------------- */
  function nutritionOf(ing, grams) {
    var a = grams / 100;
    return {
      grams:r1(grams),
      kcal:r1(ing.kcal * a),
      p:r1(ing.p * a),
      c:r1(ing.c * a),
      f:r1(ing.f * a),
      fiber:r1(fiberOf(ing) * a),
      cost:Math.round(ing.price * a * 100) / 100
    };
  };
  function sumNutrition(list) {
    var s = { grams:0, kcal:0, p:0, c:0, f:0, fiber:0, cost:0 };
    list.forEach(function (n) { for (var k in s) s[k] += (n[k] || 0); });
    Object.keys(s).forEach(function (k) { s[k] = Math.round(s[k] * 10) / 10; });
    s.cost = Math.round(s.cost * 100) / 100; // 金额单独保留两位小数
    return s;
  }

  /* ---------------- 进度 ---------------- */
  function weightProgress(p) {
    var start = p.startWeight || p.weight;
    var gap = r1(p.weight - p.targetWeight);
    var total = start - p.targetWeight;
    var pct = total !== 0 ? clamp((start - p.weight) / total * 100, 0, 100) : 100;
    return { gap:gap, pct:r1(Math.max(0, pct)), remain:r1(Math.abs(p.weight - p.targetWeight)) };
  }

  /* ---------------- 男性睾酮激素节律 ---------------- */
  // 模型：昼夜节律（晨峰→夜谷，余弦近似）× 周节律（训练刺激后 24-48h 超量恢复）× 晨间状态自评
  function testoAnalysis(tc, todayStr) {
    if (!tc) return null;
    var G = global.FITDATA;
    var peak = null;
    (G.TESTO_PEAKS || []).forEach(function (x) { if (x.id === (tc.peak || 'p2')) peak = x; });
    var mScore = tc.morningScore || 3;
    var trainDays = Math.max(0, Math.min(7, tc.trainDays || 3));
    var peakHour = peak && peak.hours ? (peak.hours[0] + peak.hours[1]) / 2 : 8;
    // 24h 昼夜曲线：峰值=晨峰时刻，谷值=对侧 12h；幅度受晨间自评影响
    var amp = 14 + mScore * 4; // 18–30
    var curve = [];
    for (var h = 0; h < 24; h++) {
      var dh = Math.abs(h - peakHour); if (dh > 12) dh = 24 - dh;
      curve.push(Math.round((68 + amp * Math.cos(dh / 12 * Math.PI)) * 10) / 10);
    }
    // 周节律：以周一为起点，训练日次日出现恢复性小幅抬升
    var weekly = [];
    var wd0 = (new Date(todayStr + 'T00:00:00').getDay() + 6) % 7;
    for (var d = 0; d < 7; d++) {
      var trained = (d * (trainDays || 1)) % 7 < trainDays; // 均匀散布训练日
      weekly.push(Math.round((70 + (trained ? 8 : 0) + mScore * 3) * 10) / 10);
    }
    var nowH = new Date().getHours();
    var nowLevel = curve[nowH];
    var phase = nowH >= peakHour - 1 && nowH < peakHour + 2 ? '晨峰期'
      : nowH >= peakHour + 2 && nowH < 15 ? '日间高位'
      : nowH >= 15 && nowH < 20 ? '午后回落' : '夜间低谷';
    // 综合节律指数（0–100）
    var index = Math.round(nowLevel * 0.6 + weekly[wd0] * 0.4);
    return {
      kind:'testo', phase:phase, index:index, nowLevel:Math.round(nowLevel),
      curve:curve, weekly:weekly, weekDay:wd0,
      peakWindow:peak ? peak.label : '07:00–09:00',
      morningScore:mScore, trainDays:trainDays,
      bestTrainWindow: (phase === '晨峰期' || phase === '日间高位') ? '当前窗口适合安排主项力量训练' : '主项训练建议安排在 ' + (peak ? peak.label : '07:00–09:00') + ' 前后'
    };
  }

  /* ---------------- 女性生理周期 ---------------- */
  function dayDiff(a, b) {
    return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  }
  function addDays(dateStr, n) {
    var d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function cycleAnalysis(cyc, todayStr) {
    if (!cyc || !cyc.lastDate) return null;
    var len = cyc.len || 28, period = cyc.period || 5;
    var diff = dayDiff(cyc.lastDate, todayStr);
    var idx = Math.floor(diff / len);
    var start = addDays(cyc.lastDate, idx * len);
    var day = diff - idx * len + 1;
    var ovDay = len - 14;                       // 排卵日（下次月经前约14天）
    var phase;
    if (day <= period) phase = 'period';
    else if (day < ovDay - 4) phase = 'follicular';
    else if (day <= ovDay + 2) phase = (day === ovDay || day === ovDay - 1) ? 'ovulation' : 'fertile';
    else phase = 'luteal';
    var next = addDays(start, len);
    return {
      day:day, len:len, period:period, phase:phase,
      ovulationDate:addDays(start, ovDay - 1),
      nextDate:next,
      daysToNext:dayDiff(todayStr, next),
      predictions:[next, addDays(next, len), addDays(next, len * 2)]
    };
  }

  /* ---------------- 训练智能推荐 ---------------- */
  function workoutRec(p, h, cyc) {
    var energy = h ? h.energy : 3, sleep = h ? h.sleep : 3;
    var dis = (h && h.discomforts) || [];
    var phase = cyc ? cyc.phase : null;
    var goal = primaryGoal(p);
    var rec = { title:'', minutes:30, items:[], tags:[], reason:'' };

    var sore = dis.indexOf('肌肉酸痛') >= 0, joint = dis.indexOf('关节不适') >= 0 || dis.indexOf('腰部不适') >= 0;
    var cold = dis.indexOf('感冒乏力') >= 0, gut = dis.indexOf('肠胃不适') >= 0;
    var periodPain = dis.indexOf('痛经') >= 0 || phase === 'period';

    if (cold) {
      rec.title = '主动恢复日'; rec.minutes = 15;
      rec.items = ['休息与补水 1500ml+','室内慢走 10 分钟','颈肩轻柔拉伸 5 分钟'];
      rec.reason = '检测到感冒/乏力信号，免疫系统需要能量，今日以恢复为主，避免高强度训练。';
    } else if (periodPain) {
      rec.title = '经期舒缓训练'; rec.minutes = 25;
      rec.items = ['猫牛式 × 10 次','婴儿式保持 60 秒 × 3','仰卧束角式 3 分钟','慢走 15 分钟'];
      rec.tags = ['缓解痛经','低强度'];
      rec.reason = '处于经期/有痛经反馈，避免核心挤压与倒立类动作，选择促进盆腔血液循环的舒缓练习。';
    } else if (sleep <= 2 || energy <= 2) {
      rec.title = '低强度激活'; rec.minutes = 20;
      rec.items = ['关节活动度热身 5 分钟','快走 12 分钟','全身静态拉伸 3 分钟'];
      rec.reason = '睡眠或精力评分偏低，高强度训练会提升皮质醇，今日以唤醒身体为主。';
    } else if (sore || joint) {
      rec.title = '恢复性训练'; rec.minutes = 25;
      rec.items = ['泡沫轴放松紧张肌群 8 分钟','低强度椭圆机/骑行 12 分钟','痛点肌群静态拉伸 5 分钟'];
      rec.tags = dis.indexOf('腰部不适') >= 0 ? ['护腰'] : [];
      rec.reason = '存在肌肉/关节不适反馈，以软组织放松与低冲击有氧促进恢复，避免不适部位负重。';
    } else {
      if (goal === 'fatloss') {
        if (energy >= 4 && sleep >= 4) {
          rec.title = 'HIIT 燃脂训练'; rec.minutes = 35;
          rec.items = ['动态热身 5 分钟','开合跳/高抬腿/波比 30秒×5轮','快走 15 分钟（心率 120-140）','拉伸 5 分钟'];
          rec.tags = ['高消耗','缺口加速'];
          rec.reason = '精力与睡眠状态良好，适合高强度间歇以扩大当日热量缺口（建议 400-500 kcal）。';
        } else {
          rec.title = '稳态有氧'; rec.minutes = 40;
          rec.items = ['慢跑/快走/骑行 35 分钟（心率 115-135）','拉伸 5 分钟'];
          rec.reason = '状态中等，选择中等强度稳态有氧，可持续消耗脂肪且恢复压力小。';
        }
      } else if (goal === 'muscle') {
        var parts = (p.goals && p.goals.muscleParts) || ['全身均衡'];
        rec.title = '力量训练 · ' + parts.join('/'); rec.minutes = 55;
        rec.items = ['热身 8 分钟（目标肌群激活）',
          '主项复合动作 4 组 × 8-10 次（重量 RPE 7-8）',
          '辅助动作 3 组 × 10-12 次 × 2 个动作',
          '目标部位孤立训练 3 组 × 12-15 次','放松拉伸 7 分钟'];
        rec.tags = parts;
        rec.reason = '增肌期配合 +300 kcal 盈余，状态良好时进行大重量容量训练；训练后及时补充碳水+蛋白质。';
      } else if (goal === 'posture') {
        var pp = (p.goals && p.goals.postureParts) || ['圆肩驼背'];
        rec.title = '体态矫正 · ' + pp.join('/'); rec.minutes = 30;
        rec.items = ['筋膜放松紧张侧 5 分钟','薄弱肌群激活 3 组 × 15 次','矫正动作 4 组 × 12 次','日常姿势再教育 3 分钟'];
        rec.tags = pp;
        rec.reason = '体态修正以「放松紧张肌 + 强化薄弱肌 + 动作模式重建」为主，每日规律练习优于突击。';
      } else {
        rec.title = '综合体能维持'; rec.minutes = 35;
        rec.items = ['快走/慢跑 20 分钟','自重力量循环 10 分钟','拉伸 5 分钟'];
        rec.reason = '保持期以维持心肺与肌肉量为目标，运动量与摄入保持动态平衡。';
      }
    }
    return rec;
  }

  /* ---------------- 智能食谱生成 ---------------- */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr, n, filterFn) {
    var pool = arr.filter(filterFn || function () { return true; });
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool.slice(0, n);
  }

  function generateMealPlan(p, seed, budgetCap) {
    var T = targetMacros(p);
    var rng = mulberry32(seed || 1);
    var ING = D.INGREDIENTS;
    var cat = function (c) { return ING.filter(function (x) { return x.cat === c; }); };

    /* 食材选择（预算紧张时优先低价） */
    function choose(c, n, mealTags, cheapBias) {
      var pool = cat(c).filter(function (x) {
        return !mealTags || x.meal.some(function (m) { return mealTags.indexOf(m) >= 0; });
      });
      pool = pool.slice().sort(function (a, b) {
        var sa = a.price * (cheapBias ? 1 : rng()) + rng() * 0.5;
        var sb = b.price * (cheapBias ? 1 : rng()) + rng() * 0.5;
        return sa - sb;
      });
      return pool.slice(0, n);
    }

    var cheap = budgetCap && budgetCap < 45;

    /* 固定结构选品 */
    var bfProtein = pick(rng, choose('protein', 2, ['breakfast'], cheap), 1)[0];
    var lunchProtein = pick(rng, choose('protein', 4, ['lunch'], cheap), 1)[0];
    var dinnerProtein = pick(rng, choose('protein', 4, ['dinner'], cheap).filter(function (x) {
      return x.id !== lunchProtein.id;
    }), 1)[0];
    var bfCarb = pick(rng, choose('carbs', 2, ['breakfast'], cheap), 1)[0];
    var lunchCarb = pick(rng, cat('carbs').filter(function (x) {
      return x.id !== bfCarb.id && (x.tags.indexOf('全谷物') >= 0 || rng() > 0.35);
    }), 1)[0];
    var dinnerCarb = pick(rng, cat('carbs').filter(function (x) {
      return x.id !== lunchCarb.id;
    }), 1)[0];
    var vegPool = pick(rng, cat('vit').filter(function (x) {
      return x.tags.join('').match(/维|叶酸|番茄|胡萝卜|低卡|补水/) &&
             (x.meal.indexOf('lunch') >= 0 || x.meal.indexOf('dinner') >= 0);
    }), 3);
    var fruitPool = pick(rng, cat('vit').filter(function (x) {
      return x.meal.indexOf('snack') >= 0 || x.meal.indexOf('breakfast') >= 0;
    }), 2);
    var mineralItem = pick(rng, cat('mineral').filter(function (x) { return x.price < 3; }), 1)[0];
    var oil = pick(rng, cat('fat').filter(function (x) { return x.kcal > 800; }), 1)[0];
    var snackFat = rng() > 0.4 ? pick(rng, cat('fat').filter(function (x) { return x.kcal < 800; }), 1)[0] : null;

    /* 容器：meals[id] = [{ing, g}] */
    var meals = { breakfast:[], lunch:[], dinner:[], snack:[] };
    function add(id, ing, g) { if (ing && g > 0) meals[id].push({ ing:ing, g:r1(g) }); }

    /* ---- 固定克数：蔬菜 / 水果 / 矿物 ---- */
    add('lunch', vegPool[0], 200);
    add('lunch', vegPool[1] || vegPool[0], 150);
    add('dinner', vegPool[2] || vegPool[0], 200);
    add('lunch', mineralItem, mineralItem.id === 'laver' ? 3 : (mineralItem.id === 'shrimp_skin' ? 5 : 60));
    add('breakfast', fruitPool[0], 150);
    add('snack', fruitPool[1] || fruitPool[0], 120);

    /* ---- 统计固定部分的营养，反推蛋白/碳水/油用量 ---- */
    var fixed = [];
    ['breakfast','lunch','dinner','snack'].forEach(function (id) {
      meals[id].forEach(function (it) { fixed.push(nutritionOf(it.ing, it.g)); });
    });
    var fs = sumNutrition(fixed);

    /* 蛋白质目标剩余量按 早25% / 午45% / 晚30% 分摊到三种蛋白食材 */
    var rp = Math.max(0, T.protein - fs.p);
    var gBfP = rp * 0.25 / (bfProtein.p / 100);
    var gLuP = rp * 0.45 / (lunchProtein.p / 100);
    var gDiP = rp * 0.30 / (dinnerProtein.p / 100);
    // 常识份量约束
    gBfP = clamp(gBfP, bfProtein.id === 'milk' ? 200 : (bfProtein.id === 'greek_yogurt' ? 100 : 40),
                 bfProtein.id === 'milk' ? 300 : (bfProtein.id.indexOf('egg') >= 0 ? 100 : 120));
    gLuP = clamp(gLuP, 80, 220);
    gDiP = clamp(gDiP, 80, 200);
    add('breakfast', bfProtein, gBfP);
    add('lunch', lunchProtein, gLuP);
    add('dinner', dinnerProtein, gDiP);

    /* 碳水剩余量按 早20% / 午45% / 晚35% 分摊主食 */
    var afterP = sumNutrition(collectAll());
    var rc = Math.max(0, T.carbs - afterP.c);
    var gBfC = rc * 0.20 / (bfCarb.c / 100);
    var gLuC = rc * 0.45 / (lunchCarb.c / 100);
    var gDiC = rc * 0.35 / (dinnerCarb.c / 100);
    gBfC = clamp(gBfC, bfCarb.id === 'oats' ? 30 : 60, bfCarb.id === 'oats' ? 60 : 200);
    gLuC = clamp(gLuC, 100, lunchCarb.kcal > 200 ? 180 : 320);
    gDiC = clamp(gDiC, 80, dinnerCarb.kcal > 200 ? 140 : 260);
    add('breakfast', bfCarb, gBfC);
    add('lunch', lunchCarb, gLuC);
    add('dinner', dinnerCarb, gDiC);

    /* 脂肪缺口用烹调油补足（全天油 20-30g 区间），加餐少量坚果 */
    var beforeOil = sumNutrition(collectAll());
    var oilNeed = clamp((T.fat - beforeOil.f) / 0.999, 0, 30);
    var lunchOil = Math.round(oilNeed * 0.6), dinnerOil = Math.round(oilNeed - lunchOil);
    add('lunch', oil, Math.max(8, lunchOil));
    add('dinner', oil, Math.max(7, dinnerOil));
    if (snackFat) add('snack', snackFat, 10);

    /* 能量微调：用主食缩放把总能量拉到目标 ±3% */
    var totals = sumNutrition(collectAll());
    var guard = 0;
    while (Math.abs(totals.kcal - T.kcal) / T.kcal > 0.03 && guard < 6) {
      var dK = T.kcal - totals.kcal;
      var targetIt = dK > 0
        ? meals.lunch.find(function (x) { return x.ing.id === lunchCarb.id; })
        : (meals.snack.find(function (x) { return x.ing.kcal < 120; }) ||
           meals.dinner.find(function (x) { return x.ing.id === dinnerCarb.id; }));
      if (!targetIt) break;
      var dG = clamp(dK / (targetIt.ing.kcal / 100), -40, 40);
      targetIt.g = r1(Math.max(30, targetIt.g + dG));
      totals = sumNutrition(collectAll());
      guard++;
    }

    function collectAll() {
      var a = [];
      ['breakfast','lunch','dinner','snack'].forEach(function (id) {
        meals[id].forEach(function (it) { a.push(nutritionOf(it.ing, it.g)); });
      });
      return a;
    }

    totals = sumNutrition(collectAll());

    /* 营养差距判定（需增加/减少） */
    var gaps = [];
    gap('蛋白质', totals.p, T.protein, 'g', 0.10);
    gap('碳水', totals.c, T.carbs, 'g', 0.06);
    gap('脂肪', totals.f, T.fat, 'g', 0.08);
    var isVeg = function (x) {
      return x.ing.cat === 'vit' && (x.ing.meal.indexOf('lunch') >= 0 || x.ing.meal.indexOf('dinner') >= 0) &&
        x.ing.tags.join('').match(/维|叶酸|番茄|胡萝卜|低卡|补水/);
    };
    var isFruit = function (x) {
      return x.ing.cat === 'vit' && x.ing.tags.join('').match(/钾|果胶|维C|花青素|叶酸/) && !isVeg(x);
    };
    var vegG = meals.lunch.concat(meals.dinner).filter(isVeg).reduce(function (s, x) { return s + x.g; }, 0);
    var fruitG = meals.breakfast.concat(meals.snack).filter(isFruit).reduce(function (s, x) { return s + x.g; }, 0);
    // 蔬菜/水果按膳食指南区间评估：只在低于下限提示补充，略高于上限不作负向警示
    rangeGap('蔬菜', vegG, T.veg, 'g');
    rangeGap('水果', fruitG, T.fruit, 'g');
    fiberGap('膳食纤维', totals.fiber, T.fiber, 'g');
    function gap(name, val, tgt, unit, ratio) {
      var d = Math.round((tgt - val) * 10) / 10;
      if (Math.abs(d) > Math.max(3, tgt * (ratio || 0.06))) {
        gaps.push({ name:name, dir:d > 0 ? '+' : '−', amount:Math.abs(d), unit:unit });
      }
    }
    // 膳食纤维仅在不足时提示（适量偏高有益，不作负向警示）
    function fiberGap(name, val, tgt, unit) {
      var d = Math.round((tgt - val) * 10) / 10;
      if (d > Math.max(2, tgt * 0.12)) gaps.push({ name:name, dir:'+', amount:d, unit:unit });
    }
    function rangeGap(name, val, range, unit) {
      if (val < range[0]) gaps.push({ name:name, dir:'+', amount:r0(range[0] - val), unit:unit });
    }

    return {
      seed:seed,
      meals:meals,
      totals:totals,
      targets:T,
      gaps:gaps,
      vegG:r0(vegG),
      fruitG:r0(fruitG),
      overBudget:budgetCap ? totals.cost > budgetCap : false,
      budgetCap:budgetCap || null
    };
  }

  /* 在预算内多轮尝试取最优方案 */
  function bestMealPlan(p, budgetCap) {
    var best = null;
    for (var s = 1; s <= 10; s++) {
      var plan = generateMealPlan(p, s * 7919 + 13, budgetCap);
      var score = 0;
      score += Math.abs(plan.totals.kcal - plan.targets.kcal);
      score += Math.abs(plan.totals.p - plan.targets.protein) * 4;
      score += plan.overBudget ? 400 : 0;
      if (!best || score < best._score) { plan._score = score; best = plan; }
      if (!plan.overBudget && Math.abs(plan.totals.kcal - plan.targets.kcal) < 60) break;
    }
    best._score = undefined;
    if (best.overBudget) best.suggestBudget = Math.ceil(best.totals.cost / 5) * 5;
    return best;
  }

  /* 替代食材：同分类、营养密度相近 */
  function alternatives(ing) {
    return D.INGREDIENTS.filter(function (x) {
      return x.cat === ing.cat && x.id !== ing.id;
    }).sort(function (a, b) {
      var da = Math.abs(a.kcal - ing.kcal) + Math.abs(a.p - ing.p) * 3;
      var db = Math.abs(b.kcal - ing.kcal) + Math.abs(b.p - ing.p) * 3;
      return da - db;
    }).slice(0, 6);
  }

  global.FITENGINE = {
    bmi:bmi, bodyFat:bodyFat, bmr:bmr, tdee:tdee, occupation:occupation,
    measurements:measurements, primaryGoal:primaryGoal,
    targetKcal:targetKcal, targetMacros:targetMacros, calorieStatus:calorieStatus,
    nutritionOf:nutritionOf, sumNutrition:sumNutrition, weightProgress:weightProgress,
    cycleAnalysis:cycleAnalysis, testoAnalysis:testoAnalysis, addDays:addDays, dayDiff:dayDiff,
    workoutRec:workoutRec, generateMealPlan:generateMealPlan, bestMealPlan:bestMealPlan,
    alternatives:alternatives, fiberOf:fiberOf,
    clamp:clamp, r1:r1, r0:r0
  };
})(window);
