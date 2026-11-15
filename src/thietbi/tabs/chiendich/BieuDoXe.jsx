import { useMemo, useState } from "react";
import * as echarts from "echarts/core";
import { CustomChart } from "echarts/charts";
import { DataZoomComponent, MarkAreaComponent } from "echarts/components";
import { Truck, ListOrdered } from "lucide-react";
import EChart from "@/components/EChart";
import MoPhongDong from "./MoPhongDong";
import { Card, Seg, Empty } from "../../components/ui";
import { fmt } from "../../lib/utils";
import { KHAU, TEN_KHAU, ngayGio, gio, phut, tan } from "./chung";

echarts.use([CustomChart, DataZoomComponent, MarkAreaComponent]);

const H = 3600e3;
const CUA_SO = [["2", "2 giờ"], ["6", "6 giờ"], ["ca", "1 ca"], ["ngay", "1 ngày"], ["het", "Cả chiến dịch"]];

// Vùng tô xám: ngoài ca và giờ nghỉ cùng lúc (nghỉ luân phiên thấy qua khoảng trống của từng xe)
export function vungNghi(lich, cau_hinh, tu, den) {
  const out = [];
  const cas = lich.cacCa(tu, den, 3000);
  for (let i = 0; i < cas.length; i++) {
    const w = cas[i];
    if (i > 0 && cas[i - 1].e < w.s) out.push([{ xAxis: cas[i - 1].e, name: "Ngoài ca" }, { xAxis: w.s }]);
    for (const b of cau_hinh.nghi || []) if (b.kieu !== "luan" && +b.phut > 0) {
      const s = w.s + (+b.sau || 0) * H;
      out.push([{ xAxis: s, name: b.ten || "Nghỉ" }, { xAxis: s + b.phut * 60000 }]);
    }
  }
  return out;
}

export default function BieuDoXe({ cd, kq }) {
  const ok = kq.tuyen.filter((x) => x.mp);
  const [tid, setTid] = useState(ok[0]?.t.id);
  const [kieu, setKieu] = useState("xe");
  const [cua, setCua] = useState("6");
  const [xe, setXe] = useState("");
  const x = ok.find((y) => y.t.id === tid) || ok[0];
  if (!x) return <div className="card"><Empty>Chưa tính được tuyến nào: nhập đủ thông số ở tab Thông số & tính toán.</Empty></div>;
  const { mp, pa, t } = x;
  const den = cua === "het" ? mp.ketThuc + 0.5 * H : mp.t0 + (cua === "ca" ? mp.lich.L : cua === "ngay" ? 24 * H : +cua * H);

  return (
    <>
      <div className="row mb">
        {ok.length > 1 && <Seg value={x.t.id} onChange={setTid} options={ok.map((y) => [y.t.id, y.t.ten])} />}
        <Seg value={kieu} onChange={setKieu} options={[["xe", "Theo từng xe"], ["qd", "Xe – thời gian – quãng đường"], ["dong", "Mô phỏng chuyển động"]]} />
        {kieu !== "dong" && <Seg value={cua} onChange={setCua} options={CUA_SO} />}
        {kieu !== "dong" && <span className="small mute">Kéo thanh dưới biểu đồ hoặc lăn chuột để xem đoạn khác.</span>}
      </div>
      <Card className="mb" title={`${t.ten}: ${pa.A} xe · ${pa.Cx} điểm xếp · ${pa.Cd} điểm dỡ`} icon={Truck}
        hint={`xuất phát cách nhau ${fmt(pa.gianCach, 1)} phút · ${fmt(mp.chuyen.length)} chuyến · xong ${ngayGio(mp.ketThuc)}`}>
        {kieu === "xe" ? <GanttXe x={x} cd={cd} den={den} /> : kieu === "qd" ? <DoThiQD x={x} cd={cd} den={den} /> : <MoPhongDong key={x.t.id} x={x} cd={cd} />}
        {kieu === "xe" && <div className="legend" style={{ marginTop: 6 }}>{KHAU.map(([k, l, c]) => <span key={k}><i style={{ background: c }} />{l}</span>)}<span><i style={{ background: "rgba(148,163,184,.25)" }} />Nghỉ / ngoài ca</span></div>}
      </Card>
      <BangXe x={x} />
      <BangChuyen x={x} xe={xe} setXe={setXe} />
    </>
  );
}

