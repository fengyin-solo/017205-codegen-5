/* ========================================
   主题管理器 - 深 / 浅配色方案切换
   - 主题令牌统一定义在 css/variables.css
   - 选择持久化到 localStorage，刷新后保持
   - 首屏前由 index.html 内联脚本提前设置 data-theme，避免闪烁
   ======================================== */

class ThemeManager {
    constructor() {
        this.STORAGE_KEY = 'kabrita-dashboard-theme';
        this.THEMES = {
            dark: {
                label: '深色霓虹',
                metaColor: '#0a0a0f'
            },
            light: {
                label: '浅色霓虹',
                metaColor: '#eceef6'
            }
        };
        this.defaultTheme = 'dark';
        this.theme = this.resolveInitialTheme();
        this.listeners = [];
    }

    // 读取初始主题（localStorage 优先，兜底系统偏好，再兜底深色品牌基线）
    resolveInitialTheme() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved && this.THEMES[saved]) return saved;
        } catch (e) { /* 隐私模式等场景静默兜底 */ }

        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return this.defaultTheme;
    }

    init() {
        // <html data-theme> 已由内联脚本设置，这里只做兜底校正
        this.applyTheme(this.theme, { silent: true });

        this.bindToggle();

        // 跟随系统主题（仅当用户未手动选择过时）
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
                let saved = null;
                try { saved = localStorage.getItem(this.STORAGE_KEY); } catch (err) { /* noop */ }
                if (!saved) {
                    this.setTheme(e.matches ? 'light' : 'dark', { persist: false });
                }
            });
        }
    }

    bindToggle() {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;
        toggle.addEventListener('click', () => {
            this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
        });
    }

    getTheme() {
        return this.theme;
    }

    isLight() {
        return this.theme === 'light';
    }

    setTheme(theme, options = {}) {
        const { persist = true, notify = true } = options;
        if (!this.THEMES[theme] || theme === this.theme) {
            // 即便相同也保证 DOM 属性正确
            this.applyTheme(theme || this.theme, { silent: !notify });
            return;
        }
        this.theme = theme;

        if (persist) {
            try { localStorage.setItem(this.STORAGE_KEY, theme); } catch (e) { /* noop */ }
        }

        this.applyTheme(theme);
    }

    applyTheme(theme, { silent = false } = {}) {
        if (!this.THEMES[theme]) theme = this.defaultTheme;
        this.theme = theme;

        document.documentElement.setAttribute('data-theme', theme);

        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', this.THEMES[theme].metaColor);

        this.updateToggleLabel();

        if (!silent) {
            this.listeners.forEach(fn => {
                try { fn(theme); } catch (e) { console.error('theme listener error', e); }
            });
        }
    }

    updateToggleLabel() {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;
        const next = this.theme === 'dark' ? 'light' : 'dark';
        toggle.setAttribute('aria-label', `切换到${this.THEMES[next].label}主题`);
        toggle.setAttribute('title', `切换到${this.THEMES[next].label}主题（当前：${this.THEMES[this.theme].label}）`);
        toggle.setAttribute('aria-pressed', this.theme === 'light' ? 'true' : 'false');
    }

    // 主题切换事件订阅（图表重绘、粒子重建等使用）
    onChange(fn) {
        if (typeof fn === 'function') this.listeners.push(fn);
    }

    // 读取当前主题下的 CSS 变量计算值
    getVar(name) {
        const raw = name.startsWith('--') ? name : `--${name}`;
        return getComputedStyle(document.documentElement).getPropertyValue(raw).trim();
    }

    // 读取粒子色板（供组件层重建粒子）
    getParticleColors() {
        return [
            this.getVar('--particle-1'),
            this.getVar('--particle-2'),
            this.getVar('--particle-3'),
            this.getVar('--particle-4')
        ];
    }
}

// 创建全局实例
window.themeManager = new ThemeManager();
