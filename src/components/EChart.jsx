import { createContext, useContext, useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useApp } from "@/store";
import { so } from "@/lib/format";

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer]);

// Bảng màu mặc định kiểu web tài chính: phẳng, dịu, phân biệt rõ (chàm, ngọc, xanh trời, hổ phách, tím, hồng…).
// Cột bo góc nhẹ, bánh có khe theo màu nền thẻ, đường mượt không phát sáng, vùng dưới đường mờ dần.
const BANG_MAU = ["#6366f1", "#14b8a6", "#0ea5e9", "#f59e0b", "#a78bfa", "#f43f5e", "#22c55e", "#f97316", "#64748b", "#ec4899"];
const rgb = (c) => { const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c || ""); if (!m) return null; const h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1]; return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const rgba = (c, a) => `rgba(${c.join(",")},${a})`;
// Nhãn số nằm NGOÀI cột / bánh: chữ màu theo giao diện, không viền chữ (viền chữ mặc định của ECharts làm nhãn nhòe, trông như đè lên cột)
const NGOAI = new Set(["right", "left", "top", "bottom", "outside"]);
const nhanNgoai = (s, chu) => { const l = s.label; if (!l?.show) return l; const ngoai = s.type === "pie" ? !["inside", "center", "inner"].includes(l.position) : NGOAI.has(l.position); return ngoai ? { color: chu, textBorderWidth: 0, ...l } : { textBorderWidth: 0, ...l }; };
function bong(option, dark, chu) {
  const pal = option.color || BANG_MAU, nen = dark ? "#16191f" : "#ffffff";
  const ngang = [].concat(option.yAxis || []).some((a) => a?.type === "category");
  const ds = Array.isArray(option.series) ? option.series : option.series ? [option.series] : [];
  const series = ds.map((s0) => {
    const s = s0.label ? { ...s0, label: nhanNgoai(s0, chu) } : s0;
    if (s.type === "pie") return { ...s, itemStyle: { borderRadius: 4, ...s.itemStyle, borderColor: nen, borderWidth: 2 } };
    if (s.type === "bar") return { ...s, itemStyle: { borderRadius: ngang ? [0, 3, 3, 0] : [3, 3, 0, 0], ...s.itemStyle } };
    if (s.type === "line") {
      const goc = s.itemStyle?.color ?? s.color, v = typeof goc === "string" ? rgb(goc) : null;
      return {
        ...s, smooth: s.smooth ?? true,
        lineStyle: { width: 2, ...s.lineStyle },
        ...(s.areaStyle && v && !s.areaStyle.color ? { areaStyle: { ...s.areaStyle, opacity: 1, color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: rgba(v, dark ? 0.28 : 0.18) }, { offset: 1, color: rgba(v, 0) }]) } } : {}),
      };
    }
    return s;
  });
  return { color: pal, ...option, series };
}

// Chú thích (legend) ở trên mà dài quá bề rộng thì ECharts tự xuống nhiều dòng và ĐÈ lên vùng vẽ / số trục tung.
// Ước số dòng theo bề rộng thật của khung (đo chữ bằng canvas) rồi đẩy lưới xuống cho đủ chỗ. Trả về grid.top mới hoặc null.
let doChu;
function lechTop(opt, rong) {
  const lg = opt.legend, g = opt.grid;
  if (!lg || lg.show === false || lg.type === "scroll" || lg.orient === "vertical" || lg.bottom != null || Array.isArray(g) || !rong) return null;
  const top0 = typeof lg.top === "number" ? lg.top : lg.top == null || lg.top === "top" ? 0 : null, gTop = typeof g?.top === "number" ? g.top : g?.top == null ? 34 : null;
  if (top0 == null || gTop == null) return null;
  const ds = [].concat(opt.series || []);
  if (ds.some((x) => x.type === "pie")) return null;
  const ten = (lg.data || ds.map((x) => x.name)).map((x) => (typeof x === "object" ? x?.name : x)).filter((x, i, a) => x != null && x !== "" && a.indexOf(x) === i);
  if (!ten.length) return null;
  const fs = lg.textStyle?.fontSize || 12, gap = lg.itemGap ?? 10, iw = lg.itemWidth ?? 25, ih = lg.itemHeight ?? 14;
  doChu ||= document.createElement("canvas").getContext("2d");
  doChu.font = `${fs}px "Inter Variable", system-ui, sans-serif`;
  const conLai = rong - 10 - (typeof lg.left === "number" ? lg.left : 0) - (typeof lg.right === "number" ? lg.right : 0);
  let dong = 1, x = 0;
  for (const t of ten) { const w = iw + 5 + doChu.measureText(String(t)).width; if (x > 0 && x + w > conLai) { dong++; x = 0; } x += w + gap; }
  if (dong < 2) return null;
  const caoDong = Math.max(ih, fs * 1.2), can = top0 + 5 + dong * caoDong + (dong - 1) * gap + 10;
  return can > gTop ? Math.ceil(can) : null;
}