function GanttXe({ x, cd, den }) {
  const { mp, pa } = x;
  const option = useMemo(() => {
    const data = [];
    for (const c of mp.chuyen) for (const [k, a, b] of c.doan) data.push([c.xe, a, b, KHAU.findIndex(([kk]) => kk === k), c.so, c.kl, c.diemXep + 1, c.diemDo + 1]);
    const ten = Array.from({ length: pa.A }, (_, i) => `Xe ${i + 1}`);
    return {
      tooltip: {
        trigger: "item",
        formatter: (p) => {
          if (p.seriesType !== "custom") return p.name;
          const [xe, a, b, k, so, kl, dx, dd] = p.value;
          return `<b>Xe ${xe + 1} · chuyến ${so}</b><br/>${TEN_KHAU[KHAU[k][0]]}: ${gio(a)}–${gio(b)} (${fmt((b - a) / 60000, 1)} phút)<br/>${fmt(kl, 2)} t · điểm xếp ${dx} → điểm dỡ ${dd}`;
        },
      },
      legend: { show: false },
      grid: { left: 8, right: 16, top: 10, bottom: 50, containLabel: true },
      xAxis: { type: "time", min: mp.t0 - 5 * 60000, max: mp.ketThuc + 30 * 60000, axisLabel: { formatter: (v) => { const d = new Date(v); return d.getHours() === 0 && d.getMinutes() === 0 ? `{b|${d.getDate()}/${d.getMonth() + 1}}` : gio(v); }, rich: { b: { fontWeight: 700 } } } },
      yAxis: { type: "category", data: ten, inverse: true, splitLine: { show: false } },
      dataZoom: [
        { type: "slider", xAxisIndex: 0, startValue: mp.t0 - 5 * 60000, endValue: den, height: 18, bottom: 8, labelFormatter: (v) => ngayGio(v) },
        { type: "inside", xAxisIndex: 0, startValue: mp.t0 - 5 * 60000, endValue: den },
      ],
      series: [
        {
          type: "custom", name: "Chuyến", data, encode: { x: [1, 2], y: 0 }, clip: true,
          renderItem: (params, api) => {
            const y = api.value(0), s = api.coord([api.value(1), y]), e = api.coord([api.value(2), y]);
            const h = api.size([0, 1])[1] * 0.62;
            const r = echarts.graphic.clipRectByRect({ x: s[0], y: s[1] - h / 2, width: Math.max(1, e[0] - s[0]), height: h },
              { x: params.coordSys.x, y: params.coordSys.y, width: params.coordSys.width, height: params.coordSys.height });
            return r && { type: "rect", shape: r, style: { fill: KHAU[api.value(3)][2] } };
          },
        },
        { type: "line", name: "Nghỉ", data: [], markArea: { silent: true, itemStyle: { color: "rgba(148,163,184,.16)" }, label: { show: false }, data: vungNghi(mp.lich, cd.cau_hinh, mp.t0 - H, mp.ketThuc + H) } },
      ],
    };
  }, [mp, pa, cd.cau_hinh, den]);
  return <EChart option={option} height={Math.max(220, 70 + pa.A * 24)} />;
}

// Biểu đồ xe – thời gian – quãng đường (kiểu biểu đồ chạy tàu): trục ngang thời gian, trục dọc quãng đường
// (0 = điểm xếp, trên cùng = điểm dỡ). Mỗi xe một đường, một màu; CÓ TẢI nét liền (xếp, cân, chạy có hàng, chờ dỡ, dỡ),
// KHÔNG TẢI nét đứt (chạy về, chờ xếp, nghỉ luân phiên). Mỗi xe là 2 dãy cùng tên nên bấm chú thích ẩn / hiện cả xe.
const MAU_XE = ["#6366f1", "#f59e0b", "#14b8a6", "#ec4899", "#0ea5e9", "#22c55e", "#a78bfa", "#f97316", "#ef4444", "#84cc16", "#06b6d4", "#eab308"];
const CO_TAI = new Set(["xep", "phu", "di", "do"]);

