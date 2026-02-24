const fs = require('fs');
const path = require('path');

// 模拟 wx 对象
global.wx = {
  getStorageSync: () => {},
  setStorageSync: () => {}
};

// 引入 recipes.js
const recipesPath = path.join(__dirname, '../miniprogram/data/recipes.js');
const recipesModule = require(recipesPath);
const recipes = recipesModule.adultRecipes;

console.log(`Loaded ${recipes.length} recipes.`);

// 定义校验规则
const TIME_RULES = [
  {
    keywords: ['鸡翅', '鸡腿', '鸡块', '鸡肉'],
    cookType: ['steam', 'stew'],
    minTime: 15,
    msg: '禽类带骨肉蒸煮建议不少于15分钟'
  },
  {
    keywords: ['排骨', '猪蹄'],
    cookType: ['stew'],
    minTime: 30,
    msg: '排骨炖煮时间过短'
  },
  {
    keywords: ['鱼'],
    cookType: ['steam'],
    maxTime: 15,
    msg: '清蒸鱼类时间过长'
  }
];

function validate(recipe) {
  const warnings = [];
  const name = recipe.name || '';
  const cookType = recipe.cook_type || '';
  const duration = recipe.cook_minutes || 0;
  const meat = recipe.meat || 'vegetable';

  // 1. 特定食材规则
  TIME_RULES.forEach(rule => {
    const hasIngredient = rule.keywords.some(k => name.includes(k));
    const isCookTypeMatch = rule.cookType.includes(cookType);

    if (hasIngredient && isCookTypeMatch) {
      if (rule.minTime && duration < rule.minTime) {
        warnings.push({
          rule: rule.msg,
          expected: `>= ${rule.minTime}`,
          actual: duration,
          fixValue: rule.minTime
        });
      }
      if (rule.maxTime && duration > rule.maxTime) {
        warnings.push({
          rule: rule.msg,
          expected: `<= ${rule.maxTime}`,
          actual: duration,
          fixValue: rule.maxTime
        });
      }
    }
  });

  // 2. 通用规则：炖煮时间
  if (cookType === 'stew' && duration < 30) {
    if (!warnings.some(w => w.rule.includes('炖煮'))) {
      warnings.push({
        rule: '通用：炖煮类菜谱建议不少于30分钟',
        expected: '>= 30',
        actual: duration,
        fixValue: 30
      });
    }
  }

  // 3. 通用规则：肉类蒸菜
  if (cookType === 'steam' && meat !== 'vegetable' && duration < 10) {
    if (!warnings.some(w => w.rule.includes('蒸'))) {
      warnings.push({
        rule: '通用：肉类蒸菜建议不少于10分钟',
        expected: '>= 10',
        actual: duration,
        fixValue: 10
      });
    }
  }

  return warnings;
}

const issues = [];

recipes.forEach(r => {
  const warnings = validate(r);
  if (warnings.length > 0) {
    issues.push({
      id: r.id,
      name: r.name,
      warnings: warnings,
      suggestedFix: {
        cook_minutes: warnings[0].fixValue
      }
    });
  }
});

console.log(`Found ${issues.length} recipes with issues.`);

if (issues.length > 0) {
  console.log('--- Issues List ---');
  issues.forEach(issue => {
    console.log(`[${issue.id}] ${issue.name}`);
    issue.warnings.forEach(w => {
      console.log(`  - ${w.rule}: Actual ${w.actual}m, Expected ${w.expected}m`);
    });
    console.log(`  => Suggestion: Change cook_minutes to ${issue.suggestedFix.cook_minutes}`);
  });
  
  console.log('\n--- Generating Fix Script ---');
  console.log('// You can use this to patch the data:');
  console.log('const patches = {');
  issues.forEach(issue => {
    console.log(`  '${issue.id}': { cook_minutes: ${issue.suggestedFix.cook_minutes} }, // ${issue.name}`);
  });
  console.log('};');
} else {
  console.log('No issues found with current rules.');
}
