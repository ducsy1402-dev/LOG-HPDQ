import { useState } from "react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Field, Checkbox } from "@/components/ui/input";
import { NgayGio } from "@/components/ui/ngaygio";
import { Dialog } from "@/components/ui/dialog";
import { KIEU_TP, MOC_TP, MOC_MAC_DINH } from "@/lib/laytime";
import { toLocalInput, fromLocalInput } from "@/lib/format";
import { docSo } from "@/lib/paste";

// Điều khoản xếp dỡ của một chuyến theo hợp đồng: kiểu tính (laytime / CQD), mốc bắt đầu, thời gian được trừ, ngưỡng CQD.
// Bản này không quản lý tiền thưởng phạt (đơn giá, tỷ lệ thưởng).
export default function DieuKhoan({ v, onClose }) {
  const { quyen, run, api, toast } = useApp();
  const [f, setF] = useState({
    kieu_tp: v.kieu_tp || "laytime", cam_ket: v.cam_ket ?? "", cam_ket_ghi_chu: v.cam_ket_ghi_chu || "", moc_tinh_tp: v.moc_tinh_tp || MOC_MAC_DINH,
    tg_tinh_tp: toLocalInput(v.tg_tinh_tp), cqd_nguong_gio: v.cqd_nguong_gio ?? "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const num = (x) => (x === "" || x == null ? null : docSo(x) ?? NaN);
  const cqd = f.kieu_tp === "cqd";
  const save = async () => {
    const ck = num(f.cam_ket), ng = num(f.cqd_nguong_gio);
    if (ck != null && !(ck > 0)) return toast("Cam kết phải là số dương", "bad");
    if (ng != null && !(ng >= 0)) return toast("Ngưỡng trống máng phải là số giờ", "bad");
    if (f.moc_tinh_tp === "tay" && !f.tg_tinh_tp && !cqd) return toast("Chọn giờ bắt đầu tính nhập tay", "bad");
    const r = await run(async () => {
      await api.updateVoyage(v.id, {
        kieu_tp: f.kieu_tp, cam_ket: ck, cam_ket_ghi_chu: f.cam_ket_ghi_chu.trim() || null, moc_tinh_tp: f.moc_tinh_tp,
        tg_tinh_tp: f.moc_tinh_tp === "tay" ? fromLocalInput(f.tg_tinh_tp) : null, cqd_nguong_gio: ng,
      });
    }, "Đã lưu điều khoản xếp dỡ");
    if (r) onClose();
  };
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} title={`Điều khoản xếp dỡ · ${v.ten_tau}`} description={`${v.ma_chuyen} · theo hợp đồng của chuyến`}
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button>{quyen.nhap && <Button onClick={save}>Lưu</Button>}</>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kiểu tính laytime" className="sm:col-span-2"><NativeSelect value={f.kieu_tp} onChange={set("kieu_tp")} options={KIEU_TP} /></Field>
        {!cqd ? <>
          <Field label="CAM KẾT xếp dỡ (tấn/ngày)" hint="Laytime = KL ÷ cam kết"><Input className="num" inputMode="decimal" value={f.cam_ket} onChange={set("cam_ket")} /></Field>
          <Field label="Laytime bắt đầu tính" hint="Làm hàng sớm hơn mốc NOR + … thì tính từ lúc bắt đầu làm hàng"><NativeSelect value={f.moc_tinh_tp} onChange={set("moc_tinh_tp")} options={MOC_TP} /></Field>
          {f.moc_tinh_tp === "tay" ? <Field label="Giờ bắt đầu tính (theo phiếu tàu)"><NgayGio value={f.tg_tinh_tp} onChange={(x) => setF((o) => ({ ...o, tg_tinh_tp: x }))} /></Field> : <div />}
        </> : <>
          <Field label="Ngưỡng trống máng cho phép (giờ)" hint="Tổng giờ trống máng vượt ngưỡng thì bị phạt"><Input className="num" inputMode="decimal" value={f.cqd_nguong_gio} onChange={set("cqd_nguong_gio")} /></Field>
          <div className="text-xs text-muted-foreground sm:pt-5">Giờ trống máng = các khoảng dừng tích "Trống máng" trong tab Khoảng dừng (trong lúc làm hàng). CQD không có thưởng.</div>
        </>}
      </div>
    </Dialog>
  );
}
