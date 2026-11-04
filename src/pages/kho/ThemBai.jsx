import { useState } from "react";
import { Save, AlertTriangle } from "lucide-react";
import { useApp } from "@/store";
import { useThietBi } from "@/thietbi/Host";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Field } from "@/components/ui/input";
import { so } from "@/lib/format";
import { docSo } from "@/lib/paste";
import DM_BANG from "@/data/dmBang.json";

// Thêm bãi trực tiếp từ Sơ đồ bãi: bãi nhỏ (gian / lô) vào một bãi lớn, hoặc bãi lớn mới (khai báo kho / bãi + gian / lô đầu tiên).
// Bãi nhỏ ghi vào bảng kho_bai (Danh mục › Kho bãi), bãi lớn khai báo ở danh_muc_bang "bai_lon" (Danh mục › Khai báo kho / bãi).
const so0 = (x) => (x === "" || x == null ? null : docSo(x));

function CanhBaoDienTich({ tong, daPB, them }) {
  if (!(tong > 0) || !(them > 0) || daPB + them <= tong + 0.5) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-bad/40 bg-bad/5 p-2 text-sm text-bad">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Diện tích phân bổ vượt diện tích bãi lớn: đã phân bổ {so(daPB)} + {so(them)} = <b>{so(daPB + them)} m²</b>, lớn hơn tổng {so(tong)} m² (vượt {so(daPB + them - tong)} m²). Vẫn lưu được; nên sửa lại diện tích.</span>
    </div>);
}

function TruongBaiNho({ f, set, tp, khoMoi, hangGoiY }) {
  return (
    <>
      <Field label="Gian / lô (bãi nhỏ) *"><Input value={f.ten_khu} onChange={set("ten_khu")} placeholder="VD Gian A, Đá vôi <20mm" autoFocus /></Field>
      <Field label="Diện tích phân bổ (m²)"><Input className="num" inputMode="decimal" value={f.dien_tich} onChange={set("dien_tich")} /></Field>
      <Field label="Hàng đang chứa"><Input list="dl-them-hang" value={f.hang} onChange={set("hang")} placeholder="Tên hàng trong danh mục hàng hóa" />
        <datalist id="dl-them-hang">{hangGoiY.map((x) => <option key={x} value={x} />)}</datalist></Field>
      {tp ? (khoMoi && <Field label="Số lớp xếp khả dụng"><Input className="num" inputMode="decimal" value={f.cao} onChange={set("cao")} /></Field>)
        : <Field label="Chiều cao đống (m)"><Input className="num" inputMode="decimal" value={f.cao} onChange={set("cao")} /></Field>}
      <Field label="Sức chứa khả dụng (t)" hint="Trống = tính theo diện tích × chiều cao × tỷ khối"><Input className="num" inputMode="decimal" value={f.suc} onChange={set("suc")} /></Field>
      <Field label="Thiết bị tại kho / bãi"><Input value={f.thiet_bi} onChange={set("thiet_bi")} /></Field>
    </>);
}
const hangTu = (f, tp, khoMoi, loai, tenBai) => ({
  ten_bai: tenBai, ten_khu: f.ten_khu.trim() || null, dien_tich: so0(f.dien_tich), hang: f.hang.trim() || null, suc_chua_tay: so0(f.suc), thiet_bi: f.thiet_bi.trim() || null, loai_kho: loai,
  ...(tp ? (khoMoi ? { so_lop: so0(f.cao) } : {}) : { chieu_cao: so0(f.cao) }),
});

// Thêm bãi nhỏ vào bãi lớn baiLon (tong = diện tích bãi lớn khai báo, daPB = đã phân bổ)
export function ThemBaiNho({ baiLon, loai, tp, khoMoi, tong, daPB, onClose }) {
  const { D, api, run, toast } = useApp();
  const hangGoiY = (useThietBi()?.D?.hanghoa || []).map((h) => h.loai_hang);
  const [f, setF] = useState({ ten_khu: "", dien_tich: "", hang: "", cao: "", suc: "", thiet_bi: "" });
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }));
  const them = so0(f.dien_tich) || 0;
  const luu = async () => {
    if (!f.ten_khu.trim()) return toast("Chưa nhập tên gian / lô", "bad");
    if (D.khoBai.some((r) => r.ten_bai === baiLon && String(r.ten_khu || "").trim().toLowerCase() === f.ten_khu.trim().toLowerCase())) return toast(`"${f.ten_khu}" đã có trong ${baiLon}`, "bad");
    if (await run(() => api.upsertRows("kho_bai", [hangTu(f, tp, khoMoi, loai, baiLon)], "id"), `Đã thêm ${f.ten_khu.trim()} vào ${baiLon}`)) onClose();
  };
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-xl" title={`Thêm bãi nhỏ vào ${baiLon}`}
      description={tong > 0 ? `Diện tích ${baiLon}: ${so(tong)} m² · đã phân bổ ${so(daPB)} m² · còn ${so(Math.max(0, tong - daPB))} m²` : `Chưa khai báo diện tích ${baiLon}: đã phân bổ ${so(daPB)} m² (khai báo ở Danh mục › Kho bãi › Khai báo kho / bãi)`}
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button onClick={luu}><Save />Lưu</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2"><TruongBaiNho f={f} set={set} tp={tp} khoMoi={khoMoi} hangGoiY={hangGoiY} /></div>
      <div className="mt-3"><CanhBaoDienTich tong={tong} daPB={daPB} them={them} /></div>
    </Dialog>
  );
}

