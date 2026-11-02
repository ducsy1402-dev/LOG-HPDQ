import { Plus, Trash2, X } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Checkbox } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { so } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { DON_VI, tenGanCau, dsGanCau } from "@/lib/thietBi";
import { VIEC_KHAC } from "@/lib/phuongAn";
import { useKho } from "@/pages/kho/useKho";
import { khuNhan } from "@/lib/kho";

// Các khối nhập Bãi, Xe vận chuyển, Be hầm / hót vét, Cẩu tàu: dùng chung cho phiếu chuyến (tab Bãi & Thiết bị) và hộp Lập phương án,
// để hai nơi cùng một giao diện. Dữ liệu dạng của phương án:
//   điểm { bai, khu, khoi_luong, tb: [{ loai, so, don_vi }] }, xe { loai, tai_trong, chuyen_ca, so_xe, don_vi }, tb khác { viec, loai, so, don_vi }.
// Phiếu chuyến tự đổi qua lại với dạng lưu của chuyến (bai_kl, xe_van_chuyen, hot_vet, vun_hang).
// Datalist "ds-doi-xe" (gợi ý loại xe / thiết bị) do nơi dùng khai báo.

export const nhan = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
export const the = (on) => cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm", on && "border-primary bg-primary/10");
export const tbMoi = () => ({ loai: "", so: "", don_vi: "hoa_phat" });
export const so0 = (x) => (x === "" || x == null ? null : docSo(x));
export const sachTB = (ds) => (ds || []).filter((t) => String(t.loai || "").trim()).map((t) => ({ loai: String(t.loai).trim(), so: so0(t.so), don_vi: t.don_vi || "hoa_phat" }));
export const tongDV = (ds, donVi) => (ds || []).filter((t) => (t.don_vi || "hoa_phat") === donVi).reduce((s, t) => s + (+t.so || 0), 0);

const KHU_SEP = " › ";
const chonCua = (b) => b._chon ?? (b.khu ? `${b.bai}${KHU_SEP}${b.khu}` : b.bai || "");
const tachChon = (s) => { const t = String(s || "").trim(), i = t.indexOf(KHU_SEP.trim()); return i < 0 ? { bai: t, khu: null } : { bai: t.slice(0, i).trim(), khu: t.slice(i + 1).trim() || null }; };

// Một thiết bị: loại · số · đơn vị (gọn trên một dòng)
export function ThietBi({ t, onChange, onXoa, disabled }) {
  return (
    <div className="flex items-center gap-1 rounded-md border bg-muted/30 py-0.5 pl-1 pr-0.5">
      <Input list="ds-doi-xe" className="h-7 w-28 px-2 text-xs" value={t.loai || ""} disabled={disabled} onChange={(e) => onChange({ ...t, loai: e.target.value })} placeholder="Thiết bị" aria-label="Loại thiết bị" />
      <Input className="num h-7 w-11 px-1.5 text-xs" inputMode="numeric" value={t.so ?? ""} disabled={disabled} onChange={(e) => onChange({ ...t, so: e.target.value })} placeholder="SL" aria-label="Số lượng" title="Số lượng mỗi ca" />
      <NativeSelect className="h-7 w-[92px] px-1.5 text-xs" value={t.don_vi || "hoa_phat"} disabled={disabled} onChange={(e) => onChange({ ...t, don_vi: e.target.value })} options={DON_VI} aria-label="Đơn vị" />
      {!disabled && <button type="button" className="rounded p-0.5 text-muted-foreground hover:text-bad" onClick={onXoa} aria-label="Bỏ thiết bị"><X className="h-3.5 w-3.5" /></button>}
    </div>
  );
}

// Cẩu tàu: ô tick + số cẩu + năng suất mỗi cẩu (t/h, nhập tay). value = null (không dùng) hoặc { so, nang_suat }
export function CauTauO({ value, onChange, disabled, ghiChu }) {
  const on = !!value;
  return (
    <>
      <label className={the(on)} title="Cẩu của chính con tàu">
        <Checkbox disabled={disabled} checked={on} onChange={(e) => onChange(e.target.checked ? { so: "", nang_suat: "" } : null)} />Cẩu tàu
      </label>
      {on && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Input className="num h-8 w-14" inputMode="numeric" value={value.so ?? ""} disabled={disabled} onChange={(e) => onChange({ ...value, so: e.target.value })} placeholder="Số" aria-label="Số cẩu tàu" />cẩu ×
          <Input className="num h-8 w-20" inputMode="decimal" value={value.nang_suat ?? ""} disabled={disabled} onChange={(e) => onChange({ ...value, nang_suat: e.target.value })} placeholder="t/h" aria-label="Năng suất mỗi cẩu tàu (tấn/giờ)" title="Năng suất mỗi cẩu tàu (tấn/giờ), nhập tay" />t/h mỗi cẩu
          {ghiChu}
        </div>)}
    </>
  );
}

