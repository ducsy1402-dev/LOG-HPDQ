import { useMemo, useState } from "react";
import { useApp } from "@/store";
import { so, pct } from "@/lib/format";
import { NGUONG_KHO, khaiBaoBai, khoaTenBai } from "@/lib/kho";
import { MAU } from "./khung";
import { Khung, ChuaCo, Chon, nghin } from "./khungBD";
import { ChiTietBai } from "../kho/Kho";
import { TonHienTaiBD, DienBienTonBD } from "../kho/BieuDoTonKien";
import { KhungKho } from "./KhoiKho";
import { CAO } from "./BieuDoSanLuongTQ";

// Mảng Kho bãi của Tổng quan (anh Sỹ chốt 11/2026, chỉnh 22/11/2026): mỗi biểu đồ một khung CỐ ĐỊNH chiều cao, dài thì cuộn trong khung:
//   Tồn hiện tại (tồn theo hàng, như tab Kho hàng kiện; nút chuyển Hàng kiện / Hàng rời) · Tỉ lệ lấp đầy (chia theo khu vực, bấm bãi mở hộp bãi nhỏ)
//   · Lũy kế xuất/nhập tồn (một khung, lọc Hàng kiện / Hàng rời và loại hàng) · Diễn biến tồn (tồn theo hàng, như tab Kho hàng kiện; nút chuyển Hàng kiện / Hàng rời)
//   Đã bỏ hai biểu đồ Cơ cấu tồn kho và Tuổi tồn.
// kho: tổng hợp kho (useKho); gd: giao dịch kho đã tải
const KHO = [["thanh_pham", "Hàng kiện"], ["nguyen_lieu", "Hàng rời"]];

export default function BieuDoKhoTQ({ kyInfo, kho, gd }) {
  const { D } = useApp();
  const keHoach = useMemo(() => D.khoKeHoach || [], [D.khoKeHoach]);
  const [loaiTon, setLoaiTon] = useState("thanh_pham"), [loaiDB, setLoaiDB] = useState("thanh_pham");
  // Tỉ lệ lấp đầy theo bãi lớn, chia theo khu vực (Danh mục › Khai báo kho / bãi); bãi chưa khai báo sức chứa không có tỉ lệ
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
      <Khung cao={CAO} ten="Tồn hiện tại" phu="tồn theo hàng · thanh mờ là sức chứa" bo={<Chon gt={loaiTon} dat={setLoaiTon} ds={KHO} />}>
        <TonHienTaiBD kho={kho} loai={loaiTon} cao={250} />
      </Khung>
      <Khung cao={CAO} ten="Tỉ lệ lấp đầy" phu={`theo khu vực · vạch vàng ${pct(NGUONG_KHO.vang)} · bấm bãi xem bãi nhỏ`}>
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
      <KhungKho cao={CAO} kho={kho} kyInfo={kyInfo} gd={gd || []} keHoach={keHoach} now={D.now} />
      <Khung cao={CAO} ten="Diễn biến tồn" phu={`${kyInfo.nhan} · tồn theo hàng, tính ngược từ tồn hiện tại`} bo={<Chon gt={loaiDB} dat={setLoaiDB} ds={KHO} />}>
        <DienBienTonBD key={loaiDB} kho={kho} loai={loaiDB} cao={230} kyChung={kyInfo} />
      </Khung>
      {moBai && kho.bai.some((b) => b.ten_bai === moBai) && <ChiTietBai b={kho.bai.find((b) => b.ten_bai === moBai)} kho={kho} onClose={() => setMoBai(null)} />}
    </div>
  );
}
