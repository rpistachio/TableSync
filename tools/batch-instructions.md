# 菜谱库针对性扩容 — generate.js 分批指令

基于数据结构延展完成后的缺口分析，将新菜谱分为 **6 个批次**，每批 4-5 道，
通过 `node generate.js --mode text --count N --input "..."` 精准生产。

生产完毕后统一走 `sync.js` 上云。

## 命名规范（与现有库风格对齐）

- 3-7 个字为主，简洁直接
- 格式：[做法/调料] + [主料]，如「蒜蓉粉丝蒸虾」「杭椒牛柳」
- 汤类：[配料] + [主料] + 汤，如「萝卜炖羊肉汤」
- 不加括号说明、不加"版""风味"等修饰词
- 不得与库中已有菜名重复或高度相似

---

## Batch 1: 羊肉类 + 鸭肉类（食材空白填补）

```bash
node generate.js --mode text --count 5 --input "
请生成以下 5 道菜，精确匹配指定字段：

1. 孜然炒羊肉
   meat: lamb, taste: quick_stir_fry, flavor_profile: spicy, spicy_sub: xiangla, cook_type: stir_fry
   tags: [quick, spicy, high_protein, stir_fry, late_night]
   prep_time ≤ 10, cook_minutes ≤ 10
   注意：库中已有「葱爆羊肉」，此菜主打孜然风味，需明确区分

2. 萝卜炖羊肉汤
   meat: lamb, taste: slow_stew, flavor_profile: light, cook_type: stew, dish_type: soup
   tags: [soup, comfort, high_protein, hearty]
   is_baby_friendly: true, can_share_base: true
   ingredient_group: lamb_leg

3. 当归羊肉煲
   meat: lamb, taste: slow_stew, flavor_profile: salty_umami, cook_type: stew
   tags: [hearty, high_protein, comfort]
   is_baby_friendly: false

4. 啤酒鸭
   meat: duck, taste: slow_stew, flavor_profile: salty_umami, cook_type: stew
   tags: [hearty, high_protein, comfort, party]

5. 姜母鸭
   meat: duck, taste: slow_stew, flavor_profile: salty_umami, cook_type: stew
   tags: [hearty, high_protein, comfort]
   is_baby_friendly: false
" --gen-images
```

---

## Batch 2: 贝类/软体类（食材空白填补）

```bash
node generate.js --mode text --count 5 --input "
请生成以下 5 道贝类/软体类菜品：

1. 辣炒蛤蜊
   meat: shellfish, taste: quick_stir_fry, flavor_profile: spicy, spicy_sub: xianla, cook_type: stir_fry
   tags: [quick, spicy, high_protein, late_night, stir_fry]
   common_allergens: ['贝类']

2. 白灼鱿鱼须
   meat: shellfish, taste: steamed_salad, flavor_profile: light, cook_type: steam
   tags: [quick, light, high_protein, no_oil, late_night]
   is_baby_friendly: true, can_share_base: true
   common_allergens: ['贝类']

3. 蚝油鲍鱼片
   meat: shellfish, taste: quick_stir_fry, flavor_profile: salty_umami, cook_type: stir_fry
   tags: [quick, high_protein, salty_umami, party]
   common_allergens: ['贝类']

4. 葱姜炒花甲
   meat: shellfish, taste: quick_stir_fry, flavor_profile: salty_umami, cook_type: stir_fry
   tags: [quick, high_protein, stir_fry, late_night, ultra_quick]
   prep_time ≤ 5, cook_minutes ≤ 5
   common_allergens: ['贝类']

5. 蒜蓉粉丝蒸扇贝
   meat: shellfish, taste: steamed_salad, flavor_profile: salty_umami, cook_type: steam
   tags: [steamed, high_protein, salty_umami, party]
   common_allergens: ['贝类']
" --gen-images
```

---

## Batch 3: 酸爽解腻 sour_fresh 补充（口味纵深）

