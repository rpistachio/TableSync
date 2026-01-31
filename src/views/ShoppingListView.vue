<template>
  <div class="shopping-page">
    <van-nav-bar
      :title="listMode === 'today' ? '今日所需食材' : '本周购物清单'"
      left-text="返回"
      left-arrow
      @click-left="goBack"
      fixed
    />

    <main class="page-content">
      <!-- 今日 / 本周 切换：sticky + animated -->
      <van-tabs
        v-model:active="listMode"
        shrink
        sticky
        animated
        class="main-tabs"
        @change="onTabChange"
      >
        <van-tab title="今日" name="today" />
        <van-tab title="本周" name="weekly" />
      </van-tabs>

      <!-- 本周模式：顶部经营主张卡片 -->
      <div v-if="listMode === 'weekly'" class="notice-card">
        <div class="notice-icon">📅</div>
        <div class="notice-text">{{ weeklyNoticeText }}</div>
      </div>

      <!-- 排序 -->
      <div class="toolbar">
        <van-dropdown-menu>
          <van-dropdown-item
            v-model="sortMode"
            :options="[
              { text: '默认顺序', value: 'default' },
              { text: '按食材种类', value: 'category' }
            ]"
          />
        </van-dropdown-menu>
      </div>

      <!-- 今日清单：按分类卡片渲染 -->
      <template v-if="listMode === 'today'">
        <template v-if="todayItems.length > 0">
          <div
            v-for="group in groupedTodayItems"
            :key="'today-' + group.category"
            class="category-card"
          >
            <div class="category-card__title">{{ group.category }}</div>
            <div class="category-card__list">
              <div
                v-for="item in group.items"
                :key="'today-' + item.id"
                :class="['list-row', { 'is-done': item.checked }]"
              >
                <van-checkbox :model-value="item.checked" @update:model-value="(v) => setChecked(item, v, 'today')" />
                <div class="list-row__body">
                  <div class="list-row__name">{{ item.name }}</div>
                  <div class="list-row__amount">{{ item.amount }}</div>
                  <div class="list-row__tags">
                    <van-tag v-if="item.isShared" type="success" plain size="medium">共用</van-tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <van-empty v-else description="暂无清单数据，请重新生成" image="search" />
      </template>

      <!-- 本周清单：按分类卡片渲染 -->
      <template v-if="listMode === 'weekly'">
        <template v-if="weeklyItems.length > 0">
          <div
            v-for="group in groupedWeeklyItems"
            :key="'weekly-' + group.category"
            class="category-card"
          >
            <div class="category-card__title">{{ group.category }}</div>
            <div class="category-card__list">
              <div
                v-for="item in group.items"
                :key="'weekly-' + item.id"
                :class="['list-row', { 'is-done': item.checked }]"
              >
                <van-checkbox :model-value="item.checked" @update:model-value="(v) => setChecked(item, v, 'weekly')" />
                <div class="list-row__body">
                  <div class="list-row__name">{{ item.name }}</div>
                  <div class="list-row__amount">{{ item.amount }}</div>
                  <div class="list-row__tags">
                    <van-tag v-if="isWeeklyCore(item)" type="warning" plain size="medium">本周总计</van-tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <van-empty v-else description="暂无清单数据，请重新生成" image="search" />
      </template>
    </main>

    <footer class="page-footer">
      <van-button type="primary" block class="copy-btn" @click="copyList">
        复制清单
      </van-button>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { generateShoppingList, generateWeeklyShoppingList, MEAT_KEY_MAP } from '../data/menuData';

const STORAGE_KEY_TODAY = 'tablesync_shopping_checked_today';
const STORAGE_KEY_WEEKLY = 'tablesync_shopping_checked_weekly';

const router = useRouter();
const route = useRoute();

const sortMode = ref('default');
const listMode = ref('today');

function normalizeMeat(meat) {
  if (meat == null || meat === '') return 'chicken';
  return MEAT_KEY_MAP[meat] ?? meat;
}

