import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Clock, Plus, History, Ban, Undo2, CircleDollarSign, Settings2 } from "lucide-react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Field, Checkbox } from "@/components/ui/input";
import { NgayGio } from "@/components/ui/ngaygio";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrangThaiBadge, TienDo, MucIcon, ConfirmButton, Empty } from "@/components/common";
import { MOC, DU_KIEN, chiSo, rangBuocEtb, laChoHang } from "@/lib/linetime";
import { mocDuKien } from "@/lib/xepBen";
import { useCtxXep } from "./useXepBen";
import { duToan, laCQD, tenMoc } from "@/lib/laytime";
import { canhBaoChuyen } from "@/lib/checks";
import { so, met, ngayGio, ngayGioNam, thoiLuong, toLocalInput, fromLocalInput, tien, pct, ms, docSo } from "@/lib/format";
import { LY_DO_DUNG, TRU_MAC_DINH, TRONG_MANG_MAC_DINH } from "@/data/danhMucGoc";
import { cn } from "@/lib/utils";
import ChuyenForm from "./ChuyenForm";
import ChuyenBenTraHang from "./ChuyenBenTraHang";
import DieuKhoan from "./DieuKhoan";
import { useThietBi } from "@/thietbi/Host";
import { NHOM_TB, LOAI_MAC_DINH, tenBai, moTaTB, dsTB, tongTB, laBangTai, dsBangTai, dsGanCau } from "@/lib/thietBi";
import { cauTauCua, tinhSoBo, xeGoiY } from "@/lib/phuongAn";
import { useCau } from "./useCau";
import GhiKhoTuTau from "@/pages/kho/GhiKhoTuTau";
import { KhoiDiem, KhoiXe, KhoiTbKhac, CauTauO, CauGanO, sachTB, so0, nhan, the } from "./KhoiBaiXe";
import { tenBen, tenBenChuyen } from "./BangTauBen";
import { viTriChu } from "@/lib/tenBen";

// Phiếu chuyến tàu (như hình 2): thông tin, 7 mốc, chỉ số, thưởng phạt, làm hàng, nhật ký, khoảng dừng, lịch sử sửa.
// Mở dạng ngăn kéo bên phải; nội dung (NoiDungPhieu) dùng lại trong trang Phương án làm hàng.
export default function PhieuChuyen({ id, onClose }) {
  const { D } = useApp();
  const v = D.vmap.get(id);
  const cs = chiSo(v, D.stopsOf(id), D.now);
  return (
    <Dialog side="right" onOpenChange={(o) => !o && onClose()}
      title={<span className="flex flex-wrap items-center gap-2">{v.ten_tau}<TrangThaiBadge st={cs.trangThai} />{v.huy && <Badge tone="bad">Đã hủy</Badge>}</span>}
      description={moTaChuyen(v)}>
      <NoiDungPhieu v={v} onDaXoa={onClose} />
    </Dialog>
  );
}

export const moTaChuyen = (v) => `${v.ma_chuyen} · ${v.huong === "xuat" ? "Xuất" : "Nhập"} ${v.loai_hang || ""}${v.ben_ma ? ` · Bến ${tenBenChuyen(v)}` : " · Chưa xếp bến"}`;