// Thiết bị gắn của cẩu cảng (mâm từ, nhóp, ngáng, móc C, gầu ngoạm…): chọn nhiều. options: tên trong Danh mục › Thiết bị gắn (Dùng cho = Cẩu cảng)
export function CauGanO({ value, onChange, options, disabled }) {
  const chon = dsGanCau(value), ds = [...new Set([...options.map(tenGanCau), ...chon])];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Thiết bị gắn cẩu:</span>
      {ds.map((t) => (
        <label key={t} className={the(chon.includes(t))}>
          <Checkbox disabled={disabled} checked={chon.includes(t)} onChange={(e) => onChange(e.target.checked ? [...chon, t] : chon.filter((x) => x !== t))} />{t}
        </label>))}
      {!ds.length && <span className="text-sm text-muted-foreground">Chưa khai báo (Danh mục › Thiết bị gắn, Dùng cho = Cẩu cảng).</span>}
    </div>
  );
}

// Bãi nhận hàng (tàu nhập) / bãi lấy hàng (tàu xuất): mỗi điểm một bãi nhỏ, khối lượng và thiết bị hạ / vun hàng (lên hàng) tại điểm
export function KhoiDiem({ v, diem, onChange, disabled }) {
  const { D } = useApp();
  const kho = useKho();
  const xuat = v.huong === "xuat";
  const hangTau = [...new Set([...(v.hang_ds || []).map((h) => h.ten_hang), ...String(v.ten_hang || "").split(";")].map((h) => String(h || "").trim()).filter(Boolean))];
  // Bãi nhỏ trong kho; hàng của tàu nào bãi nhỏ nhận được thì xếp trước. Chưa chạy SQL 15: chỉ có tên bãi.
  const khuDs = kho ? kho.dong.filter((d) => !d.saiBai).map((d) => {
    const nhanHang = hangTau.filter((h) => khuNhan(kho, d.ten_bai, h)?.key === d.key);
    const trong = d.sucChua > 0 ? Math.max(0, d.sucChua - d.ton) : null;
    return { d, nhan: nhanHang, value: `${d.ten_bai}${KHU_SEP}${d.ten}`, phu: [nhanHang.length ? `✓ nhận ${nhanHang.join(", ")}` : "", `tồn ${so(d.ton)} t`, trong != null ? `trống ${so(trong)} t` : ""].filter(Boolean).join(" · ") };
  }).sort((a, b) => (b.nhan.length > 0) - (a.nhan.length > 0)) : [];
  const khuMap = new Map(khuDs.map((k) => [k.value, k]));
  const optBai = kho ? khuDs.map((k) => [k.value, k.value, k.phu]) : [...new Set(D.khoBai.map((k) => k.ten_bai))];
  const set = (i, d) => onChange(diem.map((x, j) => (j === i ? d : x)));
  const tong = diem.reduce((s, d) => s + (so0(d.khoi_luong) || 0), 0);
  return (
    <div>
      <div className={cn(nhan, "mb-1.5 flex flex-wrap items-baseline gap-x-2")}>
        {xuat ? "Bãi lấy hàng · điểm lên hàng, thiết bị lên hàng" : "Bãi nhận hàng · điểm hạ hàng, thiết bị hạ hàng / vun đống"}
        {tong > 0 && <span className={cn("normal-case tracking-normal", +v.khoi_luong > 0 && Math.abs(tong - +v.khoi_luong) > 1 ? "text-warn" : "text-muted-foreground")}>Tổng {so(tong)}{+v.khoi_luong > 0 ? ` / ${so(v.khoi_luong)} t của tàu${Math.abs(tong - +v.khoi_luong) > 1 && diem.length > 1 ? " (chưa khớp)" : ""}` : " t"}</span>}
      </div>
      <div className="grid divide-y rounded-md border">
        {diem.map((d, i) => {
          const k = khuMap.get(chonCua(d).trim());
          return (
            <div key={i} className="grid gap-0.5 px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <ChonGo className="min-w-[220px] flex-1 sm:max-w-xs" inputClassName="h-8" value={chonCua(d)} disabled={disabled} onChange={(x) => set(i, { ...d, ...tachChon(x), _chon: x })} options={optBai} placeholder={xuat ? "Bãi lấy hàng (bãi lớn › bãi nhỏ)" : "Bãi nhận (bãi lớn › bãi nhỏ)"} />
                <Input className="num h-8 w-[88px]" inputMode="decimal" value={d.khoi_luong ?? ""} disabled={disabled} onChange={(e) => set(i, { ...d, khoi_luong: e.target.value })} placeholder={diem.length === 1 ? "Cả tàu" : "KL (t)"} aria-label="Khối lượng (tấn)" title="Khối lượng qua điểm này (tấn)" />
                {(d.tb || []).map((t, j) => <ThietBi key={j} t={t} disabled={disabled} onChange={(n) => set(i, { ...d, tb: d.tb.map((x, q) => (q === j ? n : x)) })} onXoa={() => set(i, { ...d, tb: d.tb.filter((_, q) => q !== j) })} />)}
                {!disabled && <Button size="xs" variant="ghost" className="px-1.5" onClick={() => set(i, { ...d, tb: [...(d.tb || []), tbMoi()] })} title="Thêm thiết bị tại điểm này" aria-label="Thêm thiết bị tại điểm"><Plus />{d.tb?.length ? "" : "Thiết bị"}</Button>}
                {!disabled && diem.length > 1 && <Button size="xs" variant="ghost" className="ml-auto text-bad" onClick={() => onChange(diem.filter((_, j) => j !== i))} aria-label="Bỏ điểm"><Trash2 /></Button>}
              </div>
              {k && <div className="pl-1 text-xs text-muted-foreground">Tồn <b className="text-foreground">{so(k.d.ton)} t</b>{k.d.sucChua > 0 ? ` / sức chứa ${so(k.d.sucChua)} t · trống ${so(Math.max(0, k.d.sucChua - k.d.ton))} t` : ""}{k.d.chua?.length ? ` · đang chứa ${k.d.chua.map((c) => c.hang).join(", ")}` : ""}{!xuat && hangTau.length && !k.nhan.length ? <span className="text-warn"> · bãi nhỏ này không nhận {hangTau.join(", ")}</span> : ""}</div>}
            </div>);
        })}
      </div>
      {!disabled && <Button size="xs" variant="outline" className="mt-1.5" onClick={() => onChange([...diem, { bai: "", khu: null, khoi_luong: "", tb: [] }])}><Plus />Thêm điểm {xuat ? "lên hàng" : "hạ hàng"}</Button>}
    </div>
  );
}

