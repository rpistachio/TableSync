/**
 * 将原始步骤文案转换为 { phase, action, desc, syncTag? }，供 recipes 数据结构使用
 * Phase: 1=Prep, 2=Marinate, 3=Cook, 4=Finish
 * SyncTag: steamer | pot | wok（用于后续并行烹饪）
 */
export function toStepObject(desc) {
  const s = String(desc);
  let phase = 3;
  let action = 'cook';

  if (/撒上|淋油|装盘|打成泥|腌制5分钟即可/.test(s)) {
    phase = 4;
    action = 'finish';
  } else if (/蒸|煮|炖|炒|焖|下锅/.test(s)) {
    phase = 3;
    action = 'cook';
  } else if (/腌制|拌匀|混合/.test(s)) {
    phase = 2;
    action = 'marinate';
  } else if (/洗|切|准备|去骨|掰成|拍碎|切块|切片|切丁|切段|切末|焯水/.test(s)) {
    phase = 1;
    action = 'prep';
  }

  let syncTag;
  if (/蒸/.test(s)) syncTag = 'steamer';
  else if (/汤|煮|炖/.test(s)) syncTag = 'pot';
  else if (/炒|煎/.test(s)) syncTag = 'wok';

  return { phase, action, desc: s, ...(syncTag && { syncTag }) };
}

/** 从 step 对象或字符串取文案（兼容旧数据） */
export function stepDesc(step) {
  return step && typeof step === 'object' && step.desc != null ? step.desc : String(step);
}
