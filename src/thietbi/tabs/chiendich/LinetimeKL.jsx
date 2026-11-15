import { useMemo, useState } from "react";
import { LineChart, CalendarClock } from "lucide-react";
import EChart from "@/components/EChart";
import { Card, Empty } from "../../components/ui";
import { bangCa } from "../../lib/chienDich";
import { fmt } from "../../lib/utils";
import { ngayGio, ngayVN, gio, tan, MAU_TUYEN } from "./chung";
import { vungNghi } from "./BieuDoXe";

const H = 3600e3;
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
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "line" }, valueFormatter: (v) => (v == null ? "–" : `${tan(v)} t`) },
      legend: { top: 0 },
      grid: { left: 10, right: 20, top: 34, bottom: 50, containLabel: true },
      xAxis: { type: "time", min: t0 - H, max: tEnd + 2 * H, axisLabel: { formatter: (v) => { const d = new Date(v); return d.getHours() === 0 && d.getMinutes() === 0 ? `{b|${d.getDate()}/${d.getMonth() + 1}}` : gio(v); }, rich: { b: { fontWeight: 700 } } } },
      yAxis: { type: "value", name: "t", axisLabel: { formatter: (v) => tan(v) } },
      dataZoom: [{ type: "slider", height: 18, bottom: 8, labelFormatter: (v) => ngayGio(v) }, { type: "inside" }],
      series: [
        ...(ok.length > 1 ? ok.map((x) => ({
          type: "line", name: x.t.ten, step: "end", showSymbol: false, smooth: false, data: gon([[x.mp.t0, 0], ...x.mp.tich]),
          lineStyle: { width: 1.5, type: "dashed", color: MAU_TUYEN[kq.tuyen.indexOf(x) % MAU_TUYEN.length] }, itemStyle: { color: MAU_TUYEN[kq.tuyen.indexOf(x) % MAU_TUYEN.length] },
        })) : []),
        {
          type: "line", name: "Kế hoạch lũy kế", step: "end", showSymbol: false, smooth: false, data: gon([[t0, 0], ...kq.tich]),
          lineStyle: { width: 2.5, color: "#6366f1" }, itemStyle: { color: "#6366f1" }, areaStyle: {},
          markLine: { symbol: "none", silent: true, data: [...mocs, { yAxis: kq.tongKL, name: "Tổng", lineStyle: { color: "#94a3b8", type: "dotted" }, label: { show: false } }] },
          markArea: { silent: true, itemStyle: { color: "rgba(148,163,184,.13)" }, data: vungNghi(kq.lich, cd.cau_hinh, t0 - H, tEnd + 2 * H) },
        },
        ...(tt.length > 1 ? [{ type: "line", name: "Thực tế lũy kế", smooth: false, data: tt, symbolSize: 6, lineStyle: { width: 2.5, color: "#f59e0b" }, itemStyle: { color: "#f59e0b" } }] : []),
        ...hanTG.map((x) => ({ type: "line", name: `Hạn ${x.t.ten}`, data: [], markLine: { symbol: "none", silent: true, data: [{ xAxis: x.mp.lich.chay(x.mp.t0, x.pa.hanGio * H, 0).kt, lineStyle: { color: "#f97316", type: "dashed" }, label: { formatter: `Hạn ${x.t.ten}`, color: "#f97316" } }] } })),
      ],
    };
  }, [kq, rows, ok, cd.cau_hinh, now]);

  if (!option) return <div className="card"><Empty>Chưa tính được tuyến nào: nhập đủ thông số ở tab Thông số & tính toán.</Empty></div>;
  const caKH = kq.caKH;
  return (
    <>
      <Card className="mb" title="Linetime khối lượng" icon={LineChart} hint={`${tan(kq.tongKL)} t · từ ${ngayGio(kq.t0)} đến ${ngayGio(kq.ketThuc)} · vùng xám là giờ nghỉ / ngoài ca · đường chấm = tổng khối lượng`}>
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
