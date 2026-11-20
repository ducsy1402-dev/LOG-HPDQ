import { useMemo, useState } from "react";
import { Truck } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { useThietBi } from "@/thietbi/Host";
import { so, plain } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { khoaDong, tenHuong, tenDonVi } from "@/lib/sanLuongTT";
import { PopupBenCanh } from "../kehoach/PopupBenCanh";

const r2 = (x) => Math.round((+x || 0) * 100) / 100;

// Biểu mẫu "Phân bổ vận tải" (anh Sỹ 20/11/2026): chia khối lượng kế hoạch của một loại hàng thành BĂNG TẢI và CHẠY XE; bấm Phân bổ thì ghi vào bảng Kế hoạch vận tải
// (hướng Phục vụ cảng hoặc Phục vụ sản xuất, đúng nghiệp vụ, đơn vị Hòa Phát, loại xe "Băng tải" / "Chạy xe" — sửa tiếp loại xe, Hòa Phát / Thuê ngoài ở bảng Kế hoạch vận tải) rồi chuyển sang mục đó.
//   • từ Kế hoạch nhập Cảng: nghiệp vụ mặc định Nhập tàu; từ Kế hoạch xuất Cảng: Xuất tàu (hướng Phục vụ cảng);
//   • từ Kế hoạch sản xuất: chọn một trong Trung chuyển / Thu hồi / Cấp sản xuất (hướng Phục vụ sản xuất).
// Dòng Chạy xe có hai ô tick Thuê ngoài (TN, mặc định) / Hòa Phát (HP): tick ô nào thì số Chạy xe vào đúng cột đó của Kế hoạch vận tải; ô Loại xe (tùy chọn, trống = "Chạy xe"). Băng tải luôn là Hòa Phát.
// Phân bổ lại cùng (kỳ, hướng, loại hàng, nghiệp vụ) thì THAY các dòng vận tải đang có của nhóm đó (có hỏi trước).
// Props: tong (t) khối lượng kế hoạch; hang tên hiển thị; hangVT loại hàng ghi ở Kế hoạch vận tải; nghiepVu danh sách nghiệp vụ được chọn; huongVT; kyLoai thang | quy | nam; ky khóa kỳ; onXong(huongVT).
export function FormPhanBoVT({ tong, hang, hangVT, nghiepVu: dsNv, huongVT, kyLoai, ky, sua, onXong }) {
  const { api, run, toast } = useApp();
  const [nv, setNv] = useState(dsNv[0]);
  const [bt, setBt] = useState(""), [cx, setCx] = useState("");
  const [dv, setDv] = useState("nha_thau"), [loaiXe, setLoaiXe] = useState(""); // đơn vị của dòng Chạy xe và loại xe (tùy chọn)
  const tb = useThietBi()?.D;
  const goiYXe = useMemo(() => [...new Set(["Xe ben", "Xe đầu kéo", "Xe bồn", ...(tb?.vehicles || []).map((x) => x.doi).filter((d) => d && d !== "Cẩu")])].sort((a, b) => a.localeCompare(b, "vi")), [tb]);
  const b = docSo(bt) || 0, x = docSo(cx) || 0, con = r2(tong - b - x);
  const phanBo = async () => {
    if (!(b + x > 0)) return toast("Nhập khối lượng Băng tải hoặc Chạy xe", "warn");
    let hienCo;
    try { hienCo = kyLoai === "thang" ? (await api.docSanLuongThang("van_tai", ky))?.mucTieu : await api.docMucTieuKy("van_tai", ky); } catch { hienCo = null; }
    if (hienCo == null) return toast("Chưa có bảng Kế hoạch vận tải: quản trị chạy sql/06, sql/10 và sql/25 trong Supabase", "bad");
    const cu = hienCo.filter((r) => r.huong === huongVT && plain(r.loai_hang || "") === plain(hangVT) && (r.nghiep_vu || "") === nv);
    const moi = [["Băng tải", b, "hoa_phat"], [loaiXe.trim() || "Chạy xe", x, dv]].filter(([, t]) => t > 0).map(([loai, t, donVi]) => ({ thang: ky, huong: huongVT, loai, donVi, hang: hangVT, nv, tan: r2(t), ghi_chu: null }));
    const giu = new Set(moi.map((r) => khoaDong(r.huong, r.loai, r.donVi, r.hang, r.nv)));
    const xoa = cu.filter((r) => !giu.has(khoaDong(r.huong, r.loai_xe, r.don_vi, r.loai_hang, r.nghiep_vu))).map((r) => ({ thang: ky, huong: r.huong, loai: r.loai_xe, donVi: r.don_vi, hang: r.loai_hang, nv: r.nghiep_vu || "", tan: null }));
    if (cu.length && !confirm(`Kế hoạch vận tải đã có ${cu.length} dòng ${nv} · ${hangVT} (${tenHuong("van_tai", huongVT)}). Phân bổ sẽ thay bằng ${moi.length} dòng mới (${moi.map((r) => `${r.loai} · ${tenDonVi(r.donVi)}`).join(", ")}). Tiếp tục?`)) return;
    const ok = await run(() => (kyLoai === "thang" ? api.saveMucTieuNhom("van_tai", [...xoa, ...moi]) : api.saveMucTieuKy("van_tai", [...xoa, ...moi])), `Đã phân bổ vận tải ${nv} · ${hangVT}: ${moi.map((r) => `${r.loai} (${tenDonVi(r.donVi)}) ${so(r.tan, 0)} t`).join(", ")}`);
    if (ok) onXong?.(huongVT);
  };
  return (
    <>
      <div className="grid gap-2.5 px-3 py-3">
        <div className="text-xs text-muted-foreground">{hang} · khối lượng kế hoạch <b className="text-foreground">{so(tong, 0)} t</b> · ghi vào Kế hoạch vận tải ({tenHuong("van_tai", huongVT)})</div>
        <div className="grid grid-cols-[1fr_8rem] items-center gap-2">
          <span className="text-xs font-medium">Nghiệp vụ</span>
          {dsNv.length > 1 ? <NativeSelect className="h-8" value={nv} onChange={(e) => setNv(e.target.value)} options={dsNv} aria-label="Nghiệp vụ" disabled={!sua} /> : <span className="rounded-md border bg-muted/40 px-2 py-1 text-center text-xs font-medium">{nv}</span>}
          <span className="text-xs font-medium">Băng tải (t)</span>
          <Input className="h-8 text-right tabular-nums" inputMode="decimal" value={bt} placeholder="0" disabled={!sua} onChange={(e) => setBt(e.target.value)} />
          <span className="flex items-center gap-1.5 text-xs font-medium">Chạy xe (t)
            {[["nha_thau", "TN", "Thuê ngoài"], ["hoa_phat", "HP", "Hòa Phát"]].map(([k, ten, day]) => (
              <label key={k} title={`Tick ${day}: số Chạy xe vào cột ${day} của Kế hoạch vận tải`} className={`flex cursor-pointer items-center gap-1 rounded border px-1 py-0.5 text-[0.6875rem] font-semibold ${dv === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                <input type="checkbox" className="h-3 w-3 accent-[hsl(var(--primary))]" checked={dv === k} disabled={!sua} onChange={() => setDv(k)} aria-label={day} />{ten}
              </label>))}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={!sua || !(con > 0)} onClick={() => setCx(String(r2(x + con)))} className="shrink-0 rounded px-1 text-[0.6875rem] text-primary hover:underline disabled:opacity-40" title="Điền phần còn lại vào Chạy xe">còn lại</button>
            <Input className="h-8 text-right tabular-nums" inputMode="decimal" value={cx} placeholder="0" disabled={!sua} onChange={(e) => setCx(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_8rem] items-center gap-2">
          <span className="text-xs font-medium">Loại xe <span className="font-normal text-muted-foreground">(tùy chọn)</span></span>
          <ChonGo value={loaiXe} onChange={setLoaiXe} options={goiYXe} placeholder="Chạy xe" disabled={!sua} inputClassName="h-8" />
        </div>
        <div className={`text-xs ${Math.abs(con) < 0.005 ? "text-ok" : con < 0 ? "text-bad" : "text-warn"}`}>Đã chia {so(b + x, 0)} / {so(tong, 0)} t · {Math.abs(con) < 0.005 ? "khớp khối lượng kế hoạch" : con > 0 ? `còn ${so(con, 0)} t chưa chia` : `vượt ${so(-con, 0)} t`}</div>
      </div>
      <div className="flex justify-end gap-2 border-t px-3 py-2">
        <Button size="sm" disabled={!sua || !(b + x > 0)} onClick={phanBo}><Truck />Phân bổ</Button>
      </div>
    </>
  );
}

// Hộp nhỏ nổi bên cạnh ô khối lượng của Kế hoạch nhập / xuất Cảng
export default function HopPhanBoVT({ neo, onDong, ...p }) {
  return (
    <PopupBenCanh neo={neo} onDong={onDong} tieuDe={`Phân bổ vận tải · ${p.hang}`} phu="Chia khối lượng thành Băng tải và Chạy xe, rồi chuyển sang Kế hoạch vận tải" rong={380}>
      <FormPhanBoVT {...p} onXong={(h) => { onDong(); p.onXong?.(h); }} />
    </PopupBenCanh>
  );
}
