import { useMemo, useState } from "react";
import { LineChart, CalendarClock } from "lucide-react";
import EChart from "@/components/EChart";
import { Card, Empty } from "../../components/ui";
import { bangCa } from "../../lib/chienDich";
import { fmt } from "../../lib/utils";
import { ngayGio, ngayVN, gio, tan, MAU_TUYEN } from "./chung";
import { vungNghi } from "./BieuDoXe";

const H = 3600e3;
const XANH = "#3b82f6"; // lũy kế tổng: xanh dương, kế hoạch nét đứt, thực tế nét liền
// Rút gọn đường lũy kế (mỗi chuyến một điểm) còn tối đa ~1500 điểm
const gon = (pts, max = 1500) => { if (pts.length <= max) return pts; const b = Math.ceil(pts.length / max); return pts.filter((_, i) => i % b === 0 || i === pts.length - 1); };

export default function LinetimeKL({ cd, kq, thucTe }) {
  const ok = kq.tuyen.filter((x) => x.mp);
  const [now] = useState(() => Date.now());
  const rows = useMemo(() => bangCa(kq, thucTe, null, now), [kq, thucTe, now]);
  const option = useMemo(() => {
    if (!ok.length) return null;
    const t0 = kq.t0, tEnd = Math.max(kq.ketThuc, ...rows.filter((r) => r.tt != null).map((r) => r.e));
    // Thực tế lũy kế ở cuối mỗi ca đã nhập
    let lk = 0;
    const tt = [[t0, 0]];
    for (const r of rows) if (r.tt != null) { lk += r.tt; tt.push([Math.min(r.e, Math.max(now, r.s)), lk]); }
    const hanTG = ok.filter((x) => x.t.uu_tien === "tg" && x.pa.hanGio).map((x) => x);
    const mocs = [
      { xAxis: kq.ketThuc, name: `Dự kiến xong ${ngayGio(kq.ketThuc)}`, lineStyle: { color: "#22c55e", type: "solid", width: 2 }, label: { formatter: "Xong {c}".replace("{c}", ngayGio(kq.ketThuc)), color: "#22c55e" } },
    ];
    if (now > t0 && now < tEnd + 2 * H) mocs.push({ xAxis: now, name: "Hiện tại", lineStyle: { color: "#f43f5e", type: "dashed" }, label: { formatter: "Bây giờ", color: "#f43f5e" } });
    // Lũy kế THỰC TẾ riêng từng tuyến (cuối mỗi ca đã nhập của tuyến đó), chỉ khi có từ hai tuyến
    const ttTuyen = ok.length > 1 ? ok.map((x) => {
      let s = 0; const pts = [[t0, 0]];
      for (const r of bangCa(kq, thucTe, x.t.id, now)) if (r.tt != null) { s += r.tt; pts.push([Math.min(r.e, Math.max(now, r.s)), s]); }
      return { x, pts, mau: MAU_TUYEN[kq.tuyen.indexOf(x) % MAU_TUYEN.length] };
    }).filter((o) => o.pts.length > 1) : [];
    // Tooltip: tại giờ đang trỏ, hiện lũy kế của MỌI đường (ECharts mặc định chỉ hiện đường có điểm đúng giờ đó, nên chỉ thấy một tuyến)
    const khTai = (pts, t) => { let v = 0; for (const p of pts) { if (p[0] <= t) v = p[1]; else break; } return v; }; // đường bậc: giá trị của điểm gần nhất trước giờ t
    // Đường thực tế: tại giờ t đang trỏ, khối lượng đã chạy TỚI giờ đó (nối thẳng giữa các điểm cuối ca); quá điểm thực tế cuối cùng thì chưa có số (null), không giữ nguyên số cũ
    const ttTai = (pts, t) => {
      if (t <= pts[0][0]) return pts[0][1];
      for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return b === a ? vb : va + ((vb - va) * (t - a)) / (b - a); }
      return null;
    };
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const dot = (m) => `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${m};margin-right:6px"></i>`;
    const hang = (ten, m, noi) => `<div style="display:flex;justify-content:space-between;gap:18px"><span>${dot(m)}${esc(ten)}</span><b>${noi}</b></div>`;
    const tooltip = {
      trigger: "axis", axisPointer: { type: "line" },
      formatter: (ps) => {
        const t = ps?.[0]?.axisValue; if (t == null) return "";
        const co = tt.length > 1;
        let h = `<div style="margin-bottom:4px"><b>${ngayGio(t)}</b></div>`;
        const so = (v) => (v == null ? "–" : `${tan(v)} t`);
        h += hang("Kế hoạch lũy kế", XANH, so(khTai([[t0, 0], ...kq.tich], t)));
        if (co) h += hang("Thực tế lũy kế", XANH, so(ttTai(tt, t)));
        if (ok.length > 1) {
          h += `<div style="margin:6px 0 2px;opacity:.7">Từng tuyến (kế hoạch${ttTuyen.length ? " · thực tế" : ""})</div>`;
          for (const x of ok) {
            const m = MAU_TUYEN[kq.tuyen.indexOf(x) % MAU_TUYEN.length], o = ttTuyen.find((y) => y.x === x);
            h += hang(x.t.ten, m, `${so(khTai([[x.mp.t0, 0], ...x.mp.tich], t))}${o ? ` · ${so(ttTai(o.pts, t))}` : ""}`);
          }
        }
        return h;
      },
    };
    return {
      tooltip,
      legend: { top: 0 },
      grid: { left: 10, right: 20, top: 34, bottom: 50, containLabel: true },
      xAxis: { type: "time", min: t0 - H, max: tEnd + 2 * H, axisLabel: { formatter: (v) => { const d = new Date(v); return d.getHours() === 0 && d.getMinutes() === 0 ? `{b|${d.getDate()}/${d.getMonth() + 1}}` : gio(v); }, rich: { b: { fontWeight: 700 } } } },
      yAxis: { type: "value", name: "t", axisLabel: { formatter: (v) => tan(v) } },
      dataZoom: [{ type: "slider", height: 18, bottom: 8, labelFormatter: (v) => ngayGio(v) }, { type: "inside" }],
      series: [
        ...(ok.length > 1 ? ok.map((x) => ({
          type: "line", name: `${x.t.ten} · kế hoạch`, step: "end", showSymbol: false, smooth: false, data: gon([[x.mp.t0, 0], ...x.mp.tich]),
          lineStyle: { width: 1.75, type: "dashed", color: MAU_TUYEN[kq.tuyen.indexOf(x) % MAU_TUYEN.length] }, itemStyle: { color: MAU_TUYEN[kq.tuyen.indexOf(x) % MAU_TUYEN.length] },
        })) : []),
        ...ttTuyen.map((o) => ({
          type: "line", name: `${o.x.t.ten} · thực tế`, smooth: false, data: o.pts, symbolSize: 5,
          lineStyle: { width: 2, color: o.mau }, itemStyle: { color: o.mau },
        })),
        {
          type: "line", name: "Kế hoạch lũy kế", step: "end", showSymbol: false, smooth: false, data: gon([[t0, 0], ...kq.tich]),
          lineStyle: { width: 2.5, type: "dashed", color: XANH }, itemStyle: { color: XANH }, areaStyle: { color: XANH, opacity: 0.12 },
          markLine: { symbol: "none", silent: true, data: [...mocs, { yAxis: kq.tongKL, name: "Tổng", lineStyle: { color: "#94a3b8", type: "dotted" }, label: { show: false } }] },
          markArea: { silent: true, itemStyle: { color: "rgba(148,163,184,.13)" }, data: vungNghi(kq.lich, cd.cau_hinh, t0 - H, tEnd + 2 * H) },
        },
        ...(tt.length > 1 ? [{ type: "line", name: "Thực tế lũy kế", smooth: false, data: tt, symbolSize: 6, lineStyle: { width: 2.5, type: "solid", color: XANH }, itemStyle: { color: XANH } }] : []),
        ...hanTG.map((x) => ({ type: "line", name: `Hạn ${x.t.ten}`, data: [], markLine: { symbol: "none", silent: true, data: [{ xAxis: x.mp.lich.chay(x.mp.t0, x.pa.hanGio * H, 0).kt, lineStyle: { color: "#f97316", type: "dashed" }, label: { formatter: `Hạn ${x.t.ten}`, color: "#f97316" } }] } })),
      ],
    };
  }, [kq, rows, ok, cd.cau_hinh, now, thucTe]);

  if (!option) return <div className="card"><Empty>Chưa tính được tuyến nào: nhập đủ thông số ở tab Thông số & tính toán.</Empty></div>;
  const caKH = kq.caKH;
  return (
    <>
      <Card className="mb" title="Linetime khối lượng" icon={LineChart} hint={`${tan(kq.tongKL)} t · từ ${ngayGio(kq.t0)} đến ${ngayGio(kq.ketThuc)} · vùng xám là giờ nghỉ / ngoài ca · đường chấm = tổng khối lượng${ok.length > 1 ? " · nét đứt = kế hoạch từng tuyến, nét liền = thực tế từng tuyến (bấm tên ở chú thích để ẩn / hiện)" : ""}`}>
        <EChart option={option} height={420} />
      </Card>
      <Card className="mb" title="Kế hoạch theo ca" icon={CalendarClock} hint="khối lượng dỡ xong trong từng ca">
        {caKH.length ? (
          <div className="tw">
            <table className="t compact">
              <thead>
                <tr><th>Ca</th><th>Giờ</th>{ok.map((x) => <th key={x.t.id} className="n">{x.t.ten} (t · chuyến · xe)</th>)}<th className="n">Tổng (t)</th><th className="n">Lũy kế (t)</th><th className="n">% hoàn thành</th></tr>
              </thead>
              <tbody>{(() => {
                let lk = 0;
                return caKH.map((c) => {
                  lk += c.kl;
                  return (
                    <tr key={c.key}>
                      <td><b>CA {c.so}</b> {ngayVN(c.ngay)}</td><td className="small mute">{gio(c.s)}–{gio(c.e)}</td>
                      {ok.map((x) => { const y = c.tuyen[x.t.id]; return <td key={x.t.id} className="n">{y ? <>{tan(y.kl)} <span className="mute small">· {y.chuyen} · {y.xe}</span></> : <span className="mute">–</span>}</td>; })}
                      <td className="n"><b>{tan(c.kl)}</b></td><td className="n">{tan(lk)}</td><td className="n">{fmt((lk / kq.tongKL) * 100, 1)}%</td>
                    </tr>
                  );
                });
              })()}</tbody>
            </table>
          </div>
        ) : <Empty />}
      </Card>
    </>
  );
}
