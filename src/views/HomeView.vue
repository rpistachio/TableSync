<template>
  <div class="page-root">
    <header class="brand-header">
      <div class="header-content">
        <span class="date-badge">{{ currentDate }}</span>
        <h1 class="main-title">TableSync</h1>
        <p class="sub-quote">Synchronize your table with family. 同步全家餐桌，连接每一餐。</p>
      </div>
    </header>

    <!-- Pill Segmented Control：大人 / 宝宝 同一行，圆润药丸式 -->
    <div class="member-pills-container">
      <div class="pills-track">
        <div :class="['pill-item', activeMember === 'adult' ? 'is-active' : '']" @click="toggleMember('adult')">
          <span class="pill-text">大人</span>
        </div>
        <div class="pill-divider" aria-hidden="true"></div>
        <div :class="['pill-item', activeMember === 'baby' ? 'is-active' : '']" @click="toggleMember('baby')">
          <span class="pill-text">宝宝</span>
        </div>
      </div>
      <!-- 选宝宝时：下方显示半透明月龄标签，不占视觉重心 -->
      <div v-if="activeMember === 'baby'" class="baby-age-tag">
        <span class="baby-age-tag-label">宝宝月龄</span>
        <span class="baby-age-tag-value">{{ babyMonth }} 月</span>
      </div>
    </div>

    <section v-if="activeMember === 'baby'" class="selection-group baby-age-section">
      <div class="baby-age-row">
        <van-slider v-model="babyMonth" :min="6" :max="36" :step="1" active-color="#C1663E" />
      </div>
      <p class="baby-age-hint">根据月龄调整辅食性状（泥 / 末 / 块）</p>
    </section>

    <section class="selection-group">
      <h2 class="group-label">Taste Preference / 口味偏好</h2>
      <div class="card-stack">
        <div
          v-for="t in tastes"
          :key="t.value"
          :class="['curated-card', { 'is-active': selectedTaste === t.value }]"
          @click="selectedTaste = t.value"
        >
          <span class="card-icon">{{ t.icon }}</span>
          <span class="card-text">{{ t.label }}</span>
        </div>
      </div>
    </section>

    <section class="selection-group">
      <h2 class="group-label">Hero Ingredient / 主食材</h2>
      <div class="card-stack">
        <div
          v-for="m in meats"
          :key="m.value"
          :class="['curated-card', { 'is-active': selectedMeat === m.value }]"
          @click="selectedMeat = m.value"
        >
          <span class="card-icon">{{ m.icon }}</span>
          <span class="card-text">{{ m.label }}</span>
        </div>
      </div>
    </section>

    <!-- 品牌名：紧接主食材列表之后，下方 200px 留白防 Banner 遮挡 -->
    <div class="home-brand">
      <div class="brand-line"></div>
      <span class="brand-text">TableSync</span>
    </div>
    <div style="height: 200px; width: 100%;"></div>

    <footer class="bottom-banner">
      <van-button block class="premium-btn" @click="handleGenerate">
        生成今日规划
      </van-button>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showLoadingToast } from 'vant';

const router = useRouter();

onMounted(() => {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
});

const currentDate = computed(() => {
  const d = new Date();
  return `${d.getMonth() + 1}月${d.getDate()}日 · 星期${['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}`;
});

const tastes = [
  { label: '清淡', value: 'light', icon: '🥗' },
  { label: '辛辣', value: 'spicy', icon: '🌶️' },
  { label: '有汤', value: 'soup', icon: '🥣' }
];

const meats = [
  { label: '鸡肉', value: 'chicken', icon: '🍗' },
  { label: '鱼肉', value: 'fish', icon: '🐟' },
  { label: '虾仁', value: 'shrimp', icon: '🦐' },
  { label: '牛肉', value: 'beef', icon: '🥘' },
  { label: '猪肉', value: 'pork', icon: '🥩' }
];

const selectedTaste = ref('light');
const selectedMeat = ref('chicken');
const activeMember = ref('adult');
const babyMonth = ref(6);

const toggleMember = (type) => {
  activeMember.value = type;
};

