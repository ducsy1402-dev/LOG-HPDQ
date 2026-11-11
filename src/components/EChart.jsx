import { createContext, useContext, useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useApp } from "@/store";
import { so } from "@/lib/format";

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer]);

// Bảng màu mặc định (dịu, hợp nền xanh đậm) và hiệu ứng bóng: cột / bánh tô chuyển sắc sáng → đậm, có bóng đổ; đường mượt có quầng sáng, vùng dưới đường mờ dần.
const BANG_MAU = ["#3b82f6", "#a855f7", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#f97316", "#84cc16", "#6366f1", "#14b8a6"];
const rgb = (c) => { const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c || ""); if (!m) return null; const h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1]; return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const tron = (c, d, k) => `rgb(${c.map((v, i) => Math.round(v + (d[i] - v) * k)).join(",")})`;
const rgba = (c, a) => `rgba(${c.join(",")},${a})`;
// Quầng phát quang cùng màu với khối (đậm hơn ở giao diện tối)
const quang = (c, dark, nho) => { const v = typeof c === "string" ? rgb(c) : null; return v ? { shadowBlur: nho ? (dark ? 12 : 4) : dark ? 20 : 7, shadowColor: rgba(v, dark ? 0.85 : 0.4), shadowOffsetX: 0, shadowOffsetY: 0 } : {}; };
// Màu phẳng (hex) → chuyển sắc; ngang = thanh nằm ngang (trục danh mục là trục tung)
function chuyenSac(c, ngang) {
  const v = rgb(c); if (!v) return c;
  const sang = tron(v, [255, 255, 255], 0.32), dam = tron(v, [0, 0, 0], 0.12);
  return new echarts.graphic.LinearGradient(0, ngang ? 0 : 0, ngang ? 1 : 0, ngang ? 0 : 1, ngang ? [{ offset: 0, color: dam }, { offset: 1, color: sang }] : [{ offset: 0, color: sang }, { offset: 1, color: dam }]);
}
function bong(option, dark) {
  const pal = option.color || BANG_MAU, nen = dark ? "#0d4a85" : "#ffffff";
  const ngang = [].concat(option.yAxis || []).some((a) => a?.type === "category");
  const ds = Array.isArray(option.series) ? option.series : option.series ? [option.series] : [];
  const series = ds.map((s, i) => {
    const goc = s.itemStyle?.color ?? s.color ?? pal[i % pal.length];
    if (s.type === "pie") return {
      ...s,
      itemStyle: { borderRadius: 6, ...s.itemStyle, borderColor: nen, borderWidth: 2 },
      data: (s.data || []).map((d, j) => { const o = d && typeof d === "object" ? d : { value: d }; return { ...o, itemStyle: { ...quang(o.itemStyle?.color ?? pal[j % pal.length], dark, false), ...o.itemStyle, color: chuyenSac(o.itemStyle?.color ?? pal[j % pal.length], false) } }; }),
    };
    if (s.type === "bar") return {
      ...s,
      itemStyle: { borderRadius: ngang ? [0, 3, 3, 0] : [3, 3, 0, 0], ...quang(goc, dark, true), ...s.itemStyle, color: typeof goc === "string" ? chuyenSac(goc, ngang) : goc },
      data: Array.isArray(s.data) ? s.data.map((d) => (d && typeof d === "object" && typeof d.itemStyle?.color === "string" ? { ...d, itemStyle: { ...quang(d.itemStyle.color, dark, true), ...d.itemStyle, color: chuyenSac(d.itemStyle.color, ngang) } } : d)) : s.data,
    };
    if (s.type === "line") {
      const v = typeof goc === "string" ? rgb(goc) : null;
      return {
        ...s, smooth: s.smooth ?? true,
        itemStyle: { ...s.itemStyle, color: goc },
        lineStyle: { width: 2.4, ...(v ? { shadowBlur: dark ? 16 : 5, shadowColor: rgba(v, dark ? 0.85 : 0.35), shadowOffsetY: 0 } : {}), ...s.lineStyle },
        ...(s.areaStyle && v && !s.areaStyle.color ? { areaStyle: { ...s.areaStyle, opacity: 1, color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: rgba(v, 0.38) }, { offset: 1, color: rgba(v, 0.02) }]) } } : {}),
      };
    }
    return s;
  });
  return { color: pal, ...option, series };
}

// Khung đang phóng to (Tổng quan): biểu đồ cao lên theo màn hình
export const PhongToCtx = createContext(false);

// Biểu đồ ECharts tự đổi màu chữ / lưới theo chế độ sáng tối và tự co giãn theo khung.
// onClick(params): bấm vào một điểm / cột (params.componentType, params.dataIndex, params.name, params.value…).
export default function EChart({ option, height = 260, onClick }) {
  const el = useRef(), chart = useRef(), bam = useRef(onClick);
  bam.current = onClick;
  const { theme } = useApp();
  const to = useContext(PhongToCtx);
  useEffect(() => {
    chart.current = echarts.init(el.current, null, { renderer: "canvas" });
    chart.current.on("click", (p) => bam.current?.(p));
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); chart.current?.dispose(); };
  }, []);
  useEffect(() => {
    const dark = theme === "dark", chu = dark ? "#dff1ff" : "#334155", luoi = dark ? "rgba(120,190,255,.22)" : "rgba(15,23,42,.08)";
    // Trục: một trục hoặc mảng nhiều trục (biểu đồ hai trục tung)
    const truc = (a) => { const goc = { axisLine: { lineStyle: { color: luoi } }, axisLabel: { color: chu }, splitLine: { lineStyle: { color: luoi } } }; const mot = (x) => ({ ...goc, ...x, axisLabel: { color: chu, ...x.axisLabel } }); return a && (Array.isArray(a) ? a.map(mot) : mot(a)); };
    const op = bong(option, dark);
    chart.current?.setOption({
      textStyle: { fontFamily: "Roboto Condensed, Be Vietnam Pro, system-ui, sans-serif", color: chu },
      tooltip: { trigger: "axis", backgroundColor: dark ? "#0a3f73" : "#fff", borderColor: luoi, textStyle: { color: chu } },
      legend: { textStyle: { color: chu }, top: 0 },
      grid: { left: 14, right: 14, top: 34, bottom: 4, containLabel: true },
      ...op,
      legend: { ...(option.legend?.bottom == null ? { top: 0 } : {}), ...option.legend, textStyle: { color: chu, ...option.legend?.textStyle } }, // chữ chú thích luôn sáng theo giao diện, không mất màu khi biểu đồ chỉ đặt cỡ chữ
      tooltip: { trigger: "axis", backgroundColor: dark ? "#0a3f73" : "#fff", borderColor: luoi, textStyle: { color: chu }, valueFormatter: (v) => (typeof v === "number" ? so(v) : v), appendToBody: true, ...option.tooltip }, // appendToBody: hộp chú thích nổi trên cùng, không bị khung cuộn / khung cố định cắt hay đè
      xAxis: truc(option.xAxis),
      yAxis: truc(option.yAxis),
    }, true);
  }, [option, theme]);
  return <div ref={el} style={{ height: to ? `max(${height}px, calc(100dvh - 190px))` : height, width: "100%" }} />;
}
