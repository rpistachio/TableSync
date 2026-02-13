/**
 * cooking-loading 组件
 * 全屏「食材炒锅」趣味等待动画：食材飘落入锅 + 锅铲翻炒 + 趣味文案轮播
 * 素材使用本地 png_pics/elements_waiting_page/ 下的 PNG
 */
var LOCAL_BASE = '/png_pics/elements_waiting_page';

// 本地文件名（与 png_pics/elements_waiting_page/ 内一致）
var ASSET_NAMES = {
  pot: 'pot.png',
  spatula: 'steamer.png',
  tomato: 'tomato.png',
  cucumber: 'cucumber.png',
  egg: 'egg.png',
  veggie: 'veggie.png'
};

/* 仅 4 个食材以减轻渲染与动画压力 */
var INGREDIENT_KEYS = ['tomato', 'cucumber', 'egg', 'veggie'];
var INGREDIENT_DELAYS = [0, 400, 800, 1200];

var LOADING_TEXTS = [
  '食材正在排队上锅...',
  '大厨正在翻炒灵感...',
  '锅铲已就位，开始创作...',
  '蔬菜和肉在讨论谁先下锅...',
  '今天的菜单正在酝酿中...',
  '调味料们正在开会...'
];

Component({
  properties: {
    visible: { type: Boolean, value: false }
  },

  data: (function () {
    var potUrl = LOCAL_BASE + '/' + ASSET_NAMES.pot;
    var spatulaUrl = LOCAL_BASE + '/' + ASSET_NAMES.spatula;
    var ingredients = INGREDIENT_KEYS.map(function (name, i) {
      return {
        name: name,
        url: LOCAL_BASE + '/' + (ASSET_NAMES[name] || name + '.png'),
        delay: INGREDIENT_DELAYS[i]
      };
    });
    return {
      potUrl: potUrl,
      spatulaUrl: spatulaUrl,
      ingredients: ingredients,
      loadingText: LOADING_TEXTS[0],
      textIndex: 0
    };
  })(),

  observers: {
    visible: function (visible) {
      if (visible) {
        this._startTextRotation();
      } else {
        this._stopTextRotation();
      }
    }
  },

  methods: {
    _startTextRotation: function () {
      this._stopTextRotation();
      var that = this;
      /* 3.5s 切换一次，减少 setData 频率 */
      this._textTimer = setInterval(function () {
        var idx = (that.data.textIndex + 1) % LOADING_TEXTS.length;
        that.setData({ textIndex: idx, loadingText: LOADING_TEXTS[idx] });
      }, 3500);
    },

    _stopTextRotation: function () {
      if (this._textTimer) {
        clearInterval(this._textTimer);
        this._textTimer = null;
      }
    }
  },

  detached: function () {
    this._stopTextRotation();
  }
});