// Thêm bãi lớn (kho / bãi mới): khai báo + gian / lô đầu tiên (để bãi hiện trên sơ đồ). khu: khu vực mặc định (đang lọc / nhánh bấm +)
export function ThemBaiLon({ loai, tp, khoMoi, khu, dsKhu, onClose }) {
  const { D, api, run, toast } = useApp();
  const hangGoiY = (useThietBi()?.D?.hanghoa || []).map((h) => h.loai_hang);
  const cot = DM_BANG.bai_lon.cot; // [ten, dien tích, phạm vi / khu vực, loại]
  const [g, setG] = useState({ ten: "", dt: "", khu: khu || "", kieu: "Cố định" });
  const [f, setF] = useState({ ten_khu: "", dien_tich: "", hang: "", cao: "", suc: "", thiet_bi: "" });
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }));
  const tong = so0(g.dt) || 0, them = so0(f.dien_tich) || 0;
  const luu = async () => {
    const ten = g.ten.trim();
    if (!ten) return toast("Chưa nhập tên kho / bãi", "bad");
    if (!f.ten_khu.trim()) return toast("Nhập gian / lô đầu tiên để bãi hiện trên sơ đồ", "bad");
    if (!D.coSql08) return toast("Cần chạy SQL 08 trong Supabase trước khi khai báo bãi lớn", "bad");
    if (D.khoBai.some((r) => String(r.ten_bai).trim().toLowerCase() === ten.toLowerCase())) return toast(`Kho / bãi "${ten}" đã có`, "bad");
    const dong = { [cot[0][0]]: ten, [cot[1][0]]: so0(g.dt), [cot[2][0]]: g.khu.trim() || null, [cot[3][0]]: g.kieu };
    if (await run(async () => { await api.saveDmBang("bai_lon", [dong]); await api.upsertRows("kho_bai", [hangTu(f, tp, khoMoi, loai, ten)], "id"); }, `Đã thêm ${ten}`)) onClose();
  };
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-2xl" title="Thêm bãi lớn (kho / bãi mới)"
      description="Khai báo kho / bãi lớn và gian / lô đầu tiên của nó. Sau đó thêm các gian / lô khác bằng dấu + dưới bãi."
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button onClick={luu}><Save />Lưu</Button></>}>
      <div className="grid gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kho / bãi lớn</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên kho / bãi *"><Input value={g.ten} onChange={(e) => setG({ ...g, ten: e.target.value })} placeholder="VD Bãi F CTH" autoFocus /></Field>
          <Field label="Diện tích (m²)"><Input className="num" inputMode="decimal" value={g.dt} onChange={(e) => setG({ ...g, dt: e.target.value })} /></Field>
          <Field label="Phạm vi / khu vực"><Input list="dl-them-khu" value={g.khu} onChange={(e) => setG({ ...g, khu: e.target.value })} placeholder="Chọn hoặc gõ khu vực mới" />
            <datalist id="dl-them-khu">{dsKhu.map((x) => <option key={x} value={x} />)}</datalist></Field>
          <Field label="Loại kho / bãi"><NativeSelect value={g.kieu} onChange={(e) => setG({ ...g, kieu: e.target.value })} options={["Cố định", "Tự do"]} /></Field>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gian / lô đầu tiên</div>
        <div className="grid gap-3 sm:grid-cols-2"><TruongBaiNho f={f} set={set} tp={tp} khoMoi={khoMoi} hangGoiY={hangGoiY} /></div>
        <CanhBaoDienTich tong={tong} daPB={0} them={them} />
      </div>
    </Dialog>
  );
}
