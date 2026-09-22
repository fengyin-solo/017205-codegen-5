/* ========================================
   图表组件
   颜色全部取自 CSS 主题令牌（--chart-*），主题切换后整图重绘，
   不残留任何旧主题色：setOption(notMerge=true) 全量替换。
   ======================================== */

class ChartManager {
    constructor() {
        this.charts = {};
        this.initialized = false;
    }

    // 从当前主题令牌读取图表配色
    palette() {
        const v = (name) => window.themeManager.getVar(name);
        return {
            tooltipBg: v('--chart-tooltip-bg'),
            tooltipBorder: v('--chart-tooltip-border'),
            tooltipText: v('--chart-tooltip-text'),
            legendText: v('--chart-legend-text'),
            axisName: v('--chart-axis-name'),
            splitLine: v('--chart-split-line'),
            splitAreaA: v('--chart-split-area-a'),
            splitAreaB: v('--chart-split-area-b'),
            axisLine: v('--chart-axis-line'),
            funnelBorder: v('--chart-funnel-border'),
            funnelShadow: v('--chart-funnel-shadow'),
            funnelShadowEmphasis: v('--chart-funnel-shadow-emphasis'),
            funnel: [
                v('--chart-funnel-1'),
                v('--chart-funnel-2'),
                v('--chart-funnel-3'),
                v('--chart-funnel-4'),
                v('--chart-funnel-5')
            ],
            radarCurrent: v('--chart-radar-current'),
            radarCurrentArea: v('--chart-radar-current-area'),
            radarBenchmark: v('--chart-radar-benchmark'),
            radarBenchmarkArea: v('--chart-radar-benchmark-area'),
            pointBorder: v('--chart-point-border'),
            labelOnColor: v('--chart-label-on-color'),
            labelOnShadow: v('--chart-label-on-shadow')
        };
    }

    tooltipBase(p) {
        return {
            backgroundColor: p.tooltipBg,
            borderColor: p.tooltipBorder,
            borderWidth: 1,
            textStyle: { color: p.tooltipText },
            extraCssText: 'backdrop-filter: blur(10px); border-radius: 8px;'
        };
    }

    // 初始化漏斗图
    initFunnelChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const chart = echarts.init(container);
        this.charts.funnel = chart;
        this.updateFunnelChart();

        // 点击事件
        chart.on('click', (params) => {
            window.toast.info('漏斗分析', `${params.name}: 转化率 ${params.value}%`);
        });

        return chart;
    }

    updateFunnelChart() {
        const chart = this.charts.funnel;
        if (!chart) return;
        const p = this.palette();

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c}%',
                ...this.tooltipBase(p)
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
                    color: p.labelOnColor,
                    fontSize: 13,
                    fontWeight: 600,
                    textShadow: p.labelOnShadow
                },
                labelLine: { show: false },
                itemStyle: {
                    borderColor: p.funnelBorder,
                    borderWidth: 2,
                    shadowBlur: 20,
                    shadowColor: p.funnelShadow
                },
                emphasis: {
                    label: { fontSize: 15 },
                    itemStyle: {
                        shadowBlur: 30,
                        shadowColor: p.funnelShadowEmphasis
                    }
                },
                data: funnelData.map((item, index) => ({
                    value: item.value,
                    name: item.name,
                    itemStyle: { color: p.funnel[index] || p.funnel[p.funnel.length - 1] }
                }))
            }]
        };

        chart.setOption(option, { notMerge: true });
    }

    // 初始化雷达图
    initRadarChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const chart = echarts.init(container);
        this.charts.radar = chart;
        this.updateRadarChart();

        // 点击事件
        chart.on('click', (params) => {
            if (params.name) {
                window.toast.info('能力对比', `${params.seriesName}: ${params.name}`);
            }
        });

        return chart;
    }

    updateRadarChart() {
        const chart = this.charts.radar;
        if (!chart) return;
        const p = this.palette();

        // 系列颜色按序列从主题色板取：0=现状(红)，1=标杆(绿)，超出后循环
        const seriesColors = [
            { line: p.radarCurrent, area: p.radarCurrentArea },
            { line: p.radarBenchmark, area: p.radarBenchmarkArea }
        ];

        const option = {
            backgroundColor: 'transparent',
            legend: {
                data: radarData.series.map(s => s.name),
                bottom: 0,
                textStyle: { color: p.legendText, fontSize: 12 },
                itemWidth: 16,
                itemHeight: 10,
                itemGap: 20
            },
            tooltip: {
                trigger: 'item',
                ...this.tooltipBase(p)
            },
            radar: {
                indicator: radarData.indicators,
                shape: 'polygon',
                splitNumber: 4,
                center: ['50%', '48%'],
                radius: '65%',
                axisName: {
                    color: p.axisName,
                    fontSize: 12,
                    fontWeight: 500
                },
                splitLine: {
                    lineStyle: {
                        color: p.splitLine,
                        width: 1
                    }
                },
                splitArea: {
                    areaStyle: {
                        color: [p.splitAreaA, p.splitAreaB]
                    }
                },
                axisLine: {
                    lineStyle: {
                        color: p.axisLine
                    }
                }
            },
            series: [{
                type: 'radar',
                data: radarData.series.map((s, index) => {
                    const c = seriesColors[index] || seriesColors[index % seriesColors.length];
                    return {
                        value: s.value,
                        name: s.name,
                        symbol: 'circle',
                        symbolSize: 8,
                        lineStyle: {
                            color: c.line,
                            width: 2,
                            shadowBlur: 10,
                            shadowColor: c.line
                        },
                        areaStyle: { color: c.area },
                        itemStyle: {
                            color: c.line,
                            borderColor: p.pointBorder,
                            borderWidth: 2
                        }
                    };
                })
            }]
        };

        chart.setOption(option, { notMerge: true });
    }

    // 主题切换后重绘全部图表
    applyTheme() {
        this.updateFunnelChart();
        this.updateRadarChart();
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.initFunnelChart('funnelChart');
        this.initRadarChart('radarChart');

        // 主题切换：图表同步换色
        window.themeManager.onChange(() => this.applyTheme());
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
        this.initialized = false;
    }
}

// 创建全局实例
window.chartManager = new ChartManager();
