import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, AreaChart, Area, LabelList,
} from "recharts";
import { usePalette } from "./ui";
import { pct, fmt, vnShort } from "../lib/utils";

const STATES = [["ss", "Sẵn sàng"], ["bddk", "BD định kỳ"], ["bdcl", "BD chiến lược"], ["hong", "Hỏng"]];

function Tip({ active, payload, label, title, fmtV = (v) => fmt(v), extra }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      <div className="h">{title ? title(label, payload) : label}</div>
      {payload.map((p) => (
        <div className="r" key={p.dataKey}><span><i style={{ background: p.color || p.payload?.fill }} />{p.name}</span><b className="mono">{fmtV(p.value, p)}</b></div>
      ))}
      {extra && extra(payload[0]?.payload)}
    </div>
  );
}
const axis = (P) => ({ tick: { fill: P.mute, fontSize: 11 }, axisLine: false, tickLine: false });

export function Legend({ items }) {
  return <div className="legend">{items.map(([c, l, n]) => <span key={l}><i style={{ background: c }} />{l}{n != null && <b className="mono">{n}</b>}</span>)}</div>;
}

// Vòng tròn tình trạng đội xe
export function StatusDonut({ sum, size = 190, label = "sẵn sàng" }) {
  const P = usePalette();
  const data = STATES.map(([k, l]) => ({ k, name: l, value: sum[k] })).filter((d) => d.value > 0);
  return (
    <div>
      <div className="donut-wrap" style={{ height: size }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="96%" paddingAngle={1.5} stroke={P.surface} strokeWidth={2} startAngle={90} endAngle={-270} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.k} fill={P[d.k]} />)}
            </Pie>
            <Tooltip content={<Tip fmtV={(v) => `${v} xe · ${pct(v / sum.tong)}`} title={() => "Tình trạng"} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-c"><div><b>{pct(sum.rate, 1)}</b><span>{label}</span></div></div>
      </div>
      <div style={{ marginTop: 10 }}>
        <Legend items={STATES.map(([k, l]) => [P[k], l, sum[k]])} />
      </div>
    </div>
  );
}

