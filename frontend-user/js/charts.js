/* ========================================
   图表组件
   - 调色板全部取自设计系统变量层（--chart-* 令牌）
   - 主题切换时通过 applyTheme() 重读令牌并重设 option，同步换色
   ======================================== */

// 从 CSS 变量读取当前主题图表调色板
function readChartPalette() {
    const styles = getComputedStyle(document.documentElement);
    const token = (name) => styles.getPropertyValue(name).trim();

    return {
        funnel: [
            token('--chart-funnel-1'),
            token('--chart-funnel-2'),
            token('--chart-funnel-3'),
            token('--chart-funnel-4'),
            token('--chart-funnel-5')
        ],
        funnelBorder: token('--chart-funnel-border'),
        funnelShadow: token('--chart-funnel-shadow'),
        funnelShadowHover: token('--chart-funnel-shadow-hover'),
        labelOnFill: token('--chart-label-on-fill'),
        radarCurrent: token('--chart-radar-current'),
        radarCurrentArea: token('--chart-radar-current-area'),
        radarBenchmark: token('--chart-radar-benchmark'),
        radarBenchmarkArea: token('--chart-radar-benchmark-area'),
        symbolBorder: token('--chart-symbol-border'),
        axisText: token('--chart-axis-text'),
        splitLine: token('--chart-split-line'),
        splitAreaA: token('--chart-split-area-a'),
        splitAreaB: token('--chart-split-area-b'),
        axisLine: token('--chart-axis-line'),
        tooltipBg: token('--chart-tooltip-bg'),
        tooltipBorder: token('--chart-tooltip-border'),
        tooltipText: token('--chart-tooltip-text')
    };
}

class ChartManager {
    constructor() {
        this.charts = {};
    }

    // 漏斗图配置（按当前主题调色板构建）
    buildFunnelOption(palette) {
        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c}%',
                backgroundColor: palette.tooltipBg,
                borderColor: palette.tooltipBorder,
                borderWidth: 1,
                textStyle: { color: palette.tooltipText },
                extraCssText: 'backdrop-filter: blur(10px); border-radius: 8px;'
            },
            series: [{
                type: 'funnel',
                left: '10%',
                right: '10%',
                top: '8%',
                bottom: '8%',
                width: '80%',
                min: 0,
                max: 100,
                minSize: '0%',
                maxSize: '100%',
                sort: 'descending',
                gap: 3,
                label: {
                    show: true,
                    position: 'inside',
                    formatter: '{b}\n{c}%',
                    color: palette.labelOnFill,
                    fontSize: 13,
                    fontWeight: 600,
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                },
                labelLine: { show: false },
                itemStyle: {
                    borderColor: palette.funnelBorder,
                    borderWidth: 2,
                    shadowBlur: 20,
                    shadowColor: palette.funnelShadow
                },
                emphasis: {
                    label: { fontSize: 15 },
                    itemStyle: {
                        shadowBlur: 30,
                        shadowColor: palette.funnelShadowHover
                    }
                },
                data: funnelData.map((item, index) => ({
                    value: item.value,
                    name: item.name,
                    itemStyle: { color: palette.funnel[index % palette.funnel.length] }
                }))
            }]
        };
    }

    // 雷达图配置（按当前主题调色板构建）
    buildRadarOption(palette) {
        // 系列配色语义：现状=状态色 error，标杆=霓虹绿，均取自变量层
        const seriesColors = [
            { line: palette.radarCurrent, area: palette.radarCurrentArea },
            { line: palette.radarBenchmark, area: palette.radarBenchmarkArea }
        ];

        return {
            backgroundColor: 'transparent',
            legend: {
                data: radarData.series.map(s => s.name),
                bottom: 0,
                textStyle: { color: palette.axisText, fontSize: 12 },
                itemWidth: 16,
                itemHeight: 10,
                itemGap: 20
            },
            tooltip: {
                trigger: 'item',
                backgroundColor: palette.tooltipBg,
                borderColor: palette.tooltipBorder,
                borderWidth: 1,
                textStyle: { color: palette.tooltipText },
                extraCssText: 'backdrop-filter: blur(10px); border-radius: 8px;'
            },
            radar: {
                indicator: radarData.indicators,
                shape: 'polygon',
                splitNumber: 4,
                center: ['50%', '48%'],
                radius: '65%',
                axisName: {
                    color: palette.axisText,
                    fontSize: 12,
                    fontWeight: 500
                },
                splitLine: {
                    lineStyle: {
                        color: palette.splitLine,
                        width: 1
                    }
                },
                splitArea: {
                    areaStyle: {
                        color: [palette.splitAreaA, palette.splitAreaB]
                    }
                },
                axisLine: {
                    lineStyle: {
                        color: palette.axisLine
                    }
                }
            },
            series: [{
                type: 'radar',
                data: radarData.series.map((s, index) => {
                    const color = seriesColors[index % seriesColors.length];
                    return {
                        value: s.value,
                        name: s.name,
                        symbol: 'circle',
                        symbolSize: 8,
                        lineStyle: {
                            color: color.line,
                            width: 2,
                            shadowBlur: 10,
                            shadowColor: color.line
                        },
                        areaStyle: { color: color.area },
                        itemStyle: {
                            color: color.line,
                            borderColor: palette.symbolBorder,
                            borderWidth: 2
                        }
                    };
                })
            }]
        };
    }

    // 初始化漏斗图
    initFunnelChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const chart = echarts.init(container);
        this.charts.funnel = chart;

        chart.setOption(this.buildFunnelOption(readChartPalette()));

        // 点击事件
        chart.on('click', (params) => {
            window.toast.info('漏斗分析', `${params.name}: 转化率 ${params.value}%`);
        });

        return chart;
    }

    // 初始化雷达图
    initRadarChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const chart = echarts.init(container);
        this.charts.radar = chart;

        chart.setOption(this.buildRadarOption(readChartPalette()));

        // 点击事件
        chart.on('click', (params) => {
            if (params.name) {
                window.toast.info('能力对比', `${params.seriesName}: ${params.name}`);
            }
        });

        return chart;
    }

    // 主题切换时同步换色：重读变量层令牌，整体重设 option
    applyTheme() {
        const palette = readChartPalette();

        if (this.charts.funnel) {
            this.charts.funnel.setOption(this.buildFunnelOption(palette), true);
        }
        if (this.charts.radar) {
            this.charts.radar.setOption(this.buildRadarOption(palette), true);
        }
    }

    // 响应式调整
    resize() {
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.resize) {
                chart.resize();
            }
        });
    }

    // 销毁图表
    dispose() {
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.dispose) {
                chart.dispose();
            }
        });
        this.charts = {};
    }
}

// 创建全局实例
window.chartManager = new ChartManager();
