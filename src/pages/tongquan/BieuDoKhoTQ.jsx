import { useMemo, useState } from "react";
import { useApp } from "@/store";
import EChart from "@/components/EChart";
import { so, pct, r2 } from "@/lib/format";
import { chuoiPhanLoai, nhomHangKho } from "@/lib/bieuDoKho";
import { NGUONG_KHO, khaiBaoBai, khoaTenBai } from "@/lib/kho";
import { MAU } from "./khung";
import { Khung, ChuaCo, Chon, nghin } from "./khungBD";
import { ChiTietBai } from "../kho/Kho";
import { KhungKho, KhungCoCau, KhungTuoi, useTonPhanLoai } from "./KhoiKho";
import { CAO } from "./BieuDoSanLuongTQ";

// Mảng Kho bãi của Tổng quan (anh Sỹ chốt 11/2026): đúng các biểu đồ sau, mỗi biểu đồ một khung CỐ ĐỊNH chiều cao, dài thì cuộn trong khung:
//   Cơ cấu tồn · Tuổi tồn · Tồn theo loại hàng (nút chuyển thành phẩm / nguyên liệu) · Lấp đầy theo bãi (chia theo khu vực, bấm bãi mở hộp bãi nhỏ)
//   · Lũy kế xuất nhập tồn kế hoạch / thực tế (kho thành phẩm và kho nguyên liệu)
// kho: tổng hợp kho (useKho); gd: giao dịch kho đã tải; tuoi: tuổi tồn từng dòng (tuoiTon)
const chieuCao = (n) => Math.max(250, 40 + n * 26);
const MAU_LOAI = { thanh_pham: MAU.tim, nguyen_lieu: MAU.primary };