// Xe vận chuyển mỗi ca: loại xe, tải trọng, số chuyến một ca, số xe, đơn vị. goiY(x) (nếu có) trả số xe gợi ý của dòng
// tuDien: sửa tải trọng / số chuyến thì số xe tự điền theo gợi ý (nếu số xe chưa được nhập tay)
export function KhoiXe({ xe, onChange, goiY, tieuDe, disabled, tuDien }) {
  const set = (i, k, val) => onChange(xe.map((x, j) => {
    if (j !== i) return x;
    const n = { ...x, [k]: val };
    if (tuDien && goiY && (k === "tai_trong" || k === "chuyen_ca")) {
      const cu = goiY(x), moi = goiY(n);
      if (moi != null && (x.so_xe === "" || x.so_xe == null || +x.so_xe === cu)) n.so_xe = String(moi);
    }
    return n;
  }));
  const hp = tongDV(xe.map((x) => ({ ...x, so: x.so_xe })), "hoa_phat"), nt = tongDV(xe.map((x) => ({ ...x, so: x.so_xe })), "nha_thau");
  return (
    <div>
      <div className={cn(nhan, "mb-1.5 flex flex-wrap items-baseline gap-x-2")}>Xe vận chuyển mỗi ca
        {(hp > 0 || nt > 0) && <span className="normal-case tracking-normal text-muted-foreground">Hòa Phát {hp} · Nhà thầu {nt} xe/ca</span>}
        {tieuDe && <span className="normal-case tracking-normal text-muted-foreground">{tieuDe}</span>}
      </div>
      <div className="grid gap-1.5">
        {xe.map((x, i) => {
          const gy = goiY?.(x);
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input list="ds-doi-xe" className="h-8 w-40" value={x.loai || ""} disabled={disabled} onChange={(e) => set(i, "loai", e.target.value)} placeholder="Loại xe" aria-label="Loại xe" />
              <Input className="num h-8 w-20" inputMode="decimal" value={x.tai_trong ?? ""} disabled={disabled} onChange={(e) => set(i, "tai_trong", e.target.value)} placeholder="t/xe" aria-label="Tải trọng một xe (tấn)" title="Tải trọng một xe (tấn)" />
              <Input className="num h-8 w-20" inputMode="decimal" value={x.chuyen_ca ?? ""} disabled={disabled} onChange={(e) => set(i, "chuyen_ca", e.target.value)} placeholder="chuyến/ca" aria-label="Số chuyến một xe mỗi ca" title="Số chuyến một xe chạy được trong ca (theo cự ly bến – bãi)" />
              {goiY && <span className="text-xs text-muted-foreground">gợi ý {gy ?? "—"} xe</span>}
              <Input className="num h-8 w-20" inputMode="numeric" value={x.so_xe ?? ""} disabled={disabled} onChange={(e) => set(i, "so_xe", e.target.value)} placeholder={gy != null ? String(gy) : "số xe"} aria-label="Số xe mỗi ca" title={goiY ? "Số xe mỗi ca (để trống = theo gợi ý)" : "Số xe mỗi ca"} />
              <span className="text-xs text-muted-foreground">xe/ca</span>
              <NativeSelect className="h-8 w-32" value={x.don_vi || "hoa_phat"} disabled={disabled} onChange={(e) => set(i, "don_vi", e.target.value)} options={DON_VI} aria-label="Đơn vị" />
              {!disabled && <Button size="xs" variant="ghost" className="text-bad" onClick={() => onChange(xe.filter((_, j) => j !== i))} aria-label="Bỏ dòng"><Trash2 /></Button>}
            </div>);
        })}
        {!xe.length && <div className="text-sm text-muted-foreground">Chưa có.</div>}
        {!disabled && <div><Button size="xs" variant="outline" onClick={() => onChange([...xe, { loai: "Xe ben", tai_trong: "", chuyen_ca: "", so_xe: "", don_vi: "hoa_phat" }])}><Plus />Thêm loại xe</Button></div>}
      </div>
    </div>
  );
}