// Nội dung phiếu chuyến: nút sửa / hủy / xóa, cảnh báo, các tab
export function NoiDungPhieu({ v, onDaXoa }) {
  const { D, quyen, run, api } = useApp();
  const id = v.id;
  const [sua, setSua] = useState(false);
  const [dk, setDk] = useState(false);
  const stops = D.stopsOf(id);
  const cs = chiSo(v, stops, D.now);
  const dt = duToan(v, stops, null, D.now);
  const canh = canhBaoChuyen(v, { berths: D.berths, trung: D.trung, stops, tien: t, nguong: D.nguong, now: D.now });
  const b = D.bmap[v.ben_ma], bPhu = v.ben_phu ? D.bmap[v.ben_phu] : null;
  const viTriBen = viTriChu(v.vi_tri, v.loa); // vị trí mét trên tuyến bến, VD (230–397)
  const gioiHan = (x) => `${tenBen(x.ma)} ≤ ${so(x.dwt_max)} DWT, mớn ${x.mon_cung ? "≤" : ""}${so(x.mon_max, 2)} m, dài ${met(x.loa_max)} m`;

  return (
    <>
      {quyen.nhap && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setSua(true)}><Pencil />Sửa thông tin</Button>
          <Button size="sm" variant="outline" onClick={() => run(() => api.updateVoyage(v.id, { huy: !v.huy }), v.huy ? "Đã khôi phục chuyến" : "Đã đánh dấu hủy chuyến")}>{v.huy ? <><Undo2 />Khôi phục</> : <><Ban />Hủy chuyến</>}</Button>
          {quyen.quanLy && <ConfirmButton size="sm" variant="outline" onConfirm={async () => { if (await run(() => api.deleteVoyage(v.id), `Đã xóa ${v.ma_chuyen}`)) onDaXoa?.(); }}><Trash2 />Xóa hẳn</ConfirmButton>}
        </div>
      )}
      {canh.length > 0 && (
        <div className="mb-3 grid gap-1.5 rounded-md border bg-muted/30 p-2.5 text-sm">
          {canh.map((c, i) => <div key={i} className="flex gap-2"><MucIcon muc={c.muc} className="mt-0.5" /><span>{c.nd}</span></div>)}
        </div>
      )}
      <Tabs defaultValue="tong">
        <TabsList>
          <TabsTrigger value="tong">Tổng quan</TabsTrigger>
          <TabsTrigger value="moc">Mốc giờ</TabsTrigger>
          <TabsTrigger value="pt">Bãi & Thiết bị</TabsTrigger>
          <TabsTrigger value="lam">Làm hàng</TabsTrigger>
          <TabsTrigger value="dung">Khoảng dừng ({stops.length})</TabsTrigger>
          <TabsTrigger value="doi">Chuyển bến & trả hàng</TabsTrigger>
          {quyen.quanLy && <TabsTrigger value="ls"><History />Lịch sử</TabsTrigger>}
        </TabsList>

        <TabsContent value="tong" className="grid gap-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <O l="Tàu" v={v.ten_tau} /><O l="DWT / mớn / LOA" v={[so(v.dwt), v.draft != null && so(v.draft, 2) + " m", v.loa != null && met(v.loa) + " m"].filter(Boolean).join(" · ")} />
            <O l="Bến" v={b ? `${tenBenChuyen(v)}${viTriBen ? ` ${viTriBen}` : ""} ${bPhu ? "(cập hai bến)" : `(≤ ${so(b.dwt_max)} DWT, mớn ${b.mon_cung ? "≤" : ""}${so(b.mon_max, 2)} m)`}` : "Chưa xếp"} sub={b && bPhu ? `${gioiHan(b)} · ${gioiHan(bPhu)}` : null} />
            <O l="Hàng" v={`${v.huong === "xuat" ? "Xuất" : "Nhập"} · ${v.loai_hang || ""}`}
              sub={(v.hang_ds || []).length > 1 ? v.hang_ds.map((h) => `${h.ten_hang || h.loai_hang || "?"}${h.khoi_luong != null ? ` ${so(h.khoi_luong)} t` : ""}`).join(" · ") : v.ten_hang} /><O l="Tổng khối lượng" v={`${so(v.khoi_luong)} t`} />
            <O l="Cam kết xếp dỡ" v={+v.cam_ket ? `${so(v.cam_ket)} t/ngày` : v.cam_ket_ghi_chu || "—"} sub={+v.cam_ket && v.cam_ket_ghi_chu ? `Ghi chú: ${v.cam_ket_ghi_chu}` : null} />
            <O l="Số máng" v={v.so_mang != null ? `${v.so_mang} máng` : "—"} />
            <O l="Cẩu thực hiện" v={(v.cau || []).join("; ") || "—"} sub={[v.bang_tai && `Băng tải ${v.bang_tai}`, dsGanCau(v.cau_gan).length && `Gắn: ${dsGanCau(v.cau_gan).join(", ")}`].filter(Boolean).join(" · ") || null} />
            <O l="Ngày cập dự kiến / thực tế" v={`${ngayGio(v.etb) || "—"} / ${ngayGio(v.atb) || "—"}`} />
            <O l="Ngày rời dự kiến / thực tế" v={`${ngayGio(v.etd) || "—"} / ${ngayGio(v.atd) || "—"}`} />
            <O l={tenBai(v)} v={(v.bai_kl || []).filter((x) => x.bai).length ? v.bai_kl.filter((x) => x.bai).map((x) => `${x.bai}${x.khu ? ` › ${x.khu}` : ""}${x.khoi_luong != null ? ` ${so(x.khoi_luong)} t` : ""}`).join("; ") : v.bai_hang} /><O l="Ghi chú" v={v.ghi_chu} />
            {NHOM_TB.map((n) => <O key={n.k} l={n.ten(v)} v={moTaTB(v[n.k]) || "—"} sub={dsTB(v[n.k]).length ? `Hòa Phát ${tongTB(v[n.k], "hoa_phat")} · Nhà thầu ${tongTB(v[n.k], "nha_thau")}` : null} />)}
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tiến độ làm hàng</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Chi l="Hoàn tất" v={`${so(cs.daLam)} t`} sub={<TienDo v={cs.hoanTat} />} />
              <Chi l="Còn lại" v={`${so(cs.conLai)} t`} />
              <Chi l="Năng suất thực" v={cs.nangSuat != null ? `${so(cs.nangSuat)} t/ngày` : "—"} sub={cs.soCamKet != null ? `${pct(cs.soCamKet)} cam kết` : null} />
              <Chi l="Chờ bến (từ NOR)" v={thoiLuong(cs.choNeo) || "—"} />
              <Chi l="Ở bến" v={thoiLuong(cs.oBen) || "—"} />
              <Chi l="Làm hàng (gộp / thực)" v={cs.lamHang != null ? `${thoiLuong(cs.lamHang, { ngan: true })} / ${thoiLuong(cs.lamHangThuc, { ngan: true })}` : "—"} />
              <Chi l="Tổng dừng" v={thoiLuong(cs.dung) || "0 giờ"} />
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><CircleDollarSign className="h-3.5 w-3.5" />Laytime (dự toán)
              <Badge tone={dt.kieu === "cqd" ? "warn" : "info"}>{dt.kieu === "cqd" ? "CQD" : "Laytime"}</Badge>
              <Button size="xs" variant="ghost" className="ml-auto normal-case" onClick={() => setDk(true)}><Settings2 />Điều khoản</Button></div>
            {dt.thieu.length ? <div className="text-sm text-muted-foreground">Chưa tính được: thiếu {dt.thieu.join(", ")}.</div> : dt.kieu === "cqd" ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Chi l="Giờ trống máng" v={thoiLuong(dt.trongMangGio) || "0 giờ"} sub={v.kt_lam_hang ? "cả chuyến" : "đến hiện tại"} />
                <Chi l="Ngưỡng cho phép" v={thoiLuong(dt.nguongGio) || "0 giờ"} sub="theo hợp đồng" />
                <Chi l={dt.vuotGio > 0 ? "Vượt ngưỡng" : "Còn được trống"} v={thoiLuong(dt.vuotGio > 0 ? dt.vuotGio : dt.conLaiGio) || "0 giờ"} tone={dt.vuotGio > 0 ? "text-bad" : "text-ok"} sub={dt.vuotGio > 0 ? "bị phạt" : "chưa bị phạt"} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Chi l="Laytime bắt đầu" v={ngayGio(dt.batDau.t)} sub={dt.batDau.ten} tone={dt.batDau.tam ? "text-warn" : undefined} />
                <Chi l="Thời gian cho phép" v={thoiLuong(dt.choPhepNgay * 24)} sub={`${so(v.khoi_luong)} ÷ ${so(v.cam_ket)} t/ngày`} />
                <Chi l="Hết laytime (hạn không phạt)" v={ngayGioNam(dt.han)} sub={dt.loaiTruGio ? `đã trừ ${thoiLuong(dt.loaiTruGio, { ngan: true })} đình trệ cho phép` : "chưa có thời gian được trừ"} />
                <Chi l={v.kt_lam_hang ? "Đã dùng" : "Dự báo dùng"} v={dt.daDungNgay != null ? thoiLuong(dt.daDungNgay * 24) : "—"} sub={!v.kt_lam_hang && dt.ketThuc ? `xong khoảng ${ngayGio(dt.ketThuc)}` : null} />
                <Chi l="Chênh lệch" v={dt.chenhNgay != null ? thoiLuong(dt.chenhNgay * 24) : "—"} tone={dt.chenhNgay < 0 ? "text-bad" : dt.chenhNgay > 0 ? "text-ok" : undefined} sub={dt.chenhNgay < 0 ? "quá laytime, bị phạt" : dt.chenhNgay > 0 ? "xong sớm, được thưởng" : null} />
                {!v.kt_lam_hang && <Chi l="Laytime còn lại" v={thoiLuong((dt.han - D.now) / 36e5)} tone={dt.han < D.now ? "text-bad" : undefined} />}
                {dt.nangSuatToiThieu != null && <Chi l="Năng suất tối thiểu để không phạt" v={Number.isFinite(dt.nangSuatToiThieu) ? `${so(dt.nangSuatToiThieu)} t/ngày` : "Đã hết laytime"} tone={dt.nangSuatToiThieu > +v.cam_ket ? "text-bad" : undefined} />}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="moc"><MocGio v={v} moDieuKhoan={() => setDk(true)} /></TabsContent>
        <TabsContent value="pt"><BaiThietBi v={v} /></TabsContent>
        <TabsContent value="doi"><ChuyenBenTraHang v={v} /></TabsContent>
        <TabsContent value="lam"><LamHang v={v} cs={cs} /></TabsContent>
        <TabsContent value="dung"><KhoangDung v={v} stops={stops} /></TabsContent>
        {quyen.quanLy && <TabsContent value="ls"><LichSu v={v} /></TabsContent>}
      </Tabs>
      {sua && <ChuyenForm v={v} onClose={() => setSua(false)} />}
      {dk && <DieuKhoan v={v} onClose={() => setDk(false)} />}
    </>
  );
}