```bash
node generate.js --mode text --count 5 --input "
请生成以下 5 道 flavor_profile: sour_fresh 的酸爽菜品，夏季开胃解腻方向：

1. 金汤酸菜鱼
   meat: fish, taste: slow_stew, flavor_profile: sour_fresh, cook_type: stew
   tags: [hearty, high_protein, sour_fresh]
   common_allergens: ['鱼']
   注意：用金汤（黄灯笼椒+酸菜）做底，不要写成普通酸菜鱼

2. 酸辣鸡丝凉拌
   meat: chicken, taste: steamed_salad, flavor_profile: sour_fresh, cook_type: cold_dress
   tags: [quick, no_oil, high_protein, sour_fresh, late_night]
   注意：库中已有「傣味柠檬手撕鸡」，此菜走醋+小米辣路线，需明确区分

3. 泰式酸辣虾
   meat: shrimp, taste: quick_stir_fry, flavor_profile: sour_fresh, cook_type: stir_fry
   tags: [quick, high_protein, stir_fry]
   common_allergens: ['虾']

4. 糟辣脆藕片
   meat: vegetable, taste: steamed_salad, flavor_profile: sour_fresh, cook_type: cold_dress
   tags: [quick, no_oil, vegetarian, sour_fresh, late_night, ultra_quick]
   prep_time ≤ 10, cook_minutes = 0

5. 酸汤肥牛
   meat: beef, taste: slow_stew, flavor_profile: sour_fresh, cook_type: stew
   tags: [hearty, high_protein, comfort]
" --gen-images
```

---

## Batch 4: 辣味层次细分（麻辣 + 鲜辣）

```bash
node generate.js --mode text --count 5 --input "
请生成以下 5 道辣味菜品，注意区分 spicy_sub 层次：

1. 水煮肉片
   meat: pork, taste: quick_stir_fry, flavor_profile: spicy, spicy_sub: mala, cook_type: stew
   tags: [spicy, high_protein, hearty, party]
   辣味以花椒+干辣椒为主，突出麻辣

2. 剁椒鱼头
   meat: fish, taste: steamed_salad, flavor_profile: spicy, spicy_sub: xianla, cook_type: steam
   tags: [spicy, high_protein, steamed, party]
   辣味以鲜辣椒/剁椒为主，突出鲜辣
   common_allergens: ['鱼']

3. 麻辣卤鸭脖
   meat: duck, taste: slow_stew, flavor_profile: spicy, spicy_sub: mala, cook_type: stew
   tags: [spicy, high_protein, late_night]

4. 干锅香辣蟹
   meat: shellfish, taste: quick_stir_fry, flavor_profile: spicy, spicy_sub: xiangla, cook_type: stir_fry
   tags: [spicy, high_protein, party, stir_fry]
   common_allergens: ['贝类']

5. 酸辣蕨根粉
   meat: vegetable, taste: steamed_salad, flavor_profile: spicy, spicy_sub: xianla, cook_type: cold_dress
   tags: [spicy, vegetarian, no_oil, late_night, quick, ultra_quick]
   prep_time ≤ 10, cook_minutes = 0
" --gen-images
```

---

## Batch 5: 深夜食堂 + 极致快手（场景化）

```bash
node generate.js --mode text --count 5 --input "
请生成以下 5 道场景化菜品，分为深夜小酌和极致快手两个方向：

【深夜食堂/小酌 — late_night】

1. 麻辣冷吃鸡丁
   meat: chicken, taste: steamed_salad, flavor_profile: spicy, spicy_sub: mala, cook_type: cold_dress
   tags: [late_night, spicy, high_protein, no_oil]
   注意：参考四川冷吃兔做法，用鸡胸肉替代兔肉

2. 盐水毛豆
   meat: vegetable, taste: steamed_salad, flavor_profile: salty_umami, cook_type: stew
   tags: [late_night, vegetarian, quick, ultra_quick, salty_umami]
   prep_time ≤ 5, cook_minutes ≤ 8
   is_baby_friendly: true, can_share_base: true

3. 香卤牛腱
   meat: beef, taste: steamed_salad, flavor_profile: salty_umami, cook_type: stew
   tags: [late_night, high_protein, salty_umami, party]
   cook_minutes: 90（卤制时间较长，但食用时切片即可）

【极致快手 — ultra_quick（总时长 ≤ 8 分钟）】

4. 荷兰豆炒腊肉
   meat: pork, taste: quick_stir_fry, flavor_profile: salty_umami, cook_type: stir_fry
   tags: [ultra_quick, quick, stir_fry, high_protein, salty_umami]
   prep_time ≤ 3, cook_minutes ≤ 5

5. 咸蛋黄焗南瓜
   meat: vegetable, taste: quick_stir_fry, flavor_profile: salty_umami, cook_type: stir_fry
   tags: [ultra_quick, quick, stir_fry, salty_umami]
   prep_time ≤ 5, cook_minutes ≤ 5
   is_baby_friendly: true, can_share_base: true
   common_allergens: ['蛋']
" --gen-images
```

---

## Batch 6: 宝宝友好共享菜 + 一物多吃（can_share_base 专项）

