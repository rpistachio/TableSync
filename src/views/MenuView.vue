<template>
  <div class="menu-container">
    <van-nav-bar
      title="今日配餐"
      left-text="返回"
      left-arrow
      @click-left="goBack"
      fixed
    />

    <header class="page-header">
      <span class="curation-tag">Chef's Recommendation</span>
      <h1 class="main-title">今日配餐方案</h1>
      <p class="sub-title">{{ menu.explanation || '营养均衡 · 主材共用 · 高效执行' }}</p>
    </header>

    <main class="menu-content">
      <div class="plan-card">
        <div class="dish-section adult">
          <div class="section-header">
            <span class="role-badge adult">FOR ADULT</span>
            <span class="taste-tag">{{ tasteTagText }}</span>
          </div>
          <h2 class="dish-name">{{ adultDishName }}</h2>
          <div class="ingredient-preview">
            <template v-if="adultIngredients.length">
              <span v-for="ing in adultIngredients.slice(0, 4)" :key="ing.name">{{ ing.name }}</span>
              <span v-if="adultIngredients.length > 4">...</span>
            </template>
            <span v-else>约 {{ adultTime }} 分钟</span>
          </div>
        </div>

        <template v-if="menu.babyMenu">
          <div class="card-divider">
            <div class="dot"></div>
            <div class="line"></div>
            <div class="dot"></div>
          </div>

          <div class="dish-section baby">
            <div class="section-header">
              <span class="role-badge baby">FOR BABY</span>
              <span class="age-tag">👶 辅食阶段</span>
            </div>
            <h2 class="dish-name">{{ menu.babyMenu.name }}</h2>
            <div class="ingredient-preview">
              <template v-if="babyIngredients.length">
                <span v-for="ing in babyIngredients.slice(0, 4)" :key="ing.name">{{ ing.name }}</span>
                <span v-if="babyIngredients.length > 4">...</span>
              </template>
              <span v-else>{{ menu.babyMenu.from }}</span>
            </div>
          </div>
        </template>
      </div>

      <p class="time-hint">预计总耗时约 {{ menu.totalTime }} 分钟（可并行操作）</p>
    </main>

    <footer class="action-footer">
      <div class="button-group">
        <van-button class="secondary-btn" @click="handleRefresh">重新编排</van-button>
        <van-button block class="primary-btn" @click="goNext">查看流程</van-button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getTodayMenu } from '../data/menuData';

const route = useRoute();
const router = useRouter();

function getPreference() {
  return {
    taste: route.query.taste,
    meat: route.query.meat,
    adultCount: Number(route.query.adultCount) || 2,
    babyMonth: Number(route.query.babyMonth) || 6,
    hasBaby: route.query.hasBaby === '1'
  };
}

const menu = ref(getTodayMenu(getPreference()));

function refreshMenu() {
  menu.value = getTodayMenu(getPreference());
}

watch(
  () => [route.query.taste, route.query.meat, route.query.adultCount, route.query.babyMonth, route.query.hasBaby],
  () => { refreshMenu(); },
  { deep: true }
);

const tasteTagText = computed(() => {
  const t = menu.value?.taste || '';
  if (t === 'spicy') return '🌶️ 辛辣';
  if (t === 'soup') return '🥣 有汤';
  return '🥗 清淡';
});

const adultDishName = computed(() => menu.value?.adultMenu?.[0]?.name || '—');
const adultTime = computed(() => menu.value?.adultMenu?.[0]?.time ?? 0);
const adultIngredients = computed(() => menu.value?.adultRecipe?.ingredients || []);
const babyIngredients = computed(() => menu.value?.babyRecipe?.ingredients || []);

function goBack() {
  router.back();
}

function handleRefresh() {
  refreshMenu();
}

function goNext() {
  router.push({
    name: 'Steps',
    query: {
      taste: route.query.taste,
      meat: route.query.meat,
      adultCount: route.query.adultCount || '2',
      babyMonth: route.query.babyMonth || '6',
      hasBaby: route.query.hasBaby || '0'
    }
  });
}
</script>

<style scoped>
.menu-container {
  min-height: 100vh;
  background-color: #fdf8f2;
  padding-top: 46px;
  padding-bottom: 120px;
  padding-left: 24px;
  padding-right: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.curation-tag {
  font-size: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #c1663e;
  font-weight: 700;
}

.main-title {
  font-size: 26px;
  color: #2d2d2d;
  margin: 8px 0 4px;
}

.sub-title {
  font-size: 13px;
  color: #8e857e;
  margin-bottom: 0;
}

.menu-content {
  margin-bottom: 24px;
}

.plan-card {
  background: #fff;
  border-radius: 24px;
  padding: 28px 24px;
  box-shadow: 0 10px 30px rgba(74, 69, 64, 0.08);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.role-badge {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
  padding: 2px 8px;
  border-radius: 4px;
}

.role-badge.adult {
  background: #e8f0e9;
  color: #4a5d4e;
}

.role-badge.baby {
  background: #feeff0;
  color: #d67a7d;
}

.dish-name {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 8px;
}

.ingredient-preview {
  font-size: 12px;
  color: #999;
}

.ingredient-preview span:not(:last-child)::after {
  content: ' · ';
}

.card-divider {
  margin: 24px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-divider .line {
  flex: 1;
  height: 1px;
  background: #f0ede9;
}

.card-divider .dot {
  width: 4px;
  height: 4px;
  background: #d1cdc7;
  border-radius: 50%;
}

.time-hint {
  font-size: 12px;
  color: #8e857e;
  margin-top: 16px;
  text-align: center;
}

.action-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 24px 24px;
  background: linear-gradient(to top, #fdf8f2 85%, transparent);
}

.button-group {
  display: flex;
  gap: 12px;
  align-items: stretch;
}

.primary-btn {
  flex: 2;
  height: 54px !important;
  background: #2d2d2d !important;
  color: #fdf8f2 !important;
  border-radius: 12px !important;
  font-weight: 600 !important;
  border: none !important;
}

.secondary-btn {
  flex: 1;
  height: 54px !important;
  background: #fff !important;
  border: 1px solid #efe9e2 !important;
  border-radius: 12px !important;
  color: #5a544f !important;
  font-weight: 500 !important;
}
</style>
