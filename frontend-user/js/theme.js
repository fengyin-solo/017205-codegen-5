/* ========================================
   主题管理器 - 深浅配色方案切换
   - 切换结果写入 localStorage，刷新后保持
   - 切换时联动 ECharts 图表换色（chartManager.applyTheme）
   - 首绘防闪烁由 index.html 内联脚本负责
   ======================================== */

class ThemeManager {
    constructor() {
        this.storageKey = 'dashboard-theme';
        this.themes = ['dark', 'light'];
        // 与 variables.css 中两套 --bg-dark 保持一致，用于 meta theme-color
        this.metaThemeColor = { dark: '#0a0a0f', light: '#eef0f8' };
        this.theme = this.readInitialTheme();
    }

    // 读取初始主题：localStorage 优先，缺省为深色（保持原有霓虹观感）
    readInitialTheme() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (this.themes.includes(saved)) return saved;
        } catch (e) {
            // 隐私模式等场景下 localStorage 不可用，静默回退
        }
        const attr = document.documentElement.getAttribute('data-theme');
        return this.themes.includes(attr) ? attr : 'dark';
    }

    init() {
        this.applyTheme(this.theme);

        const toggle = document.getElementById('themeToggle');
        if (toggle) {
            toggle.addEventListener('click', () => this.toggle());
        }

        // 多标签页同步：其他标签页切换后本页跟随
        window.addEventListener('storage', (e) => {
            if (e.key === this.storageKey && this.themes.includes(e.newValue)) {
                this.theme = e.newValue;
                this.applyTheme(this.theme);
            }
        });
    }

    toggle() {
        const next = this.theme === 'dark' ? 'light' : 'dark';
        this.setTheme(next);

        if (window.toast) {
            const label = next === 'light' ? '浅色模式' : '深色霓虹模式';
            window.toast.success('配色方案已切换', `当前：${label} · 刷新后保持`, 3000);
        }
    }

    setTheme(theme) {
        if (!this.themes.includes(theme)) return;
        this.theme = theme;
        try {
            localStorage.setItem(this.storageKey, theme);
        } catch (e) {
            // 写入失败不影响本次切换
        }
        this.applyTheme(theme);
    }

    // 应用主题：更新 data-theme 属性、meta theme-color、切换按钮、图表配色
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);

        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', this.metaThemeColor[theme] || this.metaThemeColor.dark);
        }

        this.updateToggle();

        // 图表同步换色：重读 CSS 变量调色板并重设 option
        if (window.chartManager && typeof window.chartManager.applyTheme === 'function') {
            window.chartManager.applyTheme();
        }

        document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }

    updateToggle() {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;

        const isDark = this.theme === 'dark';
        const icon = toggle.querySelector('.theme-toggle-icon');
        if (icon) {
            icon.textContent = isDark ? '🌙' : '☀️';
        }
        toggle.setAttribute('aria-pressed', String(!isDark));
        toggle.setAttribute('aria-label', isDark ? '切换到浅色配色方案' : '切换到深色霓虹配色方案');
        toggle.title = isDark ? '切换到浅色配色' : '切换到深色霓虹配色';
    }
}

// 创建全局实例
window.themeManager = new ThemeManager();
