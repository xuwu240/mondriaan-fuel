/* ============================================================
 * data.js — 静态数据库
 * 营养数据：每 100g（可食部/标注状态）含量
 *   kcal 千卡 · p 蛋白质(g) · c 碳水(g) · f 脂肪(g)
 * price：今日参考单价（元 / 100g）
 * 数值参考《中国食物成分表》第6版，单价为城市市场常见区间均值
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 食材库（五大营养分类） ---------- */
  // cat: protein 蛋白质 / carbs 碳水 / fat 优质脂肪 / vit 维生素 / mineral 矿物质
  var INGREDIENTS = [
    /* 蛋白质 */
    { id:'chicken_breast', name:'鸡胸肉(去皮)', cat:'protein', kcal:118, p:23.6, c:0.2, f:2.6, price:2.0, tags:['高蛋白','低脂'], meal:['lunch','dinner'] },
    { id:'chicken_thigh', name:'鸡腿肉(去皮)', cat:'protein', kcal:117, p:20.8, c:0,   f:3.1, price:1.8, tags:['高蛋白'], meal:['lunch','dinner'] },
    { id:'egg', name:'鸡蛋(全蛋)', cat:'protein', kcal:144, p:13.3, c:2.8, f:8.8, price:1.6, tags:['全营养','早餐'], meal:['breakfast','snack'] },
    { id:'egg_white', name:'鸡蛋白', cat:'protein', kcal:60, p:11.6, c:3.1, f:0.2, price:1.2, tags:['高蛋白','极低脂'], meal:['breakfast','snack'] },
    { id:'beef_lean', name:'牛里脊(瘦)', cat:'protein', kcal:125, p:20.2, c:1.7, f:4.4, price:6.0, tags:['富铁','高蛋白'], meal:['lunch','dinner'] },
    { id:'pork_lean', name:'猪里脊', cat:'protein', kcal:155, p:20.2, c:1.7, f:7.9, price:3.2, tags:['高蛋白'], meal:['lunch','dinner'] },
    { id:'cod', name:'鳕鱼', cat:'protein', kcal:88, p:20.4, c:0.5, f:0.5, price:8.0, tags:['高蛋白','极低脂','DHA'], meal:['lunch','dinner'] },
    { id:'salmon', name:'三文鱼', cat:'protein', kcal:139, p:17.2, c:0, f:7.8, price:12.0, tags:['Omega-3','DHA'], meal:['lunch','dinner'] },
    { id:'shrimp', name:'基围虾仁', cat:'protein', kcal:87, p:18.6, c:1.6, f:1.2, price:5.5, tags:['高蛋白','低脂'], meal:['lunch','dinner'] },
    { id:'tuna_can', name:'水浸金枪鱼罐头', cat:'protein', kcal:116, p:26.0, c:0, f:1.0, price:6.5, tags:['高蛋白','便携'], meal:['lunch'] },
    { id:'tofu_north', name:'北豆腐', cat:'protein', kcal:98, p:12.2, c:3.6, f:4.8, price:0.6, tags:['植物蛋白','钙'], meal:['lunch','dinner'] },
    { id:'milk', name:'纯牛奶(全脂)', cat:'protein', kcal:54, p:3.0, c:3.4, f:3.2, price:0.8, tags:['钙','早餐'], meal:['breakfast','snack'] },
    { id:'greek_yogurt', name:'脱脂希腊酸奶', cat:'protein', kcal:59, p:10.2, c:3.6, f:0.4, price:1.8, tags:['高蛋白','益生菌'], meal:['breakfast','snack'] },
    { id:'chickpea', name:'鹰嘴豆(熟)', cat:'protein', kcal:164, p:8.9, c:27.0, f:2.6, price:0.9, tags:['植物蛋白','铁锌','膳食纤维'], meal:['lunch','dinner'] },

    /* 碳水 / 主食 */
    { id:'rice_white', name:'白米饭(蒸)', cat:'carbs', kcal:116, p:2.6, c:25.9, f:0.3, price:0.3, tags:['主食'], meal:['lunch','dinner'] },
    { id:'rice_brown', name:'糙米饭(蒸)', cat:'carbs', kcal:111, p:2.6, c:23.0, f:0.9, price:0.45, tags:['全谷物','低GI'], meal:['lunch','dinner'] },
    { id:'oats', name:'燕麦片(干)', cat:'carbs', kcal:377, p:15.0, c:61.6, f:6.8, price:0.9, tags:['全谷物','β-葡聚糖'], meal:['breakfast'] },
    { id:'whole_bread', name:'全麦面包', cat:'carbs', kcal:246, p:11.0, c:41.0, f:3.5, price:1.4, tags:['全谷物'], meal:['breakfast'] },
    { id:'sweet_potato', name:'蒸红薯', cat:'carbs', kcal:90, p:1.6, c:20.1, f:0.1, price:0.35, tags:['薯类','胡萝卜素'], meal:['lunch','dinner','snack'] },
    { id:'corn', name:'甜玉米(鲜)', cat:'carbs', kcal:112, p:4.0, c:22.8, f:1.2, price:0.5, tags:['全谷物'], meal:['lunch','snack'] },
    { id:'potato', name:'蒸土豆', cat:'carbs', kcal:81, p:2.7, c:17.8, f:0.1, price:0.25, tags:['薯类'], meal:['lunch','dinner'] },
    { id:'soba', name:'荞麦面(熟)', cat:'carbs', kcal:120, p:4.5, c:24.0, f:0.5, price:0.6, tags:['全谷物','低GI'], meal:['lunch','dinner'] },
    { id:'quinoa', name:'藜麦饭(熟)', cat:'carbs', kcal:120, p:4.4, c:21.3, f:1.9, price:1.6, tags:['全谷物','完全蛋白'], meal:['lunch','dinner'] },
    { id:'pasta', name:'全麦意面(熟)', cat:'carbs', kcal:158, p:5.8, c:31.0, f:0.9, price:0.8, tags:['低GI'], meal:['lunch','dinner'] },

    /* 维生素（蔬菜与水果为主） */
    { id:'broccoli', name:'西兰花(焯)', cat:'vit', kcal:36, p:4.1, c:4.3, f:0.6, price:0.7, tags:['维C','维K','叶酸'], meal:['lunch','dinner'] },
    { id:'spinach', name:'菠菜(焯)', cat:'vit', kcal:28, p:2.6, c:4.5, f:0.3, price:0.5, tags:['叶酸','维K','铁'], meal:['lunch','dinner'] },
    { id:'tomato', name:'番茄(生)', cat:'vit', kcal:20, p:0.9, c:4.0, f:0.2, price:0.5, tags:['番茄红素','维C'], meal:['lunch','dinner','snack'] },
    { id:'cucumber', name:'黄瓜(生)', cat:'vit', kcal:16, p:0.8, c:2.9, f:0.2, price:0.35, tags:['补水','低卡'], meal:['lunch','dinner','snack'] },
    { id:'carrot', name:'胡萝卜(生)', cat:'vit', kcal:39, p:1.0, c:8.8, f:0.2, price:0.3, tags:['β-胡萝卜素','维A'], meal:['lunch','dinner'] },
    { id:'lettuce', name:'生菜(生)', cat:'vit', kcal:15, p:1.4, c:2.0, f:0.2, price:0.45, tags:['叶酸','低卡'], meal:['lunch','dinner'] },
    { id:'pepper', name:'彩椒(生)', cat:'vit', kcal:26, p:1.0, c:6.0, f:0.2, price:0.9, tags:['维C极高'], meal:['lunch','dinner'] },
    { id:'blueberry', name:'蓝莓', cat:'vit', kcal:57, p:0.7, c:14.0, f:0.3, price:3.0, tags:['花青素'], meal:['snack','breakfast'] },
    { id:'apple', name:'苹果', cat:'vit', kcal:54, p:0.3, c:13.7, f:0.2, price:0.9, tags:['果胶','多酚'], meal:['snack','breakfast'] },
    { id:'banana', name:'香蕉', cat:'vit', kcal:93, p:1.4, c:22.0, f:0.2, price:0.5, tags:['钾','快碳'], meal:['snack','breakfast'] },
    { id:'orange', name:'橙子', cat:'vit', kcal:48, p:0.8, c:11.1, f:0.2, price:0.7, tags:['维C'], meal:['snack','breakfast'] },
    { id:'kiwi', name:'猕猴桃', cat:'vit', kcal:61, p:1.1, c:14.5, f:0.5, price:1.2, tags:['维C极高','叶酸'], meal:['snack','breakfast'] },

    /* 矿物质 */
    { id:'kelp', name:'鲜海带(焯)', cat:'mineral', kcal:13, p:1.2, c:2.1, f:0.1, price:0.4, tags:['碘','钙'], meal:['lunch','dinner'] },
    { id:'laver', name:'紫菜(干)', cat:'mineral', kcal:250, p:26.7, c:44.1, f:1.1, price:4.0, tags:['碘','铁'], meal:['soup'] },
    { id:'fungus', name:'水发木耳', cat:'mineral', kcal:27, p:1.5, c:6.0, f:0.2, price:0.9, tags:['铁','膳食纤维'], meal:['lunch','dinner'] },
    { id:'cheese', name:'低脂奶酪', cat:'mineral', kcal:230, p:25.0, c:4.0, f:13.0, price:9.0, tags:['钙极高'], meal:['breakfast'] },
    { id:'mushroom', name:'白蘑菇(鲜)', cat:'mineral', kcal:27, p:3.3, c:4.1, f:0.2, price:1.2, tags:['硒','B族维生素'], meal:['lunch','dinner'] },
    { id:'shrimp_skin', name:'虾皮', cat:'mineral', kcal:153, p:30.7, c:2.5, f:2.2, price:6.0, tags:['钙极高'], meal:['soup'] },
    { id:'black_sesame', name:'黑芝麻', cat:'mineral', kcal:559, p:19.1, c:24.0, f:46.0, price:3.0, tags:['钙','铁'], meal:['snack'] },
    { id:'walnut', name:'核桃仁', cat:'mineral', kcal:654, p:15.0, c:14.0, f:65.0, price:8.0, tags:['锌','镁','Omega-3'], meal:['snack'] },

    /* 优质脂肪 */
    { id:'olive_oil', name:'特级初榨橄榄油', cat:'fat', kcal:899, p:0, c:0, f:99.9, price:3.0, tags:['单不饱和脂肪'], meal:['lunch','dinner'] },
    { id:'avocado', name:'牛油果', cat:'fat', kcal:171, p:2.0, c:8.6, f:15.3, price:3.5, tags:['单不饱和脂肪','叶酸'], meal:['breakfast','snack'] },
    { id:'peanut_butter', name:'无糖花生酱', cat:'fat', kcal:600, p:25.0, c:20.0, f:50.0, price:3.2, tags:['植物蛋白','好脂肪'], meal:['breakfast','snack'] },
    { id:'flax_oil', name:'亚麻籽油', cat:'fat', kcal:899, p:0, c:0, f:99.9, price:4.5, tags:['α-亚麻酸'], meal:['lunch','dinner'] },
    { id:'mixed_nuts', name:'混合原味坚果', cat:'fat', kcal:607, p:18.0, c:20.0, f:52.0, price:5.0, tags:['锌镁','好脂肪'], meal:['snack'] }
  ];

  /* ---------- 饮食打卡常见食物库（含中式菜肴/快餐） ---------- */
  var FOODS = [
    { id:'f_rice', name:'白米饭', kcal:116, p:2.6, c:25.9, f:0.3, std:200 },
    { id:'f_brownrice', name:'糙米饭', kcal:111, p:2.6, c:23.0, f:0.9, std:200 },
    { id:'f_noodle', name:'清汤面条', kcal:110, p:3.5, c:20.0, f:1.5, std:250 },
    { id:'f_beefnoodle', name:'红烧牛肉面', kcal:125, p:7.0, c:15.0, f:4.2, std:400 },
    { id:'f_oat', name:'牛奶燕麦粥', kcal:95, p:4.0, c:15.0, f:2.3, std:300 },
    { id:'f_wholebread', name:'全麦面包', kcal:246, p:11.0, c:41.0, f:3.5, std:80 },
    { id:'f_bao', name:'鲜肉包(1个)', kcal:227, p:9.0, c:28.0, f:9.0, std:100 },
    { id:'f_jianbing', name:'杂粮煎饼', kcal:198, p:7.0, c:30.0, f:6.0, std:200 },
    { id:'f_egg', name:'水煮蛋', kcal:144, p:13.3, c:2.8, f:8.8, std:50 },
    { id:'f_omelette', name:'番茄炒蛋', kcal:129, p:6.0, c:6.0, f:9.0, std:200 },
    { id:'f_chicken_broccoli', name:'香煎鸡胸配西兰花', kcal:135, p:17.0, c:4.0, f:5.2, std:250 },
    { id:'f_kungpao', name:'宫保鸡丁', kcal:194, p:14.0, c:12.0, f:10.0, std:250 },
    { id:'f_mapo', name:'麻婆豆腐', kcal:113, p:8.0, c:5.0, f:7.0, std:220 },
    { id:'f_porkbelly', name:'红烧肉', kcal:350, p:10.0, c:10.0, f:30.0, std:150 },
    { id:'f_fish_steam', name:'清蒸鲈鱼', kcal:105, p:18.0, c:1.0, f:3.2, std:200 },
    { id:'f_shrimp_boil', name:'白灼虾', kcal:93, p:18.5, c:1.5, f:1.2, std:150 },
    { id:'f_salad', name:'鸡胸蔬菜沙拉(酱)', kcal:98, p:7.5, c:6.0, f:5.0, std:300 },
    { id:'f_hotpot_veg', name:'清汤麻辣烫(杂)', kcal:85, p:5.0, c:8.0, f:3.5, std:400 },
    { id:'f_burger', name:'牛肉汉堡', kcal:250, p:13.0, c:25.0, f:10.0, std:220 },
    { id:'f_friedchicken', name:'炸鸡(带皮)', kcal:279, p:20.0, c:12.0, f:17.0, std:180 },
    { id:'f_pizza', name:'芝士披萨', kcal:260, p:11.0, c:30.0, f:11.0, std:150 },
    { id:'f_fries', name:'炸薯条', kcal:312, p:4.0, c:41.0, f:15.0, std:100 },
    { id:'f_chips', name:'薯片', kcal:540, p:7.0, c:50.0, f:35.0, std:50 },
    { id:'f_cola', name:'可乐(含糖)', kcal:42, p:0, c:10.6, f:0, std:330 },
    { id:'f_milktea', name:'珍珠奶茶(全糖)', kcal:120, p:1.5, c:20.0, f:3.5, std:500 },
    { id:'f_latte', name:'拿铁(全脂奶)', kcal:60, p:3.0, c:5.0, f:3.0, std:350 },
    { id:'f_apple', name:'苹果', kcal:54, p:0.3, c:13.7, f:0.2, std:200 },
    { id:'f_banana', name:'香蕉', kcal:93, p:1.4, c:22.0, f:0.2, std:120 },
    { id:'f_yogurt', name:'无糖酸奶', kcal:72, p:4.0, c:10.0, f:1.6, std:150 },
    { id:'f_nuts', name:'混合坚果', kcal:607, p:18.0, c:20.0, f:52.0, std:25 },
    { id:'f_sweetpotato', name:'蒸红薯', kcal:90, p:1.6, c:20.1, f:0.1, std:200 },
    { id:'f_dumpling', name:'猪肉水饺(10只)', kcal:230, p:10.0, c:28.0, f:9.0, std:240 }
  ];

  /* ---------- 食物图片（联网生成 · 风格统一的食物摄影） ----------
   * 每种食物匹配一张高清方图（text_to_image 接口，浏览器自动缓存）；
   * 加载失败/离线时 onerror 回退内置 De Stijl 几何占位图（data URI，零网络请求） */
  var IMG_API = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?image_size=square&prompt=';
  var IMG_STYLE = ', single serving, centered composition, clean light background, soft studio lighting, appetizing, professional food photography, high detail';
  var FOOD_IMG_PROMPTS = {
    f_rice:'a bowl of steamed white rice',
    f_brownrice:'a bowl of cooked brown rice',
    f_noodle:'chinese noodles in clear broth',
    f_beefnoodle:'braised beef noodle soup',
    f_oat:'milk oatmeal porridge in a bowl',
    f_wholebread:'slices of whole wheat bread',
    f_bao:'a steamed chinese pork bun baozi',
    f_jianbing:'chinese multigrain crepe jianbing',
    f_egg:'a peeled boiled egg',
    f_omelette:'chinese tomato and egg stir fry',
    f_chicken_broccoli:'pan seared chicken breast with broccoli',
    f_kungpao:'kung pao chicken with peanuts',
    f_mapo:'mapo tofu in red sauce',
    f_porkbelly:'chinese braised pork belly hong shao rou',
    f_fish_steam:'steamed whole sea bass with scallion',
    f_shrimp_boil:'boiled shrimp on a plate',
    f_salad:'chicken breast vegetable salad',
    f_hotpot_veg:'chinese malatang vegetable hotpot bowl',
    f_burger:'a beef burger',
    f_friedchicken:'crispy fried chicken pieces',
    f_pizza:'a cheese pizza slice',
    f_fries:'french fries',
    f_chips:'potato chips in a bowl',
    f_cola:'a glass of cola with ice',
    f_milktea:'bubble milk tea with tapioca pearls',
    f_latte:'a cup of latte coffee',
    f_apple:'a fresh red apple',
    f_banana:'a ripe banana',
    f_yogurt:'plain yogurt in a bowl',
    f_nuts:'mixed nuts in a small bowl',
    f_sweetpotato:'a steamed sweet potato',
    f_dumpling:'boiled pork dumplings on a plate'
  };
  // 默认占位图：De Stijl 几何图形（红黄蓝+黑框），内联 data URI 永不加载失败
  var IMG_PH = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
    '<rect width="48" height="48" fill="#FAFAF5"/>' +
    '<rect x="3" y="3" width="42" height="42" fill="none" stroke="#111111" stroke-width="3"/>' +
    '<circle cx="24" cy="26" r="11" fill="#F7D41A" stroke="#111111" stroke-width="2"/>' +
    '<rect x="6" y="6" width="10" height="10" fill="#E62325"/>' +
    '<rect x="32" y="34" width="10" height="8" fill="#1E4E9C"/>' +
    '</svg>');
  /* 生成食物图片标签：固定宽高防布局偏移，lazy+async 解码防卡顿，onerror 回退占位图 */
  function imgTag(f) {
    var p = f && FOOD_IMG_PROMPTS[f.id];
    var src = p ? IMG_API + encodeURIComponent(p + IMG_STYLE) : IMG_PH;
    return '<img class="fimg" src="' + src + '" alt="" width="48" height="48" loading="lazy" decoding="async" onerror="FITDATA.imgErr(this)">';
  }

  /* ---------- 智能食谱食材图片（与食物库同风格的高清方图） ---------- */
  var ING_IMG_PROMPTS = {
    chicken_breast:'grilled skinless chicken breast fillet',
    chicken_thigh:'cooked skinless chicken thigh meat',
    egg:'boiled eggs',
    egg_white:'boiled egg whites in a bowl',
    beef_lean:'sliced lean beef tenderloin',
    pork_lean:'sliced lean pork tenderloin',
    cod:'steamed cod fish fillet',
    salmon:'pan seared salmon fillet',
    shrimp:'cooked peeled shrimp',
    tuna_can:'canned tuna chunks in a bowl',
    tofu_north:'firm tofu blocks on a plate',
    milk:'a glass of milk',
    greek_yogurt:'greek yogurt in a bowl',
    chickpea:'cooked chickpeas in a bowl',
    rice_white:'a bowl of steamed white rice',
    rice_brown:'a bowl of cooked brown rice',
    oats:'rolled oats in a bowl',
    whole_bread:'slices of whole wheat bread',
    sweet_potato:'a steamed sweet potato',
    corn:'a fresh sweet corn cob',
    potato:'a steamed potato',
    soba:'cooked soba noodles in a bowl',
    quinoa:'cooked quinoa in a bowl',
    pasta:'cooked whole wheat spaghetti on a plate',
    broccoli:'blanched broccoli florets',
    spinach:'blanched spinach on a plate',
    tomato:'a fresh tomato',
    cucumber:'a fresh cucumber',
    carrot:'fresh carrots',
    lettuce:'fresh lettuce leaves',
    pepper:'fresh bell peppers',
    blueberry:'blueberries in a bowl',
    apple:'a fresh red apple',
    banana:'a ripe banana',
    orange:'a fresh orange',
    kiwi:'fresh kiwi fruit cut in half',
    kelp:'blanched kelp seaweed strips',
    laver:'dried laver seaweed sheets',
    fungus:'soaked black wood ear mushrooms',
    cheese:'low fat cheese slices',
    mushroom:'fresh white mushrooms',
    shrimp_skin:'dried baby shrimp in a bowl',
    black_sesame:'black sesame seeds in a bowl',
    walnut:'walnut kernels in a bowl',
    olive_oil:'a bottle of olive oil',
    avocado:'a ripe avocado cut in half',
    peanut_butter:'peanut butter in a bowl',
    flax_oil:'a bottle of flaxseed oil',
    mixed_nuts:'mixed nuts in a small bowl'
  };
  /* 食谱食材图片标签（食谱条目 / 替换备选用） */
  function ingImgTag(ing) {
    var p = ing && ING_IMG_PROMPTS[ing.id];
    var src = p ? IMG_API + encodeURIComponent(p + IMG_STYLE) : IMG_PH;
    return '<img class="fimg" src="' + src + '" alt="" width="48" height="48" loading="lazy" decoding="async" onerror="FITDATA.imgErr(this)">';
  }

  /* ---------- 职业与日常活动系数（不含刻意运动） ---------- */
  var OCCUPATIONS = [
    { id:'sedentary', label:'久坐办公型', factor:1.20, examples:'程序员 / 行政 / 客服 / 会计 / 作家' },
    { id:'student',   label:'学生 / 教研型', factor:1.30, examples:'学生 / 教师 / 研究 / 设计创作' },
    { id:'light',     label:'轻度走动型', factor:1.375, examples:'销售 / 医生 / 律师 / 零售' },
    { id:'moderate',  label:'中度体力型', factor:1.55, examples:'护士 / 餐饮 / 育儿 / 美发' },
    { id:'heavy',     label:'重度体力型', factor:1.75, examples:'建筑 / 快递 / 教练 / 农业' }
  ];

  var EXPERIENCE = [
    { id:'newbie', label:'新手', desc:'规律训练不足3个月' },
    { id:'lt1', label:'1年以内', desc:'有基础训练习惯' },
    { id:'m1_3', label:'1-3年', desc:'系统训练，动作熟练' },
    { id:'gt3', label:'3年以上', desc:'训练经验丰富' }
  ];

  var BODY_PARTS_MUSCLE = ['胸','背','肩','手臂','核心','臀','腿','全身均衡'];
  var BODY_PARTS_POSTURE = ['圆肩驼背','骨盆前倾','头前伸','高低肩','X/O型腿','脊柱侧弯','扁平足'];

  var DISCOMFORTS = ['无不适','肌肉酸痛','关节不适','头痛','肠胃不适','痛经','腰部不适','感冒乏力'];

  /* ---------- 男性睾酮节律选项 ---------- */
  var TESTO_PEAKS = [
    { id:'p1', label:'05:00–07:00', hours:[5,7] },
    { id:'p2', label:'07:00–09:00', hours:[7,9] },
    { id:'p3', label:'09:00–11:00', hours:[9,11] },
    { id:'p0', label:'无明显感觉', hours:null }
  ];
  var TESTO_MORNING = [
    { id:'m4', label:'几乎每日', score:4 },
    { id:'m3', label:'多数天数', score:3 },
    { id:'m2', label:'偶尔', score:2 },
    { id:'m1', label:'很少/没有', score:1 }
  ];
  // 男性使用时不展示女性专属不适项
  function discomfortsFor(gender) {
    return gender === 'female' ? DISCOMFORTS : DISCOMFORTS.filter(function (x) { return x !== '痛经'; });
  }


  /* ---------- 膳食指南常量（2022版，成人） ---------- */
  var GUIDELINES = {
    veg_g:[300,500],          // 蔬菜 300-500g/日
    fruit_g:[200,350],        // 水果 200-350g/日
    grain_g:[200,300],        // 谷类+薯类 200-300g（生重口径，此处熟食按等效）
    wholeGrainRatio:0.5,      // 全谷物/杂豆占 1/4~1/2，取 1/2 偏严
    water_ml:{male:1700,female:1500},
    salt_g:5,
    oil_g:[25,30],
    fiber_g:[25,30],
    kcalFloor:{male:1500,female:1200}, // 安全最低能量
    proteinFactor:{fatloss:1.6,muscle:1.8,posture:1.2,keep:1.2},
    fatRatio:[0.20,0.30]
  };

  var MEAL_NAMES = [
    { id:'breakfast', name:'早餐', ratio:0.30, color:'r' },
    { id:'lunch', name:'午餐', ratio:0.40, color:'y' },
    { id:'dinner', name:'晚餐', ratio:0.25, color:'b' },
    { id:'snack', name:'加餐', ratio:0.05, color:'k' }
  ];

  global.FITDATA = {
    INGREDIENTS:INGREDIENTS,
    FOODS:FOODS,
    OCCUPATIONS:OCCUPATIONS,
    EXPERIENCE:EXPERIENCE,
    BODY_PARTS_MUSCLE:BODY_PARTS_MUSCLE,
    BODY_PARTS_POSTURE:BODY_PARTS_POSTURE,
    DISCOMFORTS:DISCOMFORTS,
    TESTO_PEAKS:TESTO_PEAKS,
    TESTO_MORNING:TESTO_MORNING,
    discomfortsFor:discomfortsFor,
    GUIDELINES:GUIDELINES,
    MEAL_NAMES:MEAL_NAMES,
    byId:function (list, id) {
      for (var i=0;i<list.length;i++){ if (list[i].id===id) return list[i]; }
      return null;
    },
    imgTag:imgTag,
    ingImgTag:ingImgTag,
    /* 图片加载失败回退：防止 onerror 循环，已占位则不再处理 */
    imgErr:function (el) { el.onerror = null; if (el.src !== IMG_PH) el.src = IMG_PH; }
  };
})(window);