const O = ({ l, v, sub }) => <div className="min-w-0"><div className="text-[0.6875rem] text-muted-foreground">{l}</div><div className="truncate font-medium" title={typeof v === "string" ? v : undefined}>{v || "—"}</div>{sub && <div className="truncate text-[0.6875rem] text-muted-foreground">{sub}</div>}</div>;
const Chi = ({ l, v, sub, tone }) => <div className="rounded-md border bg-background/50 p-2"><div className="text-[0.6875rem] text-muted-foreground">{l}</div><div className={cn("text-[0.9375rem] font-semibold tabular-nums", tone)}>{v}</div>{sub && <div className="mt-0.5 text-[0.6875rem] text-muted-foreground">{sub}</div>}</div>;

// 7 mốc thực tế + giờ dự kiến + mốc bắt đầu tính thưởng phạt. Lưu ngay khi rời ô.
function MocGio({ v, moDieuKhoan }) {
  const { D, quyen, run, api, toast } = useApp();
  const ctxXep = useCtxXep();
  // Mốc dự kiến (chưa nhập thực tế): bắt đầu làm hàng = cập + 1 giờ, thủ tục = kết thúc làm hàng + 2 giờ, rời = thủ tục + 30 phút
  const dk = mocDuKien(v, ctxXep), DK = { atb: dk.cap, bd_lam_hang: dk.bd, kt_lam_hang: dk.kt, hoan_tat_tt: dk.thuTuc, atd: dk.roi };
  // ETB luôn sau ETA: ETA đổi hoặc ETB nhập trước ETA thì web tự xếp lại ETB (gợi ý theo bến trống), ETD dời theo
  const luu = (k, val) => {
    const moi = fromLocalInput(val); if ((moi && ms(moi)) === (v[k] && ms(v[k]))) return;
    const patch = ["eta", "etb", "etd"].includes(k) ? rangBuocEtb(v, { [k]: moi }, ctxXep) : { [k]: moi };
    const xep = patch.etb && patch.etb !== (k === "etb" ? moi : v.etb) && ms(patch.etb) !== ms(v.etb);
    run(() => api.updateVoyage(v.id, patch), xep ? `Đã lưu; ETB tự xếp lại sau ETA: ${ngayGio(patch.etb)}` : "Đã lưu mốc giờ");
  };
  const dong = (m, i) => (
    <div key={m.k} className="flex flex-wrap items-center gap-2 border-b py-1.5 last:border-0">
      <span className="w-6 text-center font-mono text-xs text-muted-foreground">{i ?? ""}</span>
      <span className="min-w-[200px] flex-1 text-sm">{m.ten}{!v[m.k] && DK[m.k] != null && <span className="ml-2 text-xs text-muted-foreground" title="Tự tính theo nguyên tắc; trạng thái tàu tự chạy theo giờ này khi chưa nhập mốc thực tế">dự kiến {ngayGio(DK[m.k])}</span>}</span>
      {quyen.nhap ? <>
        <NgayGio className="w-[200px]" inputClassName="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={toLocalInput(v[m.k])} onChange={(x) => luu(m.k, x)} aria-label={m.ten} />
        <Button size="xs" variant="ghost" title="Ghi giờ hiện tại" onClick={() => luu(m.k, toLocalInput(Date.now()))}><Clock />Bây giờ</Button>
      </> : <span className="tabular-nums">{ngayGioNam(v[m.k]) || "—"}</span>}
    </div>
  );
  return (
    <div className="grid gap-4">
      <div><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mốc thực tế</div>{MOC.map((m, i) => dong(m, i + 1))}</div>
      <div><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Giờ dự kiến (kéo thả trên lịch cầu bến cũng sửa hai giờ này)</div>{DU_KIEN.map((m) => dong(m))}</div>
      <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
        <span className="flex-1">{laCQD(v) ? <>Tính theo <b>CQD</b>: ngưỡng trống máng {so(v.cqd_nguong_gio, 1) || 0} giờ.</>
          : <>Laytime bắt đầu: <b>{tenMoc(v.moc_tinh_tp)}</b>{v.moc_tinh_tp === "tay" && v.tg_tinh_tp ? ` (${ngayGio(v.tg_tinh_tp)})` : ""}; làm hàng sớm hơn thì tính từ lúc bắt đầu làm hàng.</>}</span>
        <Button size="sm" variant="outline" onClick={moDieuKhoan}><Settings2 />Điều khoản xếp dỡ</Button>
      </div>
    </div>
  );
}