export default function BieuDoKhoTQ({ kyInfo, kho, gd, tuoi }) {
  const { D } = useApp();
  const khaiBao = useTonPhanLoai();
  const keHoach = useMemo(() => D.khoKeHoach || [], [D.khoKeHoach]);
  const pl = useMemo(() => (kho && gd ? chuoiPhanLoai(kyInfo, { kho, declarations: khaiBao || [], giaoDich: gd, now: D.now }) : null), [kho, gd, kyInfo, khaiBao, D.now]);
  // Tồn theo loại hàng (nhóm hàng) của một loại kho: nút chuyển Thành phẩm / Nguyên liệu
  const [loaiKho, setLoaiKho] = useState("thanh_pham");
  const theoLoai = useMemo(() => {
    const m = new Map();
    for (const c of kho.cap) {
      if (!(c.ton > 1e-6) || (c.loai === "thanh_pham") !== (loaiKho === "thanh_pham")) continue;
      const ten = nhomHangKho(c.hang, kho) || c.hang;
      m.set(ten, (m.get(ten) || 0) + c.ton);
    }
    return [...m].map(([ten, ton]) => ({ ten, ton })).sort((x, y) => y.ton - x.ton);
  }, [kho, loaiKho]);
  // Lấp đầy theo bãi lớn, chia theo khu vực (Danh mục › Khai báo kho / bãi); bãi chưa khai báo sức chứa không có tỉ lệ
  const kb = useMemo(() => khaiBaoBai(D.dmBang), [D.dmBang]);
  const [moBai, setMoBai] = useState(null);
  const nhomKhu = useMemo(() => {
    const m = new Map();
    for (const b of kho.bai) { const k = kb.get(khoaTenBai(b.ten_bai))?.khuVuc || ""; (m.get(k) || m.set(k, []).get(k)).push(b); }
    return [...m].sort(([x], [y]) => (!x !== !y ? (x ? -1 : 1) : x.localeCompare(y, "vi", { numeric: true })))
      .map(([k, ds]) => { const ton = ds.reduce((t, b) => t + b.ton, 0), suc = ds.reduce((t, b) => t + (b.sucChua || 0), 0); return { ten: k || "Chưa phân khu", ds: [...ds].sort((x, y) => (y.lapDay ?? -1) - (x.lapDay ?? -1)), ton, suc, lap: suc > 0 ? ton / suc : null }; });
  }, [kho, kb]);
  const mauLap = (v) => (v >= NGUONG_KHO.do ? MAU.bad : v >= NGUONG_KHO.vang ? MAU.warn : MAU.ok);
  return (
    <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
      {khaiBao === null ? <Khung cao={CAO} ten="Cơ cấu tồn kho"><ChuaCo>Chưa có bảng phân loại tồn (chạy sql/07).</ChuaCo></Khung>
        : pl ? <KhungCoCau cao={CAO} p={pl} kyInfo={kyInfo} /> : <Khung cao={CAO} ten="Cơ cấu tồn kho"><ChuaCo>Đang tải…</ChuaCo></Khung>}
      {tuoi ? <KhungTuoi cao={CAO} tuoi={tuoi} /> : <Khung cao={CAO} ten="Tuổi tồn"><ChuaCo>Đang tải…</ChuaCo></Khung>}
      <Khung cao={CAO} ten="Tồn theo loại hàng" phu="nhóm hàng" bo={<Chon gt={loaiKho} dat={setLoaiKho} ds={[["thanh_pham", "Thành phẩm"], ["nguyen_lieu", "Nguyên liệu"]]} />}>
        {theoLoai.length ? (
          <EChart height={chieuCao(theoLoai.length)} option={{
            grid: { left: 4, right: 52, top: 6, bottom: 0, containLabel: true }, tooltip: { axisPointer: { type: "shadow" }, valueFormatter: (v) => `${so(v)} t` },
            xAxis: { type: "value", axisLabel: { fontSize: 10, formatter: nghin } }, yAxis: { type: "category", inverse: true, data: theoLoai.map((d) => d.ten), axisLabel: { fontSize: 10, width: 100, overflow: "truncate" } },
            series: [{ type: "bar", barMaxWidth: 14, itemStyle: { color: MAU_LOAI[loaiKho], opacity: 0.9 }, data: theoLoai.map((d) => r2(d.ton)), label: { show: true, position: "right", fontSize: 10, formatter: (p) => nghin(p.value) } }],
          }} />) : <ChuaCo>{loaiKho === "thanh_pham" ? "Kho thành phẩm" : "Kho nguyên liệu"} chưa có tồn.</ChuaCo>}
      </Khung>
      <Khung cao={CAO} ten="Lấp đầy theo bãi" phu={`theo khu vực · vạch vàng ${pct(NGUONG_KHO.vang)} · bấm bãi xem bãi nhỏ`}>
        {nhomKhu.length ? (
          <div className="grid gap-2.5 pb-1">
            {nhomKhu.map((k) => (
              <div key={k.ten}>
                {(nhomKhu.length > 1 || k.ten !== "Chưa phân khu") && (
                  <div className="mb-1 flex items-center gap-2 rounded bg-primary/10 px-1.5 py-0.5 text-[0.6875rem]"><b className="uppercase tracking-wide text-primary">{k.ten}</b><span className="text-muted-foreground">{k.ds.length} bãi · tồn {nghin(k.ton)} t{k.lap != null ? ` · lấp đầy ${pct(k.lap, 1)}` : ""}</span></div>)}
                <div className="grid gap-1">
                  {k.ds.map((b) => (
                    <button key={b.ten_bai} type="button" onClick={() => setMoBai(b.ten_bai)} title={`${b.ten_bai}: tồn ${so(b.ton)} t${b.sucChua > 0 ? ` / sức chứa ${so(b.sucChua)} t` : " (chưa khai báo sức chứa)"} · bấm xem các bãi nhỏ`}
                      className="group grid grid-cols-[minmax(80px,28%)_1fr_44px] items-center gap-2 rounded px-1 py-0.5 text-left text-[0.6875rem] hover:bg-accent">
                      <span className="truncate">{b.ten_bai}</span>
                      <span className="relative h-3 overflow-hidden rounded-sm bg-muted/60">
                        {b.lapDay != null && <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${Math.min(100, b.lapDay * 100)}%`, background: mauLap(b.lapDay) }} />}
                        <span className="absolute inset-y-0 w-px bg-warn/80" style={{ left: `${NGUONG_KHO.vang * 100}%` }} />
                      </span>
                      <span className={`text-right tabular-nums ${b.lapDay != null && b.lapDay >= NGUONG_KHO.do ? "font-semibold text-bad" : ""}`}>{b.lapDay != null ? pct(b.lapDay) : "—"}</span>
                    </button>))}
                </div>
              </div>))}
          </div>) : <ChuaCo>Chưa có bãi nào.</ChuaCo>}
      </Khung>
      <KhungKho cao={CAO} ten="Lũy kế xuất nhập tồn · kho thành phẩm" loai="thanh_pham" kho={kho} kyInfo={kyInfo} gd={gd || []} keHoach={keHoach} now={D.now} />
      <KhungKho cao={CAO} ten="Lũy kế xuất nhập tồn · kho nguyên liệu" loai="nguyen_lieu" kho={kho} kyInfo={kyInfo} gd={gd || []} keHoach={keHoach} now={D.now} />
      {moBai && kho.bai.some((b) => b.ten_bai === moBai) && <ChiTietBai b={kho.bai.find((b) => b.ten_bai === moBai)} kho={kho} onClose={() => setMoBai(null)} />}
    </div>
  );
}
