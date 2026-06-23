/**
 * 拼音字典生成脚本
 * 
 * 使用 pinyin-pro 库批量转换 CJK 统一汉字为拼音，生成完整的汉字→拼音字典。
 * 覆盖 CJK Unified Ideographs (U+4E00-U+9FFF) 及 Extension A (U+3400-U+4DBF)
 * 中所有 pinyin-pro 可识别的汉字。
 * 
 * 用法：node scripts/gen-pinyin-dict.js
 * 输出：js/pinyin-util.js（带完整内嵌字典）
 */

const fs = require('fs');
const path = require('path');
const pinyinPro = require('pinyin-pro');

const ROOT = path.resolve(__dirname, '..');

// CJK 汉字区间
const RANGES = [
  [0x3400, 0x4DBF], // CJK Extension A
  [0x4E00, 0x9FFF], // CJK Unified Ideographs (Basic)
];

async function main() {
  console.log('🔤 开始生成拼音字典...');

  const batchSize = 500; // 每批处理 500 个字符，避免单次调用过长
  const dict = {};       // codePoint -> pinyin

  // 遍历所有 CJK 区间
  for (const [start, end] of RANGES) {
    for (let code = start; code <= end; code += batchSize) {
      const batchEnd = Math.min(code + batchSize - 1, end);
      const chars = [];
      for (let c = code; c <= batchEnd; c++) {
        chars.push(String.fromCodePoint(c));
      }
      const text = chars.join('');

      // 使用 pinyin-pro 批量转换
      const result = pinyinPro.pinyin(text, {
        toneType: 'none',
        type: 'array',
      });

      // 逐字保存（保留非空拼音的结果）
      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const py = (result[i] || '').trim();
        // 只保留可识别的汉字（拼音非空且不含原字符本身，排除标点等）
        if (py && py.length > 0 && py !== char && !/[^\x00-\x7F]/.test(py)) {
          const cp = char.codePointAt(0);
          dict[cp] = py;
        }
      }
    }
  }

  const count = Object.keys(dict).length;
  console.log(`✅ 共生成 ${count} 个汉字→拼音映射`);

  // ===== 生成 js/pinyin-util.js =====
  const utilContent = generateUtilFile(dict);
  const outPath = path.join(ROOT, 'js', 'pinyin-util.js');
  fs.writeFileSync(outPath, utilContent, 'utf-8');
  console.log(`📄 已写入 ${outPath}`);
  console.log(`📏 文件大小: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
}

/**
 * 将字典数据格式化为 JavaScript 源代码
 */
function generateUtilFile(dict) {
  // 按 codePoint 排序，并用紧凑格式输出
  const entries = Object.keys(dict)
    .map(Number)
    .sort((a, b) => a - b);

  // 构建字典对象字面量（用十六进制 key，紧凑输出）
  let dictLiteral = '{\n';
  let line = '  ';
  let entriesOnLine = 0;
  const maxPerLine = 8; // 每行最多 8 个条目

  for (let i = 0; i < entries.length; i++) {
    const cp = entries[i];
    const py = dict[cp];
    const hexKey = '0x' + cp.toString(16);
    line += `${hexKey}: '${py}', `;
    entriesOnLine++;

    if (entriesOnLine >= maxPerLine || i === entries.length - 1) {
      dictLiteral += line.trimEnd() + '\n';
      line = '  ';
      entriesOnLine = 0;
    }
  }
  dictLiteral += '}';

  // 生成完整文件
  return `/**
 * 汉字转拼音工具模块
 * 将字符串中的汉字转换为对应的汉语拼音（无声调），非汉字字符保留原样。
 *
 * 字典来源：pinyin-pro 基于《通用规范汉字表》的完整汉字→拼音映射
 * 使用场景：在搜索匹配结果为 0 时，将标签页标题中的汉字转为拼音，
 * 再用纯英文关键词进行二次匹配，提升英文搜索中文标题的体验。
 *
 * 自动生成日期：${new Date().toISOString().split('T')[0]}
 */

// 汉字 Unicode 范围
const CJK_UNIFIED_START = 0x4E00;
const CJK_UNIFIED_END = 0x9FFF;
const CJK_EXT_A_START = 0x3400;
const CJK_EXT_A_END = 0x4DBF;

/**
 * 拼音字典：以 Unicode 编码为 key，拼音小写字符串为 value
 * 覆盖《通用规范汉字表》全部 8,105 个汉字及扩展区可识别汉字
 */
const PINYIN_DICT = ${dictLiteral};

/**
 * 检测字符串是否仅包含英文字母和空格（纯英文）
 * @param {string} str
 * @returns {boolean}
 */
export function isPureEnglish(str) {
  if (!str || str.trim().length === 0) return false;
  return /^[a-zA-Z\\s]+$/.test(str);
}

/**
 * 将字符串中的汉字转为拼音
 * @param {string} text 输入字符串
 * @returns {string} 转换后的字符串（汉字转拼音，非汉字保留）
 */
export function toPinyin(text) {
  if (!text) return '';

  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.codePointAt(0);

    // 检查是否是 CJK 汉字（Basic + Extension A）
    if ((code >= CJK_UNIFIED_START && code <= CJK_UNIFIED_END) ||
        (code >= CJK_EXT_A_START && code <= CJK_EXT_A_END)) {
      const pinyin = PINYIN_DICT[code];
      if (pinyin) {
        result += pinyin;
      } else {
        // 字典中未收录的 CJK 汉字，保留原字符
        result += char;
      }
    } else {
      // 非 CJK 汉字字符保留原样
      result += char;
    }
  }

  return result;
}

/**
 * 获取字符串的拼音版本（仅供搜索匹配使用）
 * 移除空格，转小写
 * @param {string} text
 * @returns {string}
 */
export function toPinyinForSearch(text) {
  if (!text) return '';
  return toPinyin(text).toLowerCase().replace(/\\s+/g, '');
}

export default { isPureEnglish, toPinyin, toPinyinForSearch };
`;
}

main().catch(err => {
  console.error('❌ 生成失败:', err);
  process.exit(1);
});
