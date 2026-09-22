/* ================================================================================
   设计系统配色校验脚本（判定标准的可执行版本）
   --------------------------------------------------------------------------------
   判定标准：WCAG 2.1 相对亮度对比度算法，目标等级 AA
   可读阈值：
     - 正文 / 状态文字（含压在同色 tint 底上）        >= 4.5 : 1
     - 大字号文字（>=24px 或 >=18.5px bold）/ 图形边界 >= 3   : 1
     - 白字压品牌徽章/图表填充段：浅色主题 >= 4.5:1；
       深色主题为霓虹品牌表达层，允许 >= 3:1（图形级）
   数据来源：直接解析 frontend-user/css/variables.css 的两套主题令牌，与线上样式零漂移
   运行：node scripts/verify-contrast.js
   ================================================================================ */

const fs = require('fs');
const path = require('path');

const VARIABLES_CSS = path.join(__dirname, '..', 'frontend-user', 'css', 'variables.css');

// ---------- CSS 令牌解析 ----------
function extractBlock(css, selector) {
    // 按行首选择器匹配，避免命中注释中的同名文本
    const pattern = new RegExp('^\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{', 'm');
    const match = pattern.exec(css);
    if (!match) throw new Error(`未找到选择器: ${selector}`);
    const open = css.indexOf('{', match.index);
    let depth = 0;
    for (let i = open; i < css.length; i++) {
        if (css[i] === '{') depth++;
        if (css[i] === '}') {
            depth--;
            if (depth === 0) return css.slice(open + 1, i);
        }
    }
    throw new Error(`选择器 ${selector} 缺少闭合括号`);
}

function parseDeclarations(block) {
    const map = {};
    // 先剥离块内注释，避免干扰声明解析
    block.replace(/\/\*[\s\S]*?\*\//g, '').split(';').forEach(decl => {
        const idx = decl.indexOf(':');
        if (idx === -1) return;
        const name = decl.slice(0, idx).trim();
        const value = decl.slice(idx + 1).trim();
        if (name.startsWith('--')) map[name] = value;
    });
    return map;
}

// 递归解析 var(--x) 引用
function resolveValue(name, map, seen = new Set()) {
    if (seen.has(name)) throw new Error(`令牌循环引用: ${name}`);
    seen.add(name);
    const raw = map[name];
    if (raw === undefined) throw new Error(`未定义的令牌: ${name}`);
    return raw.replace(/var\((--[\w-]+)\)/g, (_, ref) => resolveValue(ref, map, new Set(seen)));
}

// 将令牌值解析为颜色：#hex 或 rgba(r, g, b, a)
function asColor(name, map) {
    const value = resolveValue(name, map);
    const hexMatch = value.match(/^#([0-9a-fA-F]{6})$/);
    if (hexMatch) return { rgb: hexToRgb(hexMatch[1]), alpha: 1, raw: value };
    const rgbaMatch = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (rgbaMatch) {
        return {
            rgb: [+rgbaMatch[1], +rgbaMatch[2], +rgbaMatch[3]],
            alpha: rgbaMatch[4] === undefined ? 1 : +rgbaMatch[4],
            raw: value
        };
    }
    throw new Error(`无法解析为颜色: ${name} = ${value}`);
}

// ---------- WCAG 2.1 对比度算法 ----------
function hexToRgb(hex) {
    return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
    ];
}