function getPreference() {
  const rawMeat = route.query.meat;
  const pref = {
    taste: route.query.taste || 'light',
    meat: normalizeMeat(rawMeat) || 'chicken',
    adultCount: Number(route.query.adultCount) || 2,
    babyMonth: Number(route.query.babyMonth) || 6,
    hasBaby: route.query.hasBaby === '1'
  };
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/2601ac33-4192-4086-adc2-d77ecd51bad3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ShoppingListView.vue:141',message:'getPreference in view',data:{pref:pref,query:route.query},hypothesisId:'C',timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
  // #endregion
  return pref;
}

function buildWeeklyPreferences() {
  const pref = getPreference();
  const meatKey = typeof pref.meat === 'string' && /[\u4e00-\u9fa5]/.test(pref.meat)
    ? (MEAT_KEY_MAP[pref.meat] ?? 'chicken')
    : (pref.meat || 'chicken');
  return Array.from({ length: 7 }, () => ({
    taste: pref.taste,
    meat: meatKey,
    adultCount: pref.adultCount,
    babyMonth: pref.babyMonth,
    hasBaby: pref.hasBaby
  }));
}

const todayItems = reactive([]);
const weeklyItems = reactive([]);

function updateList() {
  const preference = getPreference();
  const weeklyPrefs = buildWeeklyPreferences();
  const newToday = generateShoppingList(preference);
  const newWeekly = generateWeeklyShoppingList(weeklyPrefs);
  todayItems.splice(0, todayItems.length, ...newToday);
  weeklyItems.splice(0, weeklyItems.length, ...newWeekly);
  restoreChecked(todayItems, STORAGE_KEY_TODAY);
  restoreChecked(weeklyItems, STORAGE_KEY_WEEKLY);
}

function loadCheckedStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function restoreChecked(items, key) {
  const map = loadCheckedStorage(key);
  items.forEach((it) => {
    if (Object.prototype.hasOwnProperty.call(map, it.name)) {
      it.checked = !!map[it.name];
    }
  });
}

function persistChecked(items, key) {
  try {
    const map = {};
    items.forEach((it) => {
      map[it.name] = it.checked;
    });
    localStorage.setItem(key, JSON.stringify(map));
  } catch (_) {}
}

onMounted(() => {
  updateList();
});

function onTabChange() {
  updateList();
}

function setChecked(item, value, mode) {
  item.checked = value;
  const items = mode === 'today' ? todayItems : weeklyItems;
  const key = mode === 'today' ? STORAGE_KEY_TODAY : STORAGE_KEY_WEEKLY;
  persistChecked(items, key);
}

/** 排序后的今日列表 */
const sortedTodayItems = computed(() => {
  const list = [...todayItems];
  if (sortMode.value === 'category') {
    return list.sort((a, b) => {
      if (a.category === b.category) return a.id - b.id;
      return (a.category || '').localeCompare(b.category || '', 'zh-CN');
    });
  }
  return list.sort((a, b) => a.order - b.order || a.id - b.id);
});

/** 排序后的本周列表 */
const sortedWeeklyItems = computed(() => {
  const list = [...weeklyItems];
  if (sortMode.value === 'category') {
    return list.sort((a, b) => {
      if (a.category === b.category) return a.id - b.id;
      return (a.category || '').localeCompare(b.category || '', 'zh-CN');
    });
  }
  return list.sort((a, b) => a.order - b.order || a.id - b.id);
});

/** 按分类分组的今日列表，用于卡片渲染 */
const groupedTodayItems = computed(() => {
  const map = new Map();
  sortedTodayItems.value.forEach((item) => {
    const c = item.category || '其他';
    if (!map.has(c)) map.set(c, { category: c, items: [] });
    map.get(c).items.push(item);
  });
  return Array.from(map.values());
});

/** 按分类分组的本周列表，用于卡片渲染 */
const groupedWeeklyItems = computed(() => {
  const map = new Map();
  sortedWeeklyItems.value.forEach((item) => {
    const c = item.category || '其他';
    if (!map.has(c)) map.set(c, { category: c, items: [] });
    map.get(c).items.push(item);
  });
  return Array.from(map.values());
});