```bash
node generate.js --mode text --count 5 --input "
请生成以下 5 道菜，核心要求：is_baby_friendly: true, can_share_base: true。
大人版正常调味，宝宝可直接从同一锅中取未调味/少调味的部分。baby_variant 必须详细描述分拨方法。

1. 清蒸狮子头
   meat: pork, taste: steamed_salad, flavor_profile: light, cook_type: steam
   tags: [light, high_protein, steamed, baby_friendly, comfort]
   is_baby_friendly: true, can_share_base: true
   ingredient_group: pork_mince
   注意：大人配蘸料，宝宝吃原味肉丸

2. 番茄滑肉片
   meat: pork, taste: quick_stir_fry, flavor_profile: sweet_sour, cook_type: stir_fry
   tags: [quick, high_protein, stir_fry, baby_friendly]
   is_baby_friendly: true, can_share_base: true
   注意：先煮番茄汤底，取出宝宝份后再加调料

3. 山药排骨煲
   meat: pork, taste: slow_stew, flavor_profile: light, cook_type: stew
   tags: [hearty, high_protein, comfort, baby_friendly, soup]
   dish_type: soup
   is_baby_friendly: true, can_share_base: true
   ingredient_group: pork_ribs

4. 生炒鸡块
   meat: chicken, taste: quick_stir_fry, flavor_profile: salty_umami, cook_type: stir_fry
   tags: [quick, high_protein, stir_fry, baby_friendly]
   is_baby_friendly: true, can_share_base: true
   ingredient_group: whole_chicken
   注意：与库中「白切鸡」共享 whole_chicken 分组，一鸡两吃

5. 豆腐蒸鲈鱼
   meat: fish, taste: steamed_salad, flavor_profile: light, cook_type: steam
   tags: [light, high_protein, steamed, baby_friendly, no_oil]
   is_baby_friendly: true, can_share_base: true
   common_allergens: ['鱼']
   注意：库中已有「清蒸鲈鱼」，此菜加入豆腐做主配料区分
" --gen-images
```

---

## Batch 7: 疲惫模式 — 空气炸锅菜（is_airfryer_alt）

口味需覆盖 5 种 flavor_profile：salty_umami、light、spicy、sweet_sour、sour_fresh。每道菜 cook_type: air_fryer，prep_time ≤ 10，cook_minutes ≤ 20，steps ≤ 6。生成后 recipe-formatter 会自动设置 is_airfryer_alt: true 与 af-* ID。

```bash
node generate.js --mode text --count 16 --input "
请生成 16 道空气炸锅家常菜，用于疲惫模式（放进去就好）。要求：
- cook_type: air_fryer，prep_time ≤ 10，cook_minutes ≤ 20，步骤 ≤ 6 步
- 口味覆盖：salty_umami / light / spicy / sweet_sour / sour_fresh 五种都要有
- 肉类分布：鸡 3 道、猪 3 道、牛 2 道、鱼 2 道、虾 2 道、素菜 4 道
- 菜名 3–7 字，如「空气炸锅蜜汁鸡翅」「空气炸锅蒜香排骨」，可与现有 af- 系列不重名
- 每道菜必须适合家庭空气炸锅制作，步骤极简
" --out drafts/batch7_airfryer.json
```

---

## Batch 8: 疲惫模式 — 凉拌/冷菜（cold_dress）

素菜为主，cook_type: cold_dress 或 cold，prep_time ≤ 15，cook_minutes 为 0 或很小。口味覆盖咸香、酸爽、清淡等。

```bash
node generate.js --mode text --count 7 --input "
请生成 7 道凉拌/冷菜，用于疲惫模式素菜槽。要求：
- cook_type: cold_dress 或 cold，meat: vegetable（可含 1–2 道禽肉凉拌如鸡丝）
- prep_time ≤ 15，cook_minutes 为 0 或 ≤ 5
- flavor_profile 覆盖：sour_fresh、salty_umami、light 等，不要全部酸口
- 菜名如：凉拌黄瓜、凉拌西兰花、凉拌金针菇、皮蛋豆腐、拍黄瓜、糖拌番茄、凉拌三丝等，与库中已有凉拌木耳/腐竹/老醋花生不重名
- 步骤极简，免开火或仅焯水
" --out drafts/batch8_cold_dress.json
```

---

## Batch 9: 疲惫模式 — 烤箱菜（cook_type: oven）

```bash
node generate.js --mode text --count 9 --input "
请生成 9 道烤箱/焗烤家常菜，用于疲惫模式。要求：
- cook_type: oven 或 bake，prep_time ≤ 15，cook_minutes ≤ 25，步骤 ≤ 6 步
- 肉类与素菜搭配：鸡/猪/牛/鱼/虾/蔬菜等，口味覆盖咸香、清淡、酸甜
- 菜名如：烤鸡翅、烤蔬菜、焗饭、烤三文鱼等，适合家庭烤箱
" --out drafts/batch9_oven.json
```

