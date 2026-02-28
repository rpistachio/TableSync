/**
 * 地域 → 菜系标签映射（IP 城市 / 许愿池标签 → cuisine key）
 * 用于 Omakase 地域文案与候选菜地域加权
 * 覆盖全国 + 港澳台 + 海外兜底（generic）
 */
var REGION_CUISINE_MAP = {
  cantonese: {
    tags: ['cantonese', 'steamed', 'soup'],
    label: '粤港',
    cities: ['香港', '广州', '深圳', '佛山', '东莞', '珠海', '澳门', '江门', '中山', '惠州']
  },
  sichuan: {
    tags: ['sichuan', 'spicy', 'numbing'],
    label: '川渝',
    cities: ['成都', '重庆', '绵阳', '乐山', '德阳', '宜宾', '自贡', '南充']
  },
  jiangzhe: {
    tags: ['jiangzhe', 'light', 'sweet'],
    label: '江浙',
    cities: ['上海', '杭州', '南京', '苏州', '宁波', '无锡', '绍兴', '嘉兴', '湖州', '常州', '南通']
  },
  dongbei: {
    tags: ['dongbei', 'hearty', 'salty_umami'],
    label: '东北',
    cities: ['哈尔滨', '沈阳', '长春', '大连', '吉林', '齐齐哈尔', '鞍山', '抚顺']
  },
  hunan: {
    tags: ['hunan', 'spicy'],
    label: '湖南',
    cities: ['长沙', '株洲', '湘潭', '衡阳', '岳阳', '常德']
  },
  hubei: {
    tags: ['hubei', 'salty_umami'],
    label: '湖北',
    cities: ['武汉', '宜昌', '襄阳', '荆州', '黄冈']
  },
  minyue: {
    tags: ['minyue', 'soup', 'steamed', 'light'],
    label: '闽粤',
    cities: ['福州', '厦门', '泉州', '漳州', '台北', '新北', '台中', '高雄', '台南', '基隆', '桃园', '内湖区', '板桥']
  },
  yungui: {
    tags: ['yungui', 'spicy', 'sour_fresh'],
    label: '云贵',
    cities: ['昆明', '贵阳', '大理', '丽江', '遵义', '曲靖', '六盘水']
  },
  xibei: {
    tags: ['xibei', 'hearty', 'salty_umami'],
    label: '西北',
    cities: ['西安', '兰州', '乌鲁木齐', '银川', '西宁', '呼和浩特', '拉萨', '宝鸡', '咸阳', '延安', '喀什', '伊犁']
  },
  huaiyang: {
    tags: ['huaiyang', 'salty_umami', 'comfort'],
    label: '淮扬',
    cities: ['合肥', '南京', '扬州', '济南', '郑州', '石家庄', '太原', '南昌', '徐州', '蚌埠', '开封', '洛阳']
  },
  generic: {
    tags: ['comfort', 'salty_umami'],
    label: '家常',
    cities: []
  }
};

var CITY_TO_CUISINE_KEY = {};
for (var key in REGION_CUISINE_MAP) {
  if (REGION_CUISINE_MAP.hasOwnProperty(key) && key !== 'generic') {
    var list = REGION_CUISINE_MAP[key].cities || [];
    for (var i = 0; i < list.length; i++) {
      CITY_TO_CUISINE_KEY[list[i]] = key;
    }
  }
}

/**
 * 根据城市名或省份名解析出 cuisine key
 * @param {string} city - 城市名
 * @param {string} [province] - 省份名
 * @returns {string} - 如 'cantonese'、'sichuan'，无匹配返回 'generic'
 */
function getCuisineKeyByCity(city, province) {
  if (typeof city === 'string' && city.trim()) {
    var c = city.trim();
    if (CITY_TO_CUISINE_KEY[c]) return CITY_TO_CUISINE_KEY[c];
  }
  if (typeof province === 'string' && province.trim()) {
    var p = province.trim();
    if (CITY_TO_CUISINE_KEY[p]) return CITY_TO_CUISINE_KEY[p];
    if (p.indexOf('广东') !== -1 || p.indexOf('香港') !== -1 || p.indexOf('澳门') !== -1) return 'cantonese';
    if (p.indexOf('四川') !== -1 || p.indexOf('重庆') !== -1) return 'sichuan';
    if (p.indexOf('浙江') !== -1 || p.indexOf('江苏') !== -1 || p.indexOf('上海') !== -1) return 'jiangzhe';
    if (p.indexOf('辽宁') !== -1 || p.indexOf('吉林') !== -1 || p.indexOf('黑龙江') !== -1) return 'dongbei';
    if (p.indexOf('湖南') !== -1) return 'hunan';
    if (p.indexOf('湖北') !== -1) return 'hubei';
    if (p.indexOf('福建') !== -1 || p.indexOf('台湾') !== -1) return 'minyue';
    if (p.indexOf('云南') !== -1 || p.indexOf('贵州') !== -1) return 'yungui';
    if (p.indexOf('陕西') !== -1 || p.indexOf('甘肃') !== -1 || p.indexOf('新疆') !== -1 || p.indexOf('宁夏') !== -1 || p.indexOf('青海') !== -1 || p.indexOf('内蒙古') !== -1 || p.indexOf('西藏') !== -1) return 'xibei';
    if (p.indexOf('安徽') !== -1 || p.indexOf('江西') !== -1 || p.indexOf('山东') !== -1 || p.indexOf('河南') !== -1 || p.indexOf('河北') !== -1 || p.indexOf('山西') !== -1) return 'huaiyang';
  }
  return 'generic';
}

/**
 * 根据 cuisine key 取标签列表（用于候选菜加权）
 * @param {string} cuisineKey
 * @returns {Array<string>}
 */
function getTagsByCuisineKey(cuisineKey) {
  var entry = REGION_CUISINE_MAP[cuisineKey];
  return (entry && entry.tags) ? entry.tags.slice() : REGION_CUISINE_MAP.generic ? REGION_CUISINE_MAP.generic.tags.slice() : ['comfort', 'salty_umami'];
}

/**
 * 根据 cuisine key 取展示标签
 * @param {string} cuisineKey
 * @returns {string}
 */
function getLabelByCuisineKey(cuisineKey) {
  var entry = REGION_CUISINE_MAP[cuisineKey];
  return (entry && entry.label) ? entry.label : cuisineKey || '家常';
}

module.exports = {
  REGION_CUISINE_MAP: REGION_CUISINE_MAP,
  CITY_TO_CUISINE_KEY: CITY_TO_CUISINE_KEY,
  getCuisineKeyByCity: getCuisineKeyByCity,
  getTagsByCuisineKey: getTagsByCuisineKey,
  getLabelByCuisineKey: getLabelByCuisineKey
};
