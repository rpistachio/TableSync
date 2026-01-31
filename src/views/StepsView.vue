<template>
  <div class="steps-container">
    <van-nav-bar
      title="今日做菜步骤"
      left-text="返回"
      left-arrow
      @click-left="goBack"
      fixed
    />

    <main class="page-content" style="margin-top: 46px">
      <div class="progress-block">
        <van-progress
          :percentage="progressPercentage"
          stroke-width="8"
          stroke-color="#C1663E"
          :show-pivot="false"
        />
        <p class="progress-label">{{ currentStepLabel }}</p>
      </div>

      <div class="steps-list">
        <div
          v-for="step in steps"
          :key="step.id"
          :class="['step-card', { completed: step.completed }]"
        >
          <div class="step-card__header">
            <div class="step-card__title-row">
              <span class="step-card__title">{{ step.title }}</span>
              <span
                v-if="stepTag(step).text"
                :class="['role-badge', stepTag(step).text === '成人餐' ? 'adult' : 'baby']"
              >
                {{ stepTag(step).text }}
              </span>
            </div>
            <div class="step-card__meta">
              预计用时：{{ step.duration }} 分钟
              <span v-if="step.completed" class="step-card__done">｜ 已完成</span>
            </div>
          </div>
          <div class="step-card__body">
            <ul class="step-details">
              <li v-for="(item, index) in step.details" :key="index">
                <template v-for="(seg, i) in highlightSegments(item)" :key="i">
                  <span v-if="seg.strong" class="detail-strong">{{ seg.text }}</span>
                  <span v-else>{{ seg.text }}</span>
                </template>
              </li>
            </ul>
            <van-button
              :class="['step-action-btn', { 'is-done': step.completed }, { 'is-last-step': isLastStep(step) && !step.completed }]"
              :disabled="step.completed"
              block
              @click="markCompleted(step.id)"
            >
              {{ step.completed ? '已达成 ✅' : (isLastStep(step) ? '标记完成，查看采购清单' : '标记为完成') }}
            </van-button>
          </div>
        </div>
      </div>
    </main>

    <footer class="bottom-banner">
      <van-button block class="premium-btn" @click="generateShareImage">
        微信转发
      </van-button>
    </footer>

    <div id="shareCardContent" ref="shareCardRef" class="share-card-wrapper" aria-hidden="true">
      <div class="share-card">
        <div class="share-card__header">
          <div class="share-title">今日家庭午餐</div>
          <div class="share-date">{{ shareCardDate }}</div>
        </div>
        <div class="share-steps">
          <div class="share-steps__title">做菜步骤</div>
          <div v-for="step in steps" :key="`share-${step.id}`" class="share-step">
            <div class="share-step__name">{{ step.title }}</div>
            <ul class="share-step__details">
              <li v-for="(item, index) in step.details" :key="index">{{ item }}</li>
            </ul>
          </div>
        </div>
        <div class="share-footer__brand">TableSync</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showLoadingToast, showToast } from 'vant';
import html2canvas from 'html2canvas';
import { generateSteps } from '../data/menuData';

const STORAGE_PREFIX = 'tablesync_steps_completed_';

const router = useRouter();
const route = useRoute();

function getStepsQuery() {
  return {
    taste: route.query.taste,
    meat: route.query.meat,
    adultCount: Number(route.query.adultCount) || 2,
    babyMonth: Number(route.query.babyMonth) || 6,
    hasBaby: route.query.hasBaby === '1'
  };
}

const steps = reactive(generateSteps(getStepsQuery()));
const shareCardRef = ref(null);

function stepsStorageKey() {
  const q = getStepsQuery();
  return `${STORAGE_PREFIX}${q.taste}_${q.meat}_${q.babyMonth}_${q.adultCount}_${q.hasBaby}`;
}

function persistStepsCompleted() {
  try {
    const payload = steps.map((s) => ({ id: s.id, completed: s.completed }));
    localStorage.setItem(stepsStorageKey(), JSON.stringify(payload));
  } catch (_) {}
}

function restoreStepsCompleted() {
  try {
    const raw = localStorage.getItem(stepsStorageKey());
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    arr.forEach((item) => {
      const step = steps.find((s) => s.id === item.id);
      if (step && item.completed) step.completed = true;
    });
  } catch (_) {}
}

onMounted(() => {
  restoreStepsCompleted();
});

const lastStepId = computed(() =>
  steps.length > 0 ? steps[steps.length - 1].id : null
);

function isLastStep(step) {
  return step && lastStepId.value !== null && step.id === lastStepId.value;
}

const completedCount = computed(() => steps.filter((s) => s.completed).length);

const progressPercentage = computed(() =>
  steps.length === 0 ? 0 : Math.round((completedCount.value / steps.length) * 100)
);

const currentStepLabel = computed(() => {
  const n = steps.length;
  const x = n === 0 ? 0 : Math.min(completedCount.value + 1, n);
  return `第 ${x}/${n} 步`;
});

const shareCardDate = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
});

/** 核心动作词，用于在步骤详情中加粗 */
const KEY_ACTIONS = ['下锅', '打泥', '切', '炒', '煮', '蒸', '煎', '搅拌', '焯水', '腌制', '加盐', '装盘', '翻炒', '焖', '烤', '炖', '剁'];