---

## Batch 10: 疲惫模式 — 电饭煲菜（cook_type: rice_cooker）

```bash
node generate.js --mode text --count 5 --input "
请生成 5 道电饭煲菜，用于疲惫模式（放进去就好）。要求：
- cook_type: rice_cooker，prep_time ≤ 15，cook_minutes ≤ 40（电饭煲程序时间），步骤 ≤ 6 步
- 如：电饭煲焖饭、煲仔饭、电饭煲炖汤、一锅出等
- 口味覆盖咸香、清淡
" --out drafts/batch10_rice_cooker.json
```

---

## Batch 11: 疲惫模式 — 微波炉菜（cook_type: microwave）

```bash
node generate.js --mode text --count 5 --input "
请生成 5 道微波炉快手菜，用于疲惫模式。要求：
- cook_type: microwave，prep_time ≤ 10，cook_minutes ≤ 15，步骤 ≤ 5 步
- 如：微波炉蒸蛋、微波炉蒸鱼、微波炉加热类快手菜
- 口味覆盖咸香、清淡
" --out drafts/batch11_microwave.json
```

---

## 执行顺序建议

1. 按 Batch 1 → 11 依次执行（Batch 7–11 为疲惫模式补全）
2. 每批产出后先 `node scripts/validate_recipes.js` 校验（若有）
3. 确认无误后 `node tools/sync.js --draft <path>` 上云
4. 全部完成后运行 `node tools/batch-sync-recipes.js --dry-run` 检查云端一致性

## 预期产出

| 批次 | 主题 | 数量 | 覆盖缺口 |
|------|------|------|----------|
| Batch 1 | 羊肉 + 鸭肉 | 5 | 食材空白 (lamb/duck) |
| Batch 2 | 贝类/软体类 | 5 | 食材空白 (shellfish) |
| Batch 3 | 酸爽解腻 | 5 | sour_fresh 口味不足 |
| Batch 4 | 辣味层次 | 5 | spicy_sub 细分 (mala/xianla/xiangla) |
| Batch 5 | 深夜+快手 | 5 | 场景 late_night / ultra_quick |
| Batch 6 | 宝宝共享 | 5 | can_share_base + ingredient_group |
| Batch 7 | 空气炸锅（疲惫模式） | 16 | is_airfryer_alt，af-* ID，口味覆盖 |
| Batch 8 | 凉拌/冷菜（疲惫模式） | 7 | cold_dress，素菜槽 |
| Batch 9 | 烤箱（疲惫模式） | 9 | cook_type: oven |
| Batch 10 | 电饭煲（疲惫模式） | 5 | cook_type: rice_cooker |
| Batch 11 | 微波炉（疲惫模式） | 5 | cook_type: microwave |
| **总计** | | **72** | |

---

## 存量菜谱烹饪逻辑重优化（optimize-recipes）

对云端/本地已有菜谱按「烹饪逻辑规则」做一轮优化，避免弗兰肯斯坦菜谱（步骤顺序错乱、火候矛盾、调料时序错误等）。优化使用 `tools/templates/recipe-optimize-prompt.md`（已含步骤顺序、火候匹配、调料时序、食材兼容性、时间一致性等规则），优化后会自动跑 `validateIngredientStepConsistency`（含上述 5 类烹饪逻辑校验）。

### 建议执行顺序

1. **试点**（10–20 道）：先选用户反馈最多的菜谱 ID，写入 `tools/recipes-to-optimize-ids.txt`（逗号分隔），执行：
   ```bash
   node tools/run-optimize-from-list.js
   ```
   或直接指定 ID：
   ```bash
   node tools/optimize-recipes.js --ids a-beef-1,a-chi-2,a-pork-3
   ```
2. **审核**：打开 `drafts/optimized_YYYY-MM-DD.json`，确认配料与步骤无误。
3. **写回**：`node tools/apply-optimized.js`（可先 `--dry-run` 预览）。
4. **全量**（可选）：试点通过后再运行 `node tools/optimize-recipes.js` 全量优化（可用 `--batch-size 3` 控制每批数量，减少单次请求规模）。
5. **同步到云端**：写回后执行 `node tools/batch-sync-recipes.js --force`，会以 `recipes.js.bak`（或 `recipes.full.bak.js`）为源覆盖云端同 id 的菜谱记录。平时新菜用 `sync.js --draft <草稿>` 按草稿单条/批量同步；全量覆盖用 `batch-sync-recipes.js --force`。