// Thiết bị be hầm / hót vét và hỗ trợ chung: mỗi thiết bị một dòng, chọn công việc
export function KhoiTbKhac({ ds, onChange, disabled }) {
  const set = (i, t) => onChange(ds.map((x, j) => (j === i ? t : x)));
  const hp = tongDV(ds, "hoa_phat"), nt = tongDV(ds, "nha_thau");
  return (
    <div>
      <div className={cn(nhan, "mb-1.5 flex flex-wrap items-baseline gap-x-2")}>Thiết bị be hầm / hót vét · hỗ trợ chung
        {(hp > 0 || nt > 0) && <span className="normal-case tracking-normal text-muted-foreground">Hòa Phát {hp} · Nhà thầu {nt} chiếc</span>}
      </div>
      <div className="grid justify-items-start gap-1.5">
        {ds.map((t, i) => (
          <div key={i} className="flex items-center gap-1">
            <NativeSelect className="h-7 w-[130px] px-1.5 text-xs" value={t.viec} disabled={disabled} onChange={(e) => set(i, { ...t, viec: e.target.value })} options={VIEC_KHAC} aria-label="Công việc" />
            <ThietBi t={t} disabled={disabled} onChange={(n) => set(i, n)} onXoa={() => onChange(ds.filter((_, j) => j !== i))} />
          </div>))}
        {!ds.length && <div className="text-sm text-muted-foreground">Chưa có.</div>}
        {!disabled && <Button size="xs" variant="outline" onClick={() => onChange([...ds, { viec: ds.at(-1)?.viec || "be_ham", ...tbMoi() }])}><Plus />Thêm thiết bị</Button>}
      </div>
    </div>
  );
}