// Khung đang phóng to (Tổng quan): biểu đồ cao lên theo màn hình
export const PhongToCtx = createContext(false);

// Biểu đồ ECharts tự đổi màu chữ / lưới theo chế độ sáng tối và tự co giãn theo khung.
// onClick(params): bấm vào một điểm / cột (params.componentType, params.dataIndex, params.name, params.value…).
export default function EChart({ option, height = 260, onClick }) {
  const el = useRef(), chart = useRef(), bam = useRef(onClick), cuoi = useRef(null);
  bam.current = onClick;
  const { theme } = useApp();
  const to = useContext(PhongToCtx);
  useEffect(() => {
    chart.current = echarts.init(el.current, null, { renderer: "canvas" });
    chart.current.on("click", (p) => bam.current?.(p));
    // Đổi bề rộng: co giãn và tính lại chỗ cho chú thích nhiều dòng
    const ro = new ResizeObserver(() => {
      chart.current?.resize();
      const o = cuoi.current; if (!o) return;
      const t = lechTop(o, el.current?.clientWidth) ?? o.grid?.top ?? 34;
      if (t !== o.__top) { o.__top = t; chart.current?.setOption({ grid: { top: t } }); }
    });
    ro.observe(el.current);
    return () => { ro.disconnect(); chart.current?.dispose(); };
  }, []);
  useEffect(() => {
    const dark = theme === "dark", chu = dark ? "#c9cfdb" : "#475467", luoi = dark ? "rgba(255,255,255,.07)" : "rgba(16,24,40,.07)", truc0 = dark ? "rgba(255,255,255,.14)" : "rgba(16,24,40,.16)";
    // Trục: một trục hoặc mảng nhiều trục (biểu đồ hai trục tung)
    const truc = (a) => { const goc = { axisLine: { lineStyle: { color: truc0 } }, axisTick: { show: false }, axisLabel: { color: chu }, splitLine: { lineStyle: { color: luoi, type: "dashed" } } }; const mot = (x) => ({ ...goc, ...x, axisLabel: { color: chu, ...x.axisLabel } }); return a && (Array.isArray(a) ? a.map(mot) : mot(a)); };
    const op = bong(option, dark, chu);
    const legend = { icon: "roundRect", itemWidth: 10, itemHeight: 10, itemGap: 12, ...(option.legend?.bottom == null ? { top: 0 } : {}), ...option.legend, textStyle: { color: chu, ...option.legend?.textStyle } }; // chữ chú thích luôn sáng theo giao diện, không mất màu khi biểu đồ chỉ đặt cỡ chữ
    const grid = Array.isArray(option.grid) ? option.grid : { left: 14, right: 14, top: 34, bottom: 4, containLabel: true, ...option.grid };
    const goc = { legend, grid, series: op.series };
    const top = lechTop(goc, el.current?.clientWidth);
    goc.__top = top ?? grid.top;
    cuoi.current = goc;
    chart.current?.setOption({
      textStyle: { fontFamily: "Inter Variable, Be Vietnam Pro, system-ui, sans-serif", color: chu },
      ...op,
      grid: top != null ? { ...grid, top } : grid,
      legend,
      tooltip: { trigger: "axis", backgroundColor: dark ? "#1c2029" : "#fff", borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(16,24,40,.1)", borderWidth: 1, padding: [8, 12], extraCssText: "border-radius:10px;box-shadow:0 8px 24px rgba(16,24,40,.18);", textStyle: { color: dark ? "#e6e9ef" : "#1d2433", fontSize: 12 }, axisPointer: { lineStyle: { color: truc0 }, shadowStyle: { color: dark ? "rgba(255,255,255,.04)" : "rgba(16,24,40,.04)" } }, valueFormatter: (v) => (typeof v === "number" ? so(v) : v), appendToBody: true, ...option.tooltip }, // appendToBody: hộp chú thích nổi trên cùng, không bị khung cuộn / khung cố định cắt hay đè
      xAxis: truc(option.xAxis),
      yAxis: truc(option.yAxis),
    }, true);
  }, [option, theme]);
  return <div ref={el} style={{ height: to ? `max(${height}px, calc(100dvh - 190px))` : height, width: "100%" }} />;
}