const handleGenerate = () => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/2601ac33-4192-4086-adc2-d77ecd51bad3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HomeView.vue:121',message:'handleGenerate clicked',data:{selectedTaste:selectedTaste.value,selectedMeat:selectedMeat.value,activeMember:activeMember.value},hypothesisId:'C',timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
  // #endregion
  showLoadingToast({
    message: '正在编排方案...',
    forbidClick: true
  });
  
  // 模拟缓存选中的食材逻辑（如果后续有 selectedItems 变量，请确保已定义）
  if (window.wx && wx.setStorageSync) {
    wx.setStorageSync('selected_ingredients', selectedMeat.value); 
  }

  setTimeout(() => {
    const query = {
      taste: selectedTaste.value,
      meat: selectedMeat.value,
      adultCount: '2',
      hasBaby: activeMember.value === 'baby' ? '1' : '0',
      babyMonth: String(babyMonth.value)
    };
    router.push({ name: 'Menu', query });
  }, 800);
};
</script>

<style scoped>
/* 根部彻底解锁 */
.page-root {
  display: block !important;
  min-height: 101vh;
  padding-bottom: 0;
  background-color: #fdf8f2;
  padding: 50px 0 0;
  color: #2d2d2d;
  box-sizing: border-box;
}

.brand-header {
  margin-bottom: 24px;
  padding: 0 24px;
}

.date-badge {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(193, 102, 62, 0.1);
  color: #c1663e;
  font-size: 11px;
  border-radius: 20px;
  font-weight: 600;
  margin-bottom: 12px;
}

.main-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 32px;
  color: #2d2d2d;
  margin: 0;
  letter-spacing: -0.5px;
  font-weight: 700;
}

.sub-quote {
  font-size: 13px;
  color: #8E8E93;
  margin-top: 6px;
}

.group-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #4a4540;
  margin-bottom: 16px;
  display: block;
}

.selection-group {
  padding: 0 24px;
  margin-bottom: 24px;
}

/* Pill Segmented Control：药丸式分段控件 */
.member-pills-container {
  padding: 12px 20px 10px;
  background: transparent;
}

.pills-track {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 50px;
  padding: 4px;
  gap: 0;
  position: relative;
}

.pill-item {
  flex: 1;
  padding: 10px 16px;
  text-align: center;
  z-index: 2;
  background: transparent;
  border-radius: 50px;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    background-color 0.25s ease,
    box-shadow 0.25s ease;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.pill-item:active {
  transform: scale(0.98);
}

.pill-text {
  font-size: 13px;
  font-weight: 500;
  color: #969799;
  transition: color 0.25s ease;
}

.pill-item.is-active {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.pill-item.is-active .pill-text {
  color: #1C1C1E;
}

.pill-item.is-active:active {
  transform: scale(0.99);
}

/* 极细分割线（未选中时视觉分隔） */
.pill-divider {
  width: 1px;
  height: 14px;
  background: rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
  border-radius: 1px;
}

/* 宝宝月龄：小号半透明标签，不抢视觉 */
.baby-age-tag {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
  padding: 6px 12px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.5);
  letter-spacing: 0.3px;
}

.baby-age-tag-label {
  opacity: 0.85;
}

.baby-age-tag-value {
  font-weight: 500;
  opacity: 0.9;
}

.baby-age-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.baby-age-row :deep(.van-slider) {
  flex: 1;
}

.baby-age-row :deep(.van-slider__bar) {
  background: #c1663e !important;
}

.baby-age-row :deep(.van-slider__button) {
  background: #c1663e !important;
  border-color: #c1663e !important;
}

.baby-month-value {
  font-size: 14px;
  font-weight: 600;
  color: #2d2d2d;
  min-width: 48px;
}

.baby-age-hint {
  font-size: 12px;
  color: #8e857e;
  margin: 0;
  line-height: 1.5;
}

.card-stack {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.curated-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.3s ease;
  border: 1px solid #efe9e2;
  cursor: pointer;
}

.card-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.card-text {
  font-size: 13px;
  font-weight: 500;
  color: #5a544f;
}

.curated-card.is-active {
  background: #c1663e;
  border-color: #c1663e;
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(193, 102, 62, 0.2);
}

.curated-card.is-active .card-text {
  color: #fff;
}

.home-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0 20px 0;
  opacity: 0.6;
}

.brand-line {
  width: 20px;
  height: 1px;
  background: #b2aba4;
  margin-bottom: 8px;
}

.brand-text {
  font-family: "Helvetica Neue", sans-serif;
  font-weight: 300;
  letter-spacing: 4px;
  text-transform: uppercase;
  font-size: 14px;
  color: #b2aba4;
}

</style>
