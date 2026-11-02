import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useApp } from "@/store";

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer]);

// Biểu đồ ECharts tự đổi màu chữ / lưới theo chế độ sáng tối và tự co giãn theo khung.
// onClick(params): bấm vào một điểm / cột (params.componentType, params.dataIndex, params.name, params.value…).
export default function EChart({ option, height = 260, onClick }) {
  const el = useRef(), chart = useRef(), bam = useRef(onClick);
  bam.current = onClick;
  const { theme } = useApp();
  useEffect(() => {
    chart.current = echarts.init(el.current, null, { renderer: "canvas" });
    chart.current.on("click", (p) => bam.current?.(p));
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); chart.current?.dispose(); };
  }, []);
  useEffect(() => {
    const dark = theme === "dark", chu = dark ? "#b4c2d6" : "#334155", luoi = dark ? "rgba(148,170,210,.13)" : "rgba(15,23,42,.08)";
    // Trục: một trục hoặc mảng nhiều trục (biểu đồ hai trục tung)
    const truc = (a) => { const goc = { axisLine: { lineStyle: { color: luoi } }, axisLabel: { color: chu }, splitLine: { lineStyle: { color: luoi } } }; const mot = (x) => ({ ...goc, ...x, axisLabel: { color: chu, ...x.axisLabel } }); return a && (Array.isArray(a) ? a.map(mot) : mot(a)); };
    chart.current?.setOption({
      textStyle: { fontFamily: "Be Vietnam Pro, system-ui, sans-serif", color: chu },
      tooltip: { trigger: "axis", backgroundColor: dark ? "#111c31" : "#fff", borderColor: luoi, textStyle: { color: chu } },
      legend: { textStyle: { color: chu }, top: 0 },
      grid: { left: 14, right: 14, top: 34, bottom: 4, containLabel: true },
      ...option,
      legend: { textStyle: { color: chu }, top: 0, ...option.legend },
      tooltip: { trigger: "axis", backgroundColor: dark ? "#111c31" : "#fff", borderColor: luoi, textStyle: { color: chu }, ...option.tooltip },
      xAxis: truc(option.xAxis),
      yAxis: truc(option.yAxis),
    }, true);
  }, [option, theme]);
  return <div ref={el} style={{ height, width: "100%" }} />;
}