// KL đã làm, cẩu thực hiện, nhật ký sự kiện (Statement of Facts)
function LamHang({ v, cs }) {
  const { D, quyen, run, api, fail } = useApp();
  const [ev, setEv] = useState(null);
  const [f, setF] = useState({ thoi_diem: toLocalInput(Date.now()), noi_dung: "", kl_luy_ke: "" });
  const tai = () => api.loadEvents(v.id).then(setEv).catch(fail);
  useEffect(() => { tai(); }, [v.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const them = async () => {
    if (!f.noi_dung.trim()) return;
    const kl = f.kl_luy_ke === "" ? null : docSo(f.kl_luy_ke) ?? NaN;
    const r = await run(async () => {
      await api.addEvent({ voyage_id: v.id, thoi_diem: fromLocalInput(f.thoi_diem), noi_dung: f.noi_dung.trim(), kl_luy_ke: kl });
      if (kl != null && (v.da_lam == null || kl >= +v.da_lam)) await api.updateVoyage(v.id, { da_lam: kl }); // KL lũy kế mới nhất -> KL đã làm
    }, "Đã ghi nhật ký");
    if (r) { setF({ thoi_diem: toLocalInput(Date.now()), noi_dung: "", kl_luy_ke: "" }); tai(); }
  };
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label={`KL đã làm (tấn) · tổng ${so(v.khoi_luong)} t`}>
          {quyen.nhap ? <Input key={v.da_lam ?? "x"} className="num w-48" inputMode="decimal" defaultValue={v.da_lam ?? ""} onBlur={(e) => { const n = e.target.value === "" ? null : docSo(e.target.value) ?? NaN; if (n !== (v.da_lam ?? null) && (n == null || Number.isFinite(n))) run(() => api.updateVoyage(v.id, { da_lam: n }), "Đã cập nhật KL đã làm"); }} />
            : <div className="font-semibold">{so(cs.daLam)} t</div>}
        </Field>
        <TienDo v={cs.hoanTat} className="w-64" />
      </div>
      <GhiKhoTuTau v={v} />
      <div>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nhật ký sự kiện theo giờ</div>
        {quyen.nhap && (
          <div className="mb-2 grid gap-2 sm:grid-cols-[200px_1fr_120px_auto]">
            <NgayGio value={f.thoi_diem} onChange={(x) => setF((o) => ({ ...o, thoi_diem: x }))} aria-label="Thời điểm" />
            <Input value={f.noi_dung} onChange={(e) => setF({ ...f, noi_dung: e.target.value })} placeholder="Nội dung: bàn giao ca, bắt đầu dỡ hầm 2…" onKeyDown={(e) => e.key === "Enter" && them()} />
            <Input className="num" inputMode="decimal" value={f.kl_luy_ke} onChange={(e) => setF({ ...f, kl_luy_ke: e.target.value })} placeholder="KL lũy kế" title="Khối lượng lũy kế (tấn), có thì tự cập nhật KL đã làm" />
            <Button onClick={them}><Plus />Ghi</Button>
          </div>
        )}
        {ev == null ? <div className="text-sm text-muted-foreground">Đang tải…</div> : ev.length ? (
          <table className="tbl"><tbody>{[...ev].reverse().map((e) => (
            <tr key={e.id}><td className="w-36 whitespace-nowrap tabular-nums">{ngayGioNam(e.thoi_diem)}</td><td>{e.noi_dung}</td><td className="num whitespace-nowrap">{e.kl_luy_ke != null ? `${so(e.kl_luy_ke)} t` : ""}</td>
              <td className="w-10">{quyen.nhap && <ConfirmButton confirmText="Xóa?" onConfirm={async () => { if (await run(() => api.deleteEvent(e.id))) tai(); }}><Trash2 /></ConfirmButton>}</td></tr>))}</tbody></table>
        ) : <Empty>Chưa có nhật ký.</Empty>}
      </div>
    </div>
  );
}

// Khoảng dừng có lý do; đánh dấu "trừ thưởng phạt" để loại khỏi thời gian sử dụng
function KhoangDung({ v, stops }) {
  const { quyen, run, api } = useApp();
  const macDinh = (ly_do) => ({ ly_do, tru_tp: TRU_MAC_DINH.has(ly_do), trong_mang: TRONG_MANG_MAC_DINH.has(ly_do) });
  const [f, setF] = useState({ tu: "", den: "", ...macDinh(LY_DO_DUNG[0]), ghi_chu: "" });
  const them = async () => {
    if (!f.tu) return;
    if (f.den && f.den <= f.tu) return;
    if (await run(() => api.addStop({ voyage_id: v.id, tu: fromLocalInput(f.tu), den: fromLocalInput(f.den), ly_do: f.ly_do, tru_tp: f.tru_tp, trong_mang: f.trong_mang, ghi_chu: f.ghi_chu.trim() || null }), "Đã ghi khoảng dừng"))
      setF({ ...f, tu: "", den: "", ghi_chu: "" });
  };
  const ds = [...stops].sort((a, b) => String(a.tu).localeCompare(String(b.tu)));
  const tong = (chiTru) => ds.filter((s) => !laChoHang(s) && (!chiTru || s.tru_tp)).reduce((h, s) => h + ((ms(s.den) ?? Date.now()) - ms(s.tu)) / 36e5, 0);
  return (
    <div className="grid gap-3">
      <div className="text-sm text-muted-foreground">Tổng dừng <b className="text-foreground">{thoiLuong(tong(false)) || "0 giờ"}</b>, trong đó đình trệ cho phép (trừ laytime) <b className="text-foreground">{thoiLuong(tong(true)) || "0 giờ"}</b>, trống máng <b className="text-foreground">{thoiLuong(ds.filter((s) => s.trong_mang).reduce((h, s) => h + ((ms(s.den) ?? Date.now()) - ms(s.tu)) / 36e5, 0)) || "0 giờ"}</b>. Thời gian hoa tiêu lên tàu → cập bến tự trừ theo điều khoản, không cần nhập ở đây.</div>
      {quyen.nhap && (
        <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-3">
          <Field label="Từ"><NgayGio value={f.tu} onChange={(x) => setF((o) => ({ ...o, tu: x }))} /></Field>
          <Field label="Đến (trống = đang dừng)"><NgayGio value={f.den} onChange={(x) => setF((o) => ({ ...o, den: x }))} /></Field>
          <Field label="Lý do" hint={laChoHang({ ly_do: f.ly_do }) ? "Tàu chưa cập: vẽ xanh lá trong đoạn chờ bến (lịch cầu bến › Toàn thời gian)" : undefined}><NativeSelect value={f.ly_do} onChange={(e) => setF({ ...f, ...macDinh(e.target.value) })} options={LY_DO_DUNG} /></Field>
          <Field label="Ghi chú" className="sm:col-span-2"><Input value={f.ghi_chu} onChange={(e) => setF({ ...f, ghi_chu: e.target.value })} /></Field>
          <div className="flex items-end justify-between gap-2">
            <div className="grid gap-1">
              <label className="flex items-center gap-2 text-sm" title="Thời gian đình trệ cho phép: không tính vào laytime (thời tiết xấu, hoa tiêu, lai dắt…)"><Checkbox checked={f.tru_tp} onChange={(e) => setF({ ...f, tru_tp: e.target.checked })} />Trừ laytime</label>
              <label className="flex items-center gap-2 text-sm" title="Tàu CQD: máng không có hàng chảy, tính vào giờ trống máng"><Checkbox checked={f.trong_mang} onChange={(e) => setF({ ...f, trong_mang: e.target.checked })} />Trống máng (CQD)</label>
            </div>
            <Button onClick={them} disabled={!f.tu}><Plus />Thêm</Button>
          </div>
        </div>
      )}
      {ds.length ? (
        <table className="tbl"><thead><tr><th>Từ</th><th>Đến</th><th className="num">Giờ</th><th>Lý do</th><th>Trừ laytime</th><th>Trống máng</th><th></th></tr></thead>
          <tbody>{ds.map((s) => (
            <tr key={s.id}>
              <td className="whitespace-nowrap tabular-nums">{ngayGio(s.tu)}</td>
              <td className="whitespace-nowrap tabular-nums">{s.den ? ngayGio(s.den) : quyen.nhap ? <Button size="xs" variant="outline" onClick={() => run(() => api.updateStop(s.id, { den: new Date().toISOString() }), "Đã kết thúc khoảng dừng")}>Kết thúc ngay</Button> : <Badge tone="warn">Đang dừng</Badge>}</td>
              <td className="num">{so(((ms(s.den) ?? Date.now()) - ms(s.tu)) / 36e5, 2)}</td>
              <td>{s.ly_do}{s.ghi_chu && <div className="text-[0.6875rem] text-muted-foreground">{s.ghi_chu}</div>}</td>
              <td><Checkbox disabled={!quyen.nhap} checked={s.tru_tp} onChange={(e) => run(() => api.updateStop(s.id, { tru_tp: e.target.checked }), "Đã đổi")} aria-label="Trừ laytime" /></td>
              <td><Checkbox disabled={!quyen.nhap} checked={!!s.trong_mang} onChange={(e) => run(() => api.updateStop(s.id, { trong_mang: e.target.checked }), "Đã đổi")} aria-label="Trống máng" /></td>
              <td>{quyen.quanLy && <ConfirmButton confirmText="Xóa?" onConfirm={() => run(() => api.deleteStop(s.id), "Đã xóa khoảng dừng")}><Trash2 /></ConfirmButton>}</td>
            </tr>))}</tbody></table>
      ) : <Empty>Chưa có khoảng dừng.</Empty>}
    </div>
  );
}

const TEN_COT = Object.fromEntries([...MOC.map((m) => [m.k, m.ngan]), ["etb", "ETB"], ["etd", "ETD"], ["da_lam", "KL đã làm"], ["khoi_luong", "KL"], ["ben_ma", "Bến"], ["cam_ket", "Cam kết"], ["don_gia", "Đơn giá"], ["ty_le_thuong", "Tỷ lệ thưởng"], ["huy", "Hủy"], ["cau", "Cẩu"], ["tru_tp", "Trừ laytime"], ["trong_mang", "Trống máng"], ["kieu_tp", "Kiểu tính"], ["moc_tinh_tp", "Laytime bắt đầu"], ["tru_hoa_tieu", "Trừ hoa tiêu"], ["cqd_nguong_gio", "Ngưỡng CQD"], ["don_vi_tien", "Đơn vị tiền"], ["tg_tinh_tp", "Giờ tính tay"], ["den", "Đến"], ["tu", "Từ"], ["bai_hang", "Bãi"], ["xe_van_chuyen", "Xe vận chuyển"], ["hot_vet", "Hót vét / be hầm"], ["vun_hang", "Lên / vun hàng"], ["cau_tau", "Cẩu tàu"], ["bai_kl", "Bãi và điểm hạ hàng"]]);
const BO_QUA = new Set(["updated_at", "created_at", "created_by", "id", "voyage_id"]);
const hienGT = (x) => (x == null || x === "" ? "∅" : typeof x === "string" && /^\d{4}-\d\d-\d\dT/.test(x) ? ngayGio(x) : Array.isArray(x) ? x.map((y) => (y && typeof y === "object" ? `${y.loai} ${y.so ?? ""}` : y)).join(", ") : String(x));

// Lịch sử sửa (audit_log): chỉ quản lý / quản trị
function LichSu({ v }) {
  const { api, fail } = useApp();
  const [ds, setDs] = useState(null);
  useEffect(() => { api.loadAudit(v.id).then(setDs).catch(fail); }, [v.id, v.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  if (ds == null) return <div className="text-sm text-muted-foreground">Đang tải…</div>;
  if (!ds.length) return <Empty>Chưa có lịch sử sửa (chế độ demo chỉ ghi các thao tác trong phiên này).</Empty>;
  return (
    <div className="grid gap-2">
      {ds.map((a) => {
        const doi = a.hanh_dong === "UPDATE" ? Object.keys(a.moi || {}).filter((k) => !BO_QUA.has(k) && JSON.stringify(a.moi[k]) !== JSON.stringify(a.cu?.[k])) : [];
        return (
          <div key={a.id} className="rounded-md border p-2 text-sm">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="tabular-nums">{ngayGioNam(a.luc)}</span><Badge tone={a.hanh_dong === "DELETE" ? "bad" : a.hanh_dong === "INSERT" ? "ok" : "info"}>{a.hanh_dong === "INSERT" ? "Thêm" : a.hanh_dong === "DELETE" ? "Xóa" : "Sửa"}</Badge><span>{a.bang === "voyages" ? "Chuyến" : a.bang === "voyage_stops" ? "Khoảng dừng" : "Tiền"}</span></div>
            {doi.length > 0 && <div className="mt-1 grid gap-0.5">{doi.map((k) => <div key={k}><span className="text-muted-foreground">{TEN_COT[k] || k}:</span> {hienGT(a.cu?.[k])} → <b>{hienGT(a.moi[k])}</b></div>)}</div>}
          </div>
        );
      })}
    </div>
  );
}

// Tab Bãi & Thiết bị (người lập phương án khai, tự điền vào Lập phương án): cùng giao diện với hộp Lập phương án (KhoiBaiXe.jsx)
//   - Bãi nhận / lấy hàng theo bãi nhỏ: tồn hiện tại, khối lượng và thiết bị hạ hàng / vun hàng (lên hàng) tại từng điểm
//   - Cẩu / thiết bị làm hàng của bến, cẩu tàu và tuyến băng tải làm hàng (cẩu, băng tải lưu ngay khi bấm)
//   - Vét hầm (tàu nhập) / be hầm (tàu xuất)
//   - Xe vận chuyển mỗi ca, thiết bị be hầm / hót vét / hỗ trợ chung (đơn vị Hòa Phát hoặc nhà thầu)
// Chuyến đã có phương án thì Linetime, Kế hoạch ngày tới… lấy các mục này theo phương án.
const boChon = (x) => JSON.stringify(x, (k, val) => (k === "_chon" ? undefined : val));
function BaiThietBi({ v }) {
  const { D, quyen, run, api, toast } = useApp();
  const c19 = !!D.coSql19;
  const xuat = v.huong === "xuat";
  const tbD = useThietBi()?.D;
  // Điểm hạ / lên hàng: bãi nhỏ + khối lượng + thiết bị tại điểm (chuyến cũ chỉ có danh sách vun hàng chung: đặt ở điểm đầu)
  const diemGoc = () => {
    const ds = (v.bai_kl || []).filter((b) => b.bai || dsTB(b.tb).length);
    const goc = ds.length ? ds : String(v.bai_hang || "").split(";").map((b) => b.trim()).filter(Boolean).map((bai) => ({ bai, khoi_luong: null }));
    const theoDiem = goc.some((b) => dsTB(b.tb).length);
    const r = goc.map((b, i) => ({ bai: b.bai || "", khu: b.khu || null, khoi_luong: b.khoi_luong ?? "", tb: (theoDiem ? dsTB(b.tb) : i ? [] : dsTB(v.vun_hang)).map((t) => ({ ...t })) }));
    return r.length ? r : [{ bai: "", khu: null, khoi_luong: "", tb: dsTB(v.vun_hang).map((t) => ({ ...t })) }];
  };
  const xeGoc = () => dsTB(v.xe_van_chuyen).filter((x) => !laBangTai(x.loai)).map((x) => ({ loai: x.loai, tai_trong: x.tai_trong ?? "", chuyen_ca: x.chuyen_ca ?? "", so_xe: x.so ?? "", don_vi: x.don_vi || "hoa_phat" }));
  const khacGoc = () => dsTB(v.hot_vet).map((t) => ({ viec: t.viec || "be_ham", loai: t.loai, so: t.so ?? "", don_vi: t.don_vi || "hoa_phat" }));
  const cauTauGoc = () => (cauTauCua(v) ? { so: cauTauCua(v).so ?? "", nang_suat: cauTauCua(v).nang_suat ?? "" } : null);
  const moi = () => ({ diem: diemGoc(), xe: xeGoc(), khac: khacGoc(), cauTau: cauTauGoc() });
  const [f, setF] = useState(moi);
  // Chỉ nạp lại khi bãi / phương tiện đã lưu thay đổi (bấm cẩu, băng tải lưu ngay không làm mất phần đang sửa)
  const daLuu = JSON.stringify([v.id, v.bai_kl, v.bai_hang, v.cau_tau, ...NHOM_TB.map((n) => v[n.k])]);
  useEffect(() => { setF(moi()); }, [daLuu]); // eslint-disable-line react-hooks/exhaustive-deps
  const loaiGoiY = [...new Set([...(tbD?.doiList || []), ...LOAI_MAC_DINH])];
  // Số xe mỗi ca tự tính: tốc độ theo cẩu đã chọn + cẩu tàu đang nhập (chưa có thì theo cam kết) → tấn mỗi ca ÷ (tải trọng × số chuyến một xe)
  const cranes = useCau();
  const cauTauForm = f.cauTau ? { so: so0(f.cauTau.so), nang_suat: so0(f.cauTau.nang_suat) } : null;
  const tanCa = useMemo(() => tinhSoBo(v, { cranes, stops: D.stopsOf(v.id), now: D.now }, { cauTau: cauTauForm, xe: [] }).tanCa, [v, cranes, f.cauTau]); // eslint-disable-line react-hooks/exhaustive-deps
  const goiYXe = (x) => xeGoiY(tanCa, { tai_trong: so0(x.tai_trong), chuyen_ca: so0(x.chuyen_ca) });
  const doi = boChon(f) !== boChon(moi());
  const khongAm = (ds, k) => ds.some((r) => r[k] != null && r[k] !== "" && !(so0(r[k]) >= 0));
  const luu = () => {
    const diem = f.diem.map((d) => ({ bai: String(d.bai || "").trim(), khu: d.khu || null, khoi_luong: so0(d.khoi_luong), tb: sachTB(d.tb) })).filter((d) => d.bai || d.tb.length);
    if (diem.some((d) => d.khoi_luong != null && !(d.khoi_luong >= 0))) return toast("Khối lượng bãi phải là số không âm", "bad");
    if (khongAm(f.xe, "so_xe") || khongAm(f.xe, "tai_trong") || khongAm(f.xe, "chuyen_ca") || f.diem.some((d) => khongAm(d.tb || [], "so")) || khongAm(f.khac, "so")) return toast("Số lượng phải là số không âm", "bad");
    const xe = f.xe.filter((x) => String(x.loai || "").trim()).map((x) => ({ loai: String(x.loai).trim(), so: so0(x.so_xe) ?? goiYXe(x), don_vi: x.don_vi || "hoa_phat", ...(so0(x.tai_trong) != null ? { tai_trong: so0(x.tai_trong) } : {}), ...(so0(x.chuyen_ca) != null ? { chuyen_ca: so0(x.chuyen_ca) } : {}) }));
    const patch = {
      bai_hang: [...new Set(diem.map((d) => d.bai).filter(Boolean))].join("; ") || null,
      ...(c19 ? { bai_kl: diem } : {}),
      xe_van_chuyen: [...xe, ...dsTB(v.xe_van_chuyen).filter((x) => laBangTai(x.loai))], // dòng băng tải của chuyến cũ giữ nguyên
      hot_vet: f.khac.filter((t) => String(t.loai || "").trim()).map((t) => ({ viec: t.viec || "be_ham", ...sachTB([t])[0] })),
      vun_hang: diem.flatMap((d) => d.tb),
      ...(D.coSql24 ? { cau_tau: f.cauTau ? { so: so0(f.cauTau.so), nang_suat: so0(f.cauTau.nang_suat) } : null } : {}),
    };
    run(() => api.updateVoyage(v.id, patch), "Đã lưu bãi và phương tiện của chuyến");
  };

  // Cẩu nằm trong danh mục thiết bị cơ giới (đội "Cẩu"), lọc theo bến phục vụ; băng tải theo danh mục cầu bến (chưa có thì theo cẩu)
  const benTau = [v.ben_ma, v.ben_phu].filter(Boolean); // tàu cập hai bến: cẩu của cả hai bến
  const cauBen = (tbD?.vehicles || []).filter((x) => x.doi === "Cẩu" && (x.ben_phuc_vu || []).some((m) => benTau.includes(m))).map((x) => ({ ...x, loai: x.model, nang_suat_th: x.nang_suat }));
  const cauKhac = (v.cau || []).filter((c) => !cauBen.some((x) => x.ma === c));
  const doiCau = (ma, on) => run(() => api.updateVoyage(v.id, { cau: on ? [...(v.cau || []), ma] : (v.cau || []).filter((x) => x !== ma) }));
  const btKhaiBao = [...new Set(benTau.flatMap((m) => dsBangTai(D.bmap[m]?.bang_tai)))];
  const btBen = btKhaiBao.length ? btKhaiBao : [...new Set(cauBen.flatMap((c) => dsBangTai(c.bang_tai)))].sort();
  const btChon = dsBangTai(v.bang_tai);
  const doiGan = (cau_gan) => run(() => api.updateVoyage(v.id, { cau_gan }));
  const doiBT = (t, on) => run(() => api.updateVoyage(v.id, { bang_tai: (on ? [...btChon, t] : btChon.filter((x) => x !== t)).join(", ") || null }));

  return (
    <div className="grid gap-4">
      <datalist id="ds-doi-xe">{loaiGoiY.map((x) => <option key={x} value={x} />)}</datalist>
      <KhoiDiem v={v} diem={f.diem} disabled={!quyen.nhap} onChange={(diem) => setF((o) => ({ ...o, diem }))} />

      <div>
        <div className={cn(nhan, "mb-1.5")}>Cẩu / thiết bị làm hàng {v.ben_ma ? `của bến ${tenBenChuyen(v)}` : ""}</div>
        <div className="flex flex-wrap items-center gap-2">
          {cauBen.map((c) => (
            <label key={c.ma} className={the((v.cau || []).includes(c.ma))} title={[c.loai, c.tai_nang, c.nang_suat_th && `${c.nang_suat_th} t/h`, c.bang_tai && `băng tải ${c.bang_tai}`, c.ghi_chu].filter(Boolean).join(" · ")}>
              <Checkbox disabled={!quyen.nhap} checked={(v.cau || []).includes(c.ma)} onChange={(e) => doiCau(c.ma, e.target.checked)} />{c.ma}
            </label>))}
          {cauKhac.map((c) => <Badge key={c} tone="outline">{c}</Badge>)}
          {!cauBen.length && !cauKhac.length && <span className="text-sm text-muted-foreground">{v.ben_ma ? "Bến chưa có cẩu trong danh mục." : "Chưa xếp bến."}</span>}
          {D.coSql24 ? <CauTauO value={f.cauTau} disabled={!quyen.nhap} onChange={(cauTau) => setF((o) => ({ ...o, cauTau }))} /> : <span className="text-xs text-muted-foreground">Cẩu tàu: cần chạy SQL 24 trong Supabase.</span>}
        </div>
        {D.coSql25 ? <CauGanO value={v.cau_gan} options={tbD?.thietBiGanCauList || []} disabled={!quyen.nhap} onChange={doiGan} />
          : <div className="mt-2 text-xs text-muted-foreground">Thiết bị gắn cẩu: cần chạy SQL 25 trong Supabase.</div>}
      </div>
      <div>
        <div className={cn(nhan, "mb-1.5")}>Tuyến băng tải làm hàng {v.ben_ma ? `của bến ${tenBenChuyen(v)}` : ""}</div>
        {!c19 ? <div className="text-sm text-muted-foreground">Cần chạy SQL 19 trong Supabase.</div> : (
          <div className="flex flex-wrap gap-2">
            {[...new Set([...btBen, ...btChon])].map((t) => (
              <label key={t} className={the(btChon.includes(t))}><Checkbox disabled={!quyen.nhap} checked={btChon.includes(t)} onChange={(e) => doiBT(t, e.target.checked)} />{t}</label>))}
            {!btBen.length && !btChon.length && <span className="text-sm text-muted-foreground">{v.ben_ma ? "Bến chưa khai báo băng tải làm hàng (Danh mục › Cầu bến)." : "Chưa xếp bến."}</span>}
          </div>)}
      </div>
      {c19 && (
        <label className={cn(the(xuat ? v.be_ham : v.vet_ham), "w-fit")}>
          <Checkbox disabled={!quyen.nhap} checked={!!(xuat ? v.be_ham : v.vet_ham)} onChange={(e) => run(() => api.updateVoyage(v.id, xuat ? { be_ham: e.target.checked } : { vet_ham: e.target.checked }))} />
          {xuat ? "Be hầm (xuất hàng thành phẩm)" : "Vét hầm (nhập hàng rời)"}
        </label>)}

      <KhoiXe xe={f.xe} disabled={!quyen.nhap} tuDien goiY={goiYXe} tieuDe={tanCa ? `· số xe tự tính theo ${so(tanCa)} t/ca (cẩu đã chọn, cẩu tàu; chưa có cẩu thì theo cam kết)` : "· nhập tải trọng và số chuyến để tự tính số xe (cần chọn cẩu hoặc có cam kết)"} onChange={(xe) => setF((o) => ({ ...o, xe }))} />
      <KhoiTbKhac ds={f.khac} disabled={!quyen.nhap} onChange={(khac) => setF((o) => ({ ...o, khac }))} />

      <div className="flex items-center gap-2 border-t pt-3">
        <span className="flex-1 text-xs text-muted-foreground">Cẩu, thiết bị gắn cẩu, băng tải, vét / be hầm lưu ngay khi bấm. Bãi, cẩu tàu và phương tiện bấm Lưu. Các mục này dùng cho Kế hoạch & phân bổ › Dài hạn và kho bãi.</span>
        {quyen.nhap && <Button disabled={!doi} onClick={luu}>Lưu bãi & phương tiện</Button>}
      </div>
    </div>
  );
}