function DoThiQD({ x, cd, den }) {
  const { mp, pa, t } = x;
  const d = +t.quang_duong || 0;
  const option = useMemo(() => {
    const tDi = pa.ly.tDi * H || 1, tVe = pa.ly.tVe * H || 1;
    const xe = Array.from({ length: pa.A }, () => ({ tai: [], rong: [], cur: null }));
    for (const c of mp.chuyen) {
      const X = xe[c.xe];
      let pos = 0;
      for (const [k, a, b] of c.doan) {
        const loai = CO_TAI.has(k) || (k === "cho" && pos > 0) ? "tai" : "rong";
        const p0 = pos;
        if (k === "di") pos = Math.min(d, pos + ((b - a) / tDi) * d);
        else if (k === "ve") pos = Math.max(0, pos - ((b - a) / tVe) * d);
        // đổi có tải ↔ không tải: ngắt dãy cũ, dãy mới bắt đầu đúng điểm nối để đường liền mạch
        if (X.cur !== loai) { if (X.cur) X[X.cur].push(null); X[loai].push([a, p0, c.so, loai]); X.cur = loai; }
        else X[loai].push([a, p0, c.so, loai]);
        X[loai].push([b, pos, c.so, loai]);
      }
    }
    const mauXe = (i) => MAU_XE[i % MAU_XE.length];
    const ten = (i) => `Xe ${i + 1}`;
    const day = (i, loai, data) => ({
      type: "line", name: ten(i), data, smooth: false, showSymbol: false, connectNulls: false,
      lineStyle: { width: loai === "tai" ? 2 : 1.3, color: mauXe(i), type: loai === "tai" ? "solid" : [5, 4] }, itemStyle: { color: mauXe(i) },
      emphasis: { focus: "series", lineStyle: { width: loai === "tai" ? 3.2 : 2.2 } },
    });
    return {
      tooltip: {
        trigger: "item",
        formatter: (p) => {
          if (!Array.isArray(p.value)) return p.name || "";
          const [tg, km, so, loai] = p.value;
          return `<b>${p.seriesName} · chuyến ${so}</b><br/>${gio(tg)} · ${fmt(km, 2)} km · ${loai === "tai" ? "có tải" : "không tải"}`;
        },
      },
      legend: { type: "scroll", top: 0, data: Array.from({ length: pa.A }, (_, i) => ten(i)), selector: [{ type: "all", title: "Tất cả" }, { type: "inverse", title: "Đảo chọn" }] },
      grid: { left: 8, right: 16, top: 40, bottom: 50, containLabel: true },
      xAxis: { type: "time", min: mp.t0 - 5 * 60000, max: mp.ketThuc + 30 * 60000, axisLabel: { formatter: (v) => { const dd = new Date(v); return dd.getHours() === 0 && dd.getMinutes() === 0 ? `{b|${dd.getDate()}/${dd.getMonth() + 1}}` : gio(v); }, rich: { b: { fontWeight: 700 } } } },
      yAxis: { type: "value", min: 0, max: d || 1, name: "km", axisLabel: { formatter: (v) => (v === 0 ? `Xếp · ${t.diem_xep || "0"}` : v === d ? `Dỡ · ${t.diem_do || fmt(d, 1)}` : fmt(v, 1)) } },
      dataZoom: [
        // filterMode "none": lọc điểm ngoài khung làm mất điểm nối giữa đoạn có tải / không tải (dãy có null) nên đường không vẽ được
        { type: "slider", xAxisIndex: 0, filterMode: "none", startValue: mp.t0 - 5 * 60000, endValue: den, height: 18, bottom: 8, labelFormatter: (v) => ngayGio(v) },
        { type: "inside", xAxisIndex: 0, filterMode: "none", startValue: mp.t0 - 5 * 60000, endValue: den },
      ],
      series: [
        ...xe.flatMap((X, i) => [day(i, "tai", X.tai), day(i, "rong", X.rong)]),
        { type: "line", name: "Nghỉ", data: [], markArea: { silent: true, itemStyle: { color: "rgba(148,163,184,.16)" }, data: vungNghi(mp.lich, cd.cau_hinh, mp.t0 - H, mp.ketThuc + H) } },
      ],
    };
  }, [mp, pa, d, t.diem_xep, t.diem_do, cd.cau_hinh, den]);
  return (
    <>
      <EChart option={option} height={460} />
      <div className="legend" style={{ marginTop: 6 }}>
        <span><svg width="26" height="8" aria-hidden="true"><line x1="0" y1="4" x2="26" y2="4" stroke="currentColor" strokeWidth="2" /></svg>Có tải (xếp, chạy có hàng, chờ dỡ, dỡ)</span>
        <span><svg width="26" height="8" aria-hidden="true"><line x1="0" y1="4" x2="26" y2="4" stroke="currentColor" strokeWidth="1.3" strokeDasharray="5 4" /></svg>Không tải (chạy về, chờ xếp, nghỉ)</span>
        <span><i style={{ background: "rgba(148,163,184,.25)" }} />Nghỉ cùng lúc / ngoài ca</span>
      </div>
      <div className="small mute" style={{ marginTop: 4 }}>Mỗi đường một xe (bấm tên xe ở trên để ẩn / hiện). Đi lên = chạy có hàng tới điểm dỡ, đi xuống = chạy về; nằm ngang ở đáy = xếp hàng / chờ xếp, ở đỉnh = dỡ hàng / chờ dỡ. Các đường song song cách đều nhau là xe chạy đúng giãn cách.</div>
    </>
  );
}