function isWeeklyCore(item) {
  const c = (item.category || '').trim();
  const n = (item.name || '').trim();
  if (c === '肉类' || c === '蛋类') return true;
  if (/排骨|鳕鱼|鱼肉|鸡肉|猪肉|牛肉|虾仁|鸡腿|牛里脊/i.test(n)) return true;
  return false;
}

function parseKg(amountStr) {
  if (!amountStr || typeof amountStr !== 'string') return 0;
  const g = amountStr.match(/(\d+(?:\.\d+)?)\s*g/);
  const kg = amountStr.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (kg) return parseFloat(kg[1]) || 0;
  if (g) return (parseFloat(g[1]) || 0) / 1000;
  return 0;
}

/** 本周经营建议文案（肉类主料种类数） */
const weeklyNoticeText = computed(() => {
  if (!weeklyItems.length) return '本周暂无食材数据，请先生成菜单。';
  const meatCount = weeklyItems.filter((it) => (it.category || '') === '肉类').length;
  const tip = meatCount > 0
    ? `本周共需肉类主料 ${meatCount} 种，建议周一集中采购，分装冷冻可节省 30% 备菜时间。`
    : '建议周一集中采购，按需分装冷藏/冷冻，可节省备菜时间。';
  return `本周经营建议：${tip}`;
});

function goBack() {
  router.back();
}

async function copyList() {
  const items = listMode.value === 'today' ? todayItems : weeklyItems;
  const lines = items
    .filter((item) => !item.checked)
    .map((item) => `${item.name} ${item.amount}`);
  const text = lines.join('\n');
  const hint = listMode.value === 'today' ? '今日无需采购食材' : '本周无需采购食材';
  try {
    await navigator.clipboard.writeText(text || hint);
    alert('清单已复制到剪贴板，可以粘贴到微信或备忘录。');
  } catch (e) {
    alert('复制失败，可以手动选择文字复制。');
  }
}
</script>

<style scoped>
.shopping-page {
  min-height: 100vh;
  background-color: #f7f8fa;
  padding-bottom: env(safe-area-inset-bottom);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.page-content {
  padding: 46px 16px 24px;
}

.main-tabs {
  margin-bottom: 12px;
}

.main-tabs :deep(.van-tabs__wrap) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.main-tabs :deep(.van-tab) {
  font-weight: 600;
}

.main-tabs :deep(.van-tabs__line) {
  background: #07c160;
}

/* 顶部经营主张卡片 */
.notice-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%);
  border-radius: 12px;
  border: 1px solid #f0e6c8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.notice-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.notice-text {
  font-size: 14px;
  color: #5a544f;
  line-height: 1.5;
}

.toolbar {
  margin-bottom: 12px;
  text-align: right;
}

/* 卡片层：margin 3vw、padding 12px */
.category-card,
.card {
  margin: 10px 3vw;
  padding: 12px;
  margin-bottom: 12px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
}

.category-card__title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #4a4540;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}

.category-card__list {
  padding: 8px 0;
}

.list-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 16px;
  min-height: 52px;
}

.list-row.is-done .list-row__name {
  text-decoration: line-through;
  color: #969799;
}

.list-row :deep(.van-checkbox) {
  flex-shrink: 0;
  padding-top: 2px;
}

.list-row__body {
  flex: 1;
  min-width: 0;
}

.list-row__name {
  font-size: 14px;
  font-weight: 600;
  color: #2d2d2d;
  line-height: 1.5;
}

.list-row__amount {
  font-size: 14px;
  color: #969799;
  margin-top: 4px;
  line-height: 1.5;
}

.list-row__tags {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.list-row__tags :deep(.van-tag--success.van-tag--plain) {
  color: #07c160;
  border-color: #07c160;
}

.list-row__tags :deep(.van-tag--warning.van-tag--plain) {
  color: #ed6a0c;
  border-color: #ed6a0c;
}

.page-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 16px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  background: linear-gradient(to top, #f7f8fa 85%, transparent);
}

.page-footer.fixed-bottom {
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
}

.copy-btn {
  height: 48px !important;
  border-radius: 12px !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
  box-shadow: 0 4px 14px rgba(45, 45, 45, 0.15) !important;
}
</style>