// Cột chồng tình trạng theo nhóm (đội / tổ)
export function StackedStatus({ rows, height, horizontal = true, onPick }) {
  const P = usePalette();
  const h = height || (horizontal ? Math.max(160, rows.length * 38 + 30) : 260);
  const data = rows.map((r) => ({ ...r, name: r.k }));
  const last = (k) => STATES.map(([s]) => s).filter((s) => rows.some((r) => r[s] > 0)).pop() === k;
  return (
    <div className="chart" style={{ height: h }}>
      <ResponsiveContainer>
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: 34, bottom: 0, left: 4 }} barCategoryGap="28%"
          onClick={(e) => onPick && e?.activeLabel && onPick(e.activeLabel)}>
          <CartesianGrid stroke={P.line} horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? <>
            <XAxis type="number" {...axis(P)} allowDecimals={false} />
            <YAxis type="category" dataKey="name" {...axis(P)} width={112} tick={{ fill: P.ink2, fontSize: 12 }} tickFormatter={(s) => s.replace(/^Tổ\s+/, "")} />
          </> : <>
            <XAxis dataKey="name" {...axis(P)} tick={{ fill: P.ink2, fontSize: 12 }} />
            <YAxis {...axis(P)} allowDecimals={false} width={32} />
          </>}
          <Tooltip cursor={{ fill: P.raise, opacity: 0.5 }} content={<Tip fmtV={(v) => `${v} xe`} extra={(r) => <div className="r" style={{ marginTop: 4, borderTop: `1px solid ${P.line}`, paddingTop: 4 }}><span>Tỷ lệ sẵn sàng</span><b className="mono">{pct(r.rate)}</b></div>} />} />
          {STATES.map(([k, l]) => (
            <Bar key={k} dataKey={k} name={l} stackId="s" fill={P[k]} stroke={P.surface} strokeWidth={1} isAnimationActive={false}
              radius={last(k) ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0}>
              {k === "hong" && horizontal && <LabelList dataKey="tong" position="right" content={({ x, y, width, height: hh, value, index }) => {
                const r = data[index]; return <text x={x + width + 6 + 0} y={y + hh / 2} dy={4} fill={P.mute} fontSize={11} fontFamily="JetBrains Mono">{r.tong}</text>;
              }} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Xu hướng tỷ lệ sẵn sàng theo ngày
export function TrendArea({ data, T, height = 220 }) {
  const P = usePalette();
  const d = data.map((x) => ({ ...x, r: Math.round(x.rate * 1000) / 10 }));
  const min = Math.max(0, Math.floor(Math.min(...d.map((x) => x.r), T.red * 100) / 10) * 10 - 5);
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={d} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={P.accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={P.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={P.line} vertical={false} />
          <XAxis dataKey="d" {...axis(P)} tickFormatter={vnShort} minTickGap={24} />
          <YAxis domain={[min, 100]} {...axis(P)} width={38} tickFormatter={(v) => v + "%"} />
          <ReferenceLine y={T.ss * 100} stroke={P.ok} strokeDasharray="4 4" />
          <ReferenceLine y={T.red * 100} stroke={P.bad} strokeDasharray="4 4" />
          <Tooltip cursor={{ stroke: P.mute, strokeDasharray: "3 3" }} content={<Tip title={(l) => vnShort(l)} fmtV={(v, p) => `${String(v).replace(".", ",")}% · dừng ${p.payload.dung} xe`} />} />
          <Area type="monotone" dataKey="r" name="Sẵn sàng" stroke={P.accent} strokeWidth={2} fill="url(#gArea)" isAnimationActive={false} dot={false} activeDot={{ r: 4, stroke: P.surface, strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Hai chỉ số cạnh nhau theo nhóm (VD: nhân sự hiện có / định biên)
export function PairBars({ rows, a, b, height = 220, horizontal = false, noLegend, rowH = 44 }) {
  const P = usePalette();
  const ca = P[a.color] || a.color || P.accent, cb = P[b.color] || b.color || P.accent2;
  return (
    <div>
      <div className="chart" style={{ height: horizontal ? Math.max(150, rows.length * rowH + 30) : height }}>
        <ResponsiveContainer>
          <BarChart data={rows} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: horizontal ? 34 : 6, bottom: 0, left: 0 }} barGap={2} barCategoryGap="26%">
            <CartesianGrid stroke={P.line} vertical={horizontal} horizontal={!horizontal} />
            {horizontal ? <>
              <XAxis type="number" {...axis(P)} allowDecimals={false} />
              <YAxis type="category" dataKey="name" {...axis(P)} width={112} tick={{ fill: P.ink2, fontSize: 12 }} tickFormatter={(s) => s.replace(/^Tổ\s+/, "")} />
            </> : <>
              <XAxis dataKey="name" {...axis(P)} tick={{ fill: P.ink2, fontSize: 12 }} />
              <YAxis {...axis(P)} allowDecimals={false} width={32} />
            </>}
            <Tooltip cursor={{ fill: P.raise, opacity: 0.5 }} content={<Tip />} />
            <Bar dataKey={a.key} name={a.label} fill={ca} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} isAnimationActive={false}>
              {horizontal && <LabelList dataKey={a.key} position="right" style={{ fill: P.ink2, fontSize: 11, fontFamily: "JetBrains Mono" }} />}
            </Bar>
            <Bar dataKey={b.key} name={b.label} fill={cb} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} isAnimationActive={false}>
              {horizontal && <LabelList dataKey={b.key} position="right" style={{ fill: P.ink2, fontSize: 11, fontFamily: "JetBrains Mono" }} />}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!noLegend && <Legend items={[[ca, a.label], [cb, b.label]]} />}
    </div>
  );
}

// Dự kiến hoàn thành của xe đang dừng
export function EtrBars({ buckets, height = 200 }) {
  const P = usePalette();
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={buckets} margin={{ top: 14, right: 6, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke={P.line} vertical={false} />
          <XAxis dataKey="l" {...axis(P)} interval={0} tick={{ fill: P.mute, fontSize: 10.5 }} />
          <YAxis {...axis(P)} allowDecimals={false} width={24} />
          <Tooltip cursor={{ fill: P.raise, opacity: 0.5 }} content={<Tip title={(l, p) => p[0]?.payload?.full || l} fmtV={(v) => `${v} sự kiện`} />} />
          <Bar dataKey="n" name="Số sự kiện" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {buckets.map((b) => <Cell key={b.l} fill={b.bad ? P.bad : b.none ? P.mute : P.info} />)}
            <LabelList dataKey="n" position="top" formatter={(v) => (v ? v : "")} style={{ fill: P.ink2, fontSize: 11, fontFamily: "JetBrains Mono" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