function BangXe({ x }) {
  const { mp, pa } = x;
  const rows = useMemo(() => Array.from({ length: pa.A }, (_, i) => {
    const cs = mp.chuyen.filter((c) => c.xe === i);
    const cho = cs.reduce((a, c) => a + c.doan.filter(([k]) => k === "cho").reduce((s, [, a2, b]) => s + (b - a2), 0), 0);
    return { i, n: cs.length, kl: cs.reduce((a, c) => a + c.kl, 0), dau: cs[0]?.bd, cuoi: cs[cs.length - 1]?.ve, cho: cho / H };
  }), [mp, pa]);
  return (
    <Card className="mb" title="Lịch xe" icon={Truck} hint="giờ vào xếp lần đầu, số chuyến, khối lượng, thời gian chờ của từng xe">
      <div className="tw short">
        <table className="t compact">
          <thead><tr><th>Xe</th><th className="n">Vào xếp lần đầu</th><th className="n">Số chuyến</th><th className="n">Khối lượng (t)</th><th className="n">Tổng chờ</th><th className="n">Về bãi lần cuối</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.i}><td><b>Xe {r.i + 1}</b></td><td className="n">{ngayGio(r.dau)}</td><td className="n">{r.n}</td><td className="n">{tan(r.kl)}</td><td className={"n " + (r.cho > 0.5 ? "warn" : "")}>{r.cho > 1 / 600 ? `${phut(r.cho, 0)} phút` : "–"}</td><td className="n">{ngayGio(r.cuoi)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </Card>
  );
}

function BangChuyen({ x, xe, setXe }) {
  const { mp, pa } = x;
  const ds = mp.chuyen.filter((c) => xe === "" || c.xe === +xe);
  const MAX = 400;
  return (
    <Card className="mb" title={`Chi tiết từng chuyến (${fmt(ds.length)})`} icon={ListOrdered}
      right={<select className="inp sm" value={xe} onChange={(e) => setXe(e.target.value)}><option value="">Mọi xe</option>{Array.from({ length: pa.A }, (_, i) => <option key={i} value={i}>Xe {i + 1}</option>)}</select>}>
      <div className="tw">
        <table className="t compact">
          <thead><tr><th>Xe</th><th className="n">Chuyến</th><th className="n">t</th><th className="n">Điểm xếp</th><th className="n">Bắt đầu xếp</th><th className="n">Xếp xong</th><th className="n">Đến điểm dỡ</th><th className="n">Điểm dỡ</th><th className="n">Dỡ xong</th><th className="n">Về tới bãi xếp</th><th className="n">Chờ</th></tr></thead>
          <tbody>{ds.slice(0, MAX).map((c, i) => {
            const cho = c.doan.filter(([k]) => k === "cho").reduce((s, [, a, b]) => s + (b - a), 0) / 60000;
            return (
              <tr key={i}>
                <td>Xe {c.xe + 1}</td><td className="n">{c.so}</td><td className="n">{fmt(c.kl, 2)}</td><td className="n">{c.diemXep + 1}</td>
                <td className="n">{ngayGio(c.bd)}</td><td className="n">{gio(c.kxep)}</td><td className="n">{gio(c.ddi)}</td><td className="n">{c.diemDo + 1}</td>
                <td className="n">{gio(c.giao)}</td><td className="n">{gio(c.ve)}</td><td className={"n " + (cho > 0.5 ? "warn" : "mute")}>{cho > 0.5 ? `${fmt(cho, 0)} ph` : "–"}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {ds.length > MAX && <div className="small mute" style={{ marginTop: 6 }}>Hiện {MAX} chuyến đầu; chọn từng xe để xem hết. Xuất đủ danh sách chuyến ở tab Thực tế & báo cáo › Xuất Excel.</div>}
    </Card>
  );
}
