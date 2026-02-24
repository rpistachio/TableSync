基础风格（所有 Prompt 都需要包含）：
- professional food photography
- warm lighting, appetizing, inviting
- rich colors, cozy feel

变量占位：
- {{english_name}}  英文菜名（如 Ginseng and Astragalus Black Chicken Soup）
- {{chinese_name}}  中文菜名
- {{container}}     容器描述（按品类自动推断）
- {{atmosphere}}    氛围描述（按品类动态注入，热菜加蒸气，凉菜强调清新等）

模版 A（俯拍）：
`{{english_name}}, {{chinese_name}}, {{container}}, {{atmosphere}}, top-down view, professional food photography, warm ambient lighting, appetizing, rich colors, inviting, cozy`

模版 B（45 度）：
`{{english_name}}, {{chinese_name}}, {{container}}, {{atmosphere}}, 45-degree angle, soft warm side lighting, appetizing, rich colors, inviting, professional food photography, shallow depth of field`

模版 C（近景浅景深）：
`{{english_name}}, {{chinese_name}}, {{container}}, {{atmosphere}}, macro food photography, close-up focus on sauce gloss and ingredient texture, shallow depth of field, warm lighting, appetizing, rich colors, inviting, professional food photography`