/** 根据 step.role 或 step.title 推断成人餐/宝宝餐标签 */
function stepTag(step) {
  if (step.role === 'baby') return { type: 'success', text: '宝宝餐' };
  if (step.role === 'adult') return { type: 'primary', text: '成人餐' };
  if (step.role === 'both') return { type: 'primary', text: '成人+宝宝' };
  const t = (step.title || '').toString();
  if (/宝宝|辅食/.test(t)) return { type: 'success', text: '宝宝餐' };
  if (/成人|主菜/.test(t)) return { type: 'primary', text: '成人餐' };
  if (/联合|并行|分锅|收尾/.test(t)) return { type: 'primary', text: '成人+宝宝' };
  return { type: '', text: '' };
}

/** 将一句详情按核心动作拆成片段，带 strong 的片段用于加粗 */
function highlightSegments(text) {
  if (!text || typeof text !== 'string') return [{ text: String(text), strong: false }];
  const segments = [];
  const re = new RegExp(KEY_ACTIONS.join('|'), 'g');
  let lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, m.index), strong: false });
    }
    segments.push({ text: m[0], strong: true });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), strong: false });
  }
  return segments.length > 0 ? segments : [{ text, strong: false }];
}

function goBack() {
  router.back();
}

function buildShoppingListQuery() {
  const q = getStepsQuery();
  return {
    taste: q.taste,
    meat: q.meat,
    adultCount: q.adultCount,
    babyMonth: q.babyMonth,
    hasBaby: q.hasBaby ? '1' : '0'
  };
}

function markCompleted(id) {
  const step = steps.find((s) => s.id === id);
  if (!step) return;
  step.completed = true;
  persistStepsCompleted();
  if (isLastStep(step)) {
    router.push({
      name: 'ShoppingList',
      query: buildShoppingListQuery()
    });
  }
}

async function generateShareImage() {
  const toast = showLoadingToast({
    message: '正在生成转发卡片...',
    forbidClick: true,
    duration: 0
  });
  try {
    await nextTick();
    const element = shareCardRef.value;
    if (!element) {
      throw new Error('shareCardContent missing');
    }
    const canvas = await html2canvas(element, {
      useCORS: true,
      scale: 2,
      backgroundColor: '#fdf8f2'
    });
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = '今日家庭午餐-做菜步骤.png';
    link.click();
    showToast({ message: '已生成图片，可长按或下载保存' });
  } catch (error) {
    showToast({ type: 'fail', message: '生成失败，请重试' });
  } finally {
    toast.close();
  }
}
</script>

<style scoped>
.steps-container {
  min-height: 100vh;
  background-color: #fdf8f2;
  padding-bottom: env(safe-area-inset-bottom);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.page-content {
  padding: 16px 16px 96px;
}

.progress-block {
  padding: 16px 20px;
  background: #fff;
  border-radius: 16px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
  margin: 0 16px 16px;
}

.progress-label {
  font-size: 14px;
  color: #5a544f;
  margin: 10px 0 0;
  text-align: center;
  line-height: 1.5;
}

.steps-list {
  margin-top: 0;
}

.step-image {
  width: 100%;
  max-height: 22vh;
  object-fit: cover;
  border-radius: 8px;
}

.step-card {
  background: #fff;
  border-radius: 20px;
  margin: 10px 3vw;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(74, 69, 64, 0.06);
  overflow: hidden;
  transition: all 0.3s ease;
}

.step-card.completed {
  opacity: 0.6;
  transform: scale(0.98);
}

.step-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.step-card__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.step-card__title {
  font-weight: 700;
  color: #1a1a1a;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-size: 14px;
  line-height: 1.5;
}

.role-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 3px 8px;
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

.step-card__meta {
  font-size: 14px;
  color: #8e857e;
  line-height: 1.5;
  flex-shrink: 0;
}

.step-card__done {
  color: #4a5d4e;
}

.step-card__body {
  padding: 0;
}

.step-details {
  margin: 0 0 16px;
  padding-left: 18px;
  color: #5a544f;
  font-size: 14px;
  line-height: 1.5;
}

.step-details li {
  margin-bottom: 8px;
}

.step-card__body .detail-strong {
  font-weight: 600;
  color: #1a1a1a;
}

.step-action-btn {
  height: 44px !important;
  border-radius: 8px !important;
  font-weight: 600 !important;
  border: none !important;
  background: #2d2d2d !important;
  color: #fff !important;
}

.step-action-btn.is-done {
  background: #efe9e2 !important;
  color: #5a544f !important;
}

.step-action-btn.is-last-step {
  background: #07c160 !important;
  color: #fff !important;
}

.share-card-wrapper {
  position: fixed;
  left: -9999px;
  top: 0;
  width: 320px;
  z-index: -1;
}

.share-card {
  background: #fdf8f2;
  border-radius: 20px;
  padding: 20px 18px;
  color: #2d2d2d;
  font-size: 13px;
  line-height: 1.55;
  border: 1px solid #f0ede9;
}

.share-card__header {
  margin-bottom: 12px;
}

.share-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
}

.share-date {
  font-size: 12px;
  color: #8e857e;
  margin-top: 4px;
}

.share-steps {
  margin-top: 10px;
}

.share-steps__title {
  font-size: 12px;
  color: #8e857e;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.share-step {
  margin-bottom: 10px;
}

.share-step__name {
  font-size: 12px;
  font-weight: 600;
  color: #1a1a1a;
}

.share-step__details {
  margin: 4px 0 0;
  padding-left: 16px;
  color: #6f6861;
  line-height: 1.55;
  font-size: 12px;
}

.share-footer__brand {
  margin-top: 12px;
  text-align: right;
  font-size: 10px;
  letter-spacing: 1px;
  color: #b2aba4;
  text-transform: uppercase;
}
</style>