function channelLuminance(c) {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]) {
    return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrast(rgbA, rgbB) {
    const la = luminance(rgbA);
    const lb = luminance(rgbB);
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
}

// 半透明前景叠到底色后的有效颜色
function blend(fg, alpha, bg) {
    return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
}

// ---------- 校验 ----------
const AA_TEXT = 4.5;   // 正文 / 状态文字
const AA_GRAPHIC = 3.0; // 大字号 / 图形 / 深色主题品牌徽章

let failures = 0;

function check(themeName, label, fgRgb, bgRgb, threshold, note) {
    const ratio = contrast(fgRgb, bgRgb);
    const pass = ratio >= threshold;
    if (!pass) failures++;
    const mark = pass ? 'PASS' : 'FAIL';
    const extra = note ? `  (${note})` : '';
    console.log(`${mark}  [${themeName}] ${label.padEnd(36)} ${ratio.toFixed(2).padStart(5)}:1  阈值 ${threshold}:1${extra}`);
}

// 解析颜色令牌并叠到指定底色上
function on(name, map, bgRgb) {
    const c = asColor(name, map);
    return c.alpha === 1 ? c.rgb : blend(c.rgb, c.alpha, bgRgb);
}

function checkTheme(themeName, map, badgeThreshold) {
    console.log(`\n===== ${themeName} =====`);

    const bg = asColor('--bg-dark', map).rgb;
    const card = on('--bg-card', map, bg); // 玻璃卡片有效色

    // 1. 文字色（页面背景 / 卡片背景）
    ['--text-primary', '--text-secondary', '--text-muted'].forEach(t => {
        check(themeName, `${t} / 页面背景`, asColor(t, map).rgb, bg, AA_TEXT);
        check(themeName, `${t} / 卡片背景`, asColor(t, map).rgb, card, AA_TEXT);
    });

    // 2. 状态色（页面背景 / 卡片背景 / 同色 tint 底）
    ['--success', '--warning', '--error', '--info'].forEach(t => {
        const rgb = asColor(t, map).rgb;
        check(themeName, `${t} / 页面背景`, rgb, bg, AA_TEXT);
        check(themeName, `${t} / 卡片背景`, rgb, card, AA_TEXT);
        const tint = on(t + '-tint', map, card);
        check(themeName, `${t} / 同色tint底`, rgb, tint, AA_TEXT);
    });

    // 3. 霓虹强调色（标签、链接、数值等文字用途）
    ['--neon-purple', '--neon-pink', '--neon-cyan', '--neon-green'].forEach(t => {
        check(themeName, `${t} / 卡片背景`, asColor(t, map).rgb, card, AA_TEXT);
    });
    // 链接 hover 态
    check(themeName, '--neon-cyan-light(hover) / 卡片', asColor('--neon-cyan-light', map).rgb, card, AA_TEXT);

    // 4. 白字压徽章/按钮底色
    const white = [255, 255, 255];
    ['--tag-current-from', '--tag-current-to', '--tag-target-from', '--tag-target-to', '--neon-purple', '--neon-pink'].forEach(t => {
        check(themeName, `白字 / ${t}`, white, asColor(t, map).rgb, badgeThreshold);
    });

    // 5. 图表：漏斗段内白字（段色为半透明，需先叠到卡片底色）
    for (let i = 1; i <= 5; i++) {
        const seg = on(`--chart-funnel-${i}`, map, card);
        check(themeName, `白字 / 漏斗段${i}`, white, seg, badgeThreshold);
    }
    // 6. 图表：雷达系列线（非文本图形，阈值 3:1）
    check(themeName, '雷达-现状线 / 卡片', asColor('--chart-radar-current', map).rgb, card, AA_GRAPHIC);
    check(themeName, '雷达-标杆线 / 卡片', asColor('--chart-radar-benchmark', map).rgb, card, AA_GRAPHIC);
    // 7. 图表：坐标文字 / 提示框文字
    check(themeName, '图表坐标文字 / 卡片', asColor('--chart-axis-text', map).rgb, card, AA_TEXT);
    check(themeName, '提示框文字 / 提示框底', asColor('--chart-tooltip-text', map).rgb, on('--chart-tooltip-bg', map, bg), AA_TEXT);

    // 8. 矩阵表头：副标题文字压表头 tint 底（取渐变第一色 stop 近似）
    const theadGradient = resolveValue('--matrix-thead-bg', map);
    const firstStop = theadGradient.match(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)/);
    if (firstStop) {
        const stop = firstStop[0].match(/[\d.]+/g).map(Number);
        const theadBg = blend(stop.slice(0, 3), stop.length > 3 ? stop[3] : 1, card);
        check(themeName, '矩阵表头副标题 / 表头底', asColor('--phase-subtitle', map).rgb, theadBg, AA_TEXT);
    }
}

// ---------- 主流程 ----------
const css = fs.readFileSync(VARIABLES_CSS, 'utf8');
const darkMap = parseDeclarations(extractBlock(css, ':root'));
const lightMap = parseDeclarations(extractBlock(css, '[data-theme="light"]'));

// 浅色主题未覆盖的令牌回退到 :root（如 --chart-label-on-fill）
const lightFull = Object.assign({}, darkMap, lightMap);

checkTheme('深色主题（默认·霓虹）', darkMap, AA_GRAPHIC);
checkTheme('浅色主题', lightFull, AA_TEXT);

console.log('\n' + '='.repeat(60));
if (failures === 0) {
    console.log('✅ 全部通过：两套主题的文字色与状态色均达到设计系统可读阈值');
} else {
    console.log(`❌ ${failures} 项未达标，请调整 variables.css 中的对应令牌`);
}
process.exit(failures === 0 ? 0 : 1);
