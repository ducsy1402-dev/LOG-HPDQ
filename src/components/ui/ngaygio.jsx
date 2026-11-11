import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNoi } from "@/components/ui/noi";
import { docNgayGio } from "@/lib/paste";
import { cn } from "@/lib/utils";

const p2 = (n) => String(n).padStart(2, "0");
const chuoi = (d, chiNgay) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}${chiNgay ? "" : `T${p2(d.getHours())}:${p2(d.getMinutes())}`}`;
const hienThi = (v, chiNgay) => (!v ? "" : `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}${chiNgay ? "" : ` ${v.slice(11, 16)}`}`);
const GIO = Array.from({ length: 24 }, (_, i) => p2(i)), PHUT = Array.from({ length: 60 }, (_, i) => p2(i));
const CAO_O = 32; // chiều cao một dòng giờ / phút
const THU = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const batPhut = (d) => { const x = new Date(d); x.setSeconds(0, 0); return x; };

// Đọc chữ gõ: "24/10/2026 14:30", "24/10 14h", "24/10" (giữ giờ đang có), "14:30" (giữ ngày đang có). Không đọc được -> null
export function docO(text, cu, chiNgay) {
  const t = String(text ?? "").trim();
  if (!t) return "";
  const g = /^(\d{1,2})\s*[:hH]\s*(\d{2})?$/.exec(t);
  if (g) {
    if (chiNgay) return null;
    const h = +g[1], m = +(g[2] || 0);
    if (h > 23 || m > 59) return null;
    return `${cu ? cu.slice(0, 10) : chuoi(new Date(), true)}T${p2(h)}:${p2(m)}`;
  }
  const iso = docNgayGio(t);
  if (!iso) return null;
  const d = new Date(iso);
  if (!chiNgay && cu && cu.length > 10 && !/\d\s*[:hH]/.test(t)) { const [h, m] = cu.slice(11, 16).split(":"); d.setHours(+h, +m, 0, 0); }
  return chuoi(d, chiNgay);
}

// Ô ngày / ngày giờ: gõ trực tiếp (dd/mm/yyyy hh:mm, 24/10 14h…) hoặc bấm để chọn trên lịch.
// Bảng lịch: hai ô ngày / giờ ở đầu, lịch tháng (« năm trước, ‹ tháng trước), cột giờ và cột phút (từng phút), nút Bây giờ / Xác nhận / Hủy.
// Giá trị "YYYY-MM-DDTHH:mm" (giờ máy, như <input type="datetime-local">) hoặc "YYYY-MM-DD" khi chiNgay. Rỗng = "".
// inputClassName: dùng ô <input> thường với lớp này (phần Thiết bị cơ giới dùng "inp").
export function NgayGio({ value, onChange, chiNgay = false, min, max, disabled, placeholder, className, inputClassName, style: kieu, ...p }) {
  const v0 = value ? String(value).slice(0, chiNgay ? 10 : 16) : "";
  const [mo, setMo] = useState(false);
  const [text, setText] = useState(null); // chữ đang gõ ở ô chính
  const [nhap, setNhap] = useState(null); // giá trị đang chọn trong bảng, chưa xác nhận
  const [tNgay, setTNgay] = useState(null), [tGio, setTGio] = useState(null); // chữ đang gõ ở hai ô trong bảng
  const [thang, setThang] = useState([2000, 0]);
  const ref = useRef();
  const trongKhoang = (v) => !v || ((!min || v.slice(0, 10) >= min) && (!max || v.slice(0, 10) <= max));
  const ghi = (v) => { if (v !== v0 && trongKhoang(v) && !(p.required && !v)) onChange(v); };
  const dong = () => { if (nhap != null) ghi(nhap); setNhap(null); setTNgay(null); setTGio(null); setMo(false); };
  const huy = () => { setNhap(null); setTNgay(null); setTGio(null); setMo(false); };
  const { popRef, style } = useNoi(mo, ref, { cao: 420, onNgoai: dong });
  const cur = nhap ?? v0;
  const moBang = () => {
    if (disabled || mo) return;
    const d = cur ? new Date(cur.length > 10 ? cur : `${cur}T00:00`) : new Date();
    setThang([d.getFullYear(), d.getMonth()]);
    setMo(true);
  };
  const xongGo = () => { if (text == null) return; const v = docO(text, v0, chiNgay); setText(null); if (v != null) ghi(v); };
  const docDuoc = text == null || docO(text, v0, chiNgay) != null;
  const homNay = chuoi(new Date(), true), ngayChon = cur.slice(0, 10), gioChon = cur.length > 10 ? cur.slice(11, 13) : "", phutChon = cur.length > 10 ? cur.slice(14, 16) : "";
  useEffect(() => { // cuộn cột giờ, cột phút tới giá trị đang chọn (đặt giữa cột)
    if (!mo || chiNgay) return;
    for (const [ma, v] of [["gio", gioChon], ["phut", phutChon]]) {
      const c = popRef.current?.querySelector(`[data-cot="${ma}"]`);
      if (c) c.scrollTop = (v === "" ? (ma === "gio" ? 8 : 0) : +v) * CAO_O;
    }
  }, [mo, chiNgay, gioChon, phutChon]); // eslint-disable-line react-hooks/exhaustive-deps

  const [y, m] = thang;
  const dau = new Date(y, m, 1), lech = (dau.getDay() + 6) % 7;
  const o = Array.from({ length: 42 }, (_, i) => new Date(y, m, 1 - lech + i));
  // Đặt ngày / giờ / phút cho giá trị đang chọn (chưa có thì lấy hôm nay, 08:00)
  const dat = (ngay, gio, phut) => setNhap(`${ngay ?? (ngayChon || homNay)}T${gio ?? (gioChon || "08")}:${phut ?? (phutChon || "00")}`);
  const chonNgay = (d) => {
    const n = chuoi(d, true);
    if (!trongKhoang(n)) return;
    if (chiNgay) { ghi(n); setMo(false); return; }
    dat(n);
    if (d.getMonth() !== m) setThang([d.getFullYear(), d.getMonth()]);
  };
  const xacNhan = () => { if (nhap != null) ghi(nhap); setNhap(null); setTNgay(null); setTGio(null); setMo(false); };
  const bayGio = () => { ghi(chuoi(chiNgay ? new Date() : batPhut(Date.now()), chiNgay)); setNhap(null); setMo(false); };
  const xoa = () => { ghi(""); setNhap(null); setMo(false); };
  const doiThang = (k) => setThang(([yy, mm]) => { const d = new Date(yy, mm + k, 1); return [d.getFullYear(), d.getMonth()]; });
  const xongNgay = () => {
    if (tNgay == null) return;
    const v = docO(tNgay, ngayChon, true); setTNgay(null);
    if (v) { dat(v); const d = new Date(`${v}T00:00`); setThang([d.getFullYear(), d.getMonth()]); }
  };
  const xongGio = () => {
    if (tGio == null) return;
    const g = /^(\d{1,2})\s*[:hH]?\s*(\d{2})?$/.exec(tGio.trim()); setTGio(null);
    if (g && +g[1] <= 23 && +(g[2] || 0) <= 59) dat(null, p2(+g[1]), p2(+(g[2] || 0)));
  };

  const oNhap = {
    ...p, autoComplete: "off", disabled, placeholder: placeholder ?? (chiNgay ? "dd/mm/yyyy" : "dd/mm/yyyy hh:mm"),
    value: text ?? hienThi(cur, chiNgay),
    onChange: (e) => setText(e.target.value),
    onFocus: moBang, onClick: moBang,
    onBlur: xongGo,
    onKeyDown: (e) => {
      if (e.key === "Enter") { e.preventDefault(); xongGo(); setNhap(null); setMo(false); }
      else if (e.key === "Escape" && mo) { e.stopPropagation(); setText(null); huy(); }
      else if (e.key === "Tab") dong();
    },
    title: docDuoc ? undefined : "Không đọc được ngày giờ: gõ dạng 24/10/2026 14:30",
  };
  const oPhu = "h-8 rounded-full border bg-background px-3 text-center text-[0.8125rem] tabular-nums outline-none focus:border-primary";
  const phimPhu = (xong) => (e) => { if (e.key === "Enter") { e.preventDefault(); xong(); } else if (e.key === "Escape") { e.stopPropagation(); huy(); } };
  const nutThang = "rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground";
  return (
    <div ref={ref} className={cn("khong-ttb relative", className)} style={kieu}>
      {inputClassName != null
        ? <input {...oNhap} className={cn(inputClassName, !docDuoc && "ring-1 ring-bad")} style={{ paddingRight: 28, width: "100%" }} />
        : <Input {...oNhap} className={cn("pr-8 tabular-nums", !docDuoc && "ring-1 ring-bad")} />}
      <button type="button" tabIndex={-1} aria-label="Mở lịch" disabled={disabled} onMouseDown={(e) => e.preventDefault()}
        onClick={() => (mo ? dong() : moBang())}
        className="absolute bottom-0 right-0 top-0 flex w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"><CalendarDays className="h-4 w-4" /></button>
      {mo && (
        <div ref={popRef} style={style} onMouseDown={(e) => { if (!(e.target instanceof HTMLInputElement)) e.preventDefault(); }}
          className="z-[60] rounded-lg border bg-popover text-sm text-popover-foreground shadow-xl">
          {/* Hai ô ngày / giờ đang chọn */}
          <div className="flex gap-2 p-3 pb-1">
            <input className={cn(oPhu, "w-[268px]")} inputMode="numeric" placeholder="dd/mm/yyyy" aria-label="Ngày" value={tNgay ?? hienThi(ngayChon, true)}
              onChange={(e) => setTNgay(e.target.value)} onBlur={xongNgay} onKeyDown={phimPhu(xongNgay)} />
            {!chiNgay && <input className={cn(oPhu, "w-[116px]")} inputMode="numeric" placeholder="hh:mm" aria-label="Giờ" value={tGio ?? (gioChon ? `${gioChon}:${phutChon}` : "")}
              onChange={(e) => setTGio(e.target.value)} onBlur={xongGio} onKeyDown={phimPhu(xongGio)} />}
          </div>
          <div className="flex">
            <div className="w-[292px] px-3 pb-2">
              <div className="flex items-center justify-between py-1">
                <div className="flex">
                  <button type="button" className={nutThang} onClick={() => doiThang(-12)} aria-label="Năm trước"><ChevronsLeft className="h-4 w-4" /></button>
                  <button type="button" className={nutThang} onClick={() => doiThang(-1)} aria-label="Tháng trước"><ChevronLeft className="h-4 w-4" /></button>
                </div>
                <b className="text-[0.9375rem] tracking-wide text-primary">Tháng {m + 1} · {y}</b>
                <div className="flex">
                  <button type="button" className={nutThang} onClick={() => doiThang(1)} aria-label="Tháng sau"><ChevronRight className="h-4 w-4" /></button>
                  <button type="button" className={nutThang} onClick={() => doiThang(12)} aria-label="Năm sau"><ChevronsRight className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 pb-1 pt-1 text-center text-[0.75rem] font-semibold text-primary/80">{THU.map((t) => <div key={t}>{t}</div>)}</div>
              <div className="grid grid-cols-7 gap-1 text-center text-[0.8125rem]">
                {o.map((d) => {
                  const n = chuoi(d, true), ngoai = d.getMonth() !== m, khoa = !trongKhoang(n), chon = n === ngayChon;
                  return (
                    <button key={n} type="button" disabled={khoa} onClick={() => chonNgay(d)}
                      className={cn("flex h-9 items-center justify-center rounded-md bg-muted/50 tabular-nums text-foreground/80 transition-colors hover:bg-accent disabled:opacity-30",
                        ngoai && "text-muted-foreground/60", n === homNay && !chon && "ring-1 ring-primary/60",
                        chon && "rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary")}>{d.getDate()}</button>);
                })}
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <button type="button" className="rounded px-2 py-1 text-[0.8125rem] font-medium text-primary hover:bg-accent" onClick={bayGio}>{chiNgay ? "Hôm nay" : "Bây giờ"}</button>
                <div className="flex items-center gap-1">
                  {!p.required && <button type="button" className="rounded px-2 py-1 text-[0.8125rem] text-muted-foreground hover:bg-accent" onClick={xoa}>Xóa</button>}
                  {!chiNgay && (
                    <button type="button" disabled={nhap == null} onClick={xacNhan}
                      className="h-8 rounded-full border border-primary/50 px-4 text-[0.8125rem] font-semibold text-primary hover:bg-primary/10 disabled:border-border disabled:text-muted-foreground disabled:opacity-60 disabled:hover:bg-transparent">Xác nhận</button>)}
                </div>
              </div>
            </div>
            {/* Cột giờ, cột phút */}
            {!chiNgay && (
              <div className="flex w-[148px] flex-col border-l">
                <div className="flex flex-1">
                  {[["gio", GIO, gioChon, (v) => dat(null, v)], ["phut", PHUT, phutChon, (v) => dat(null, null, v)]].map(([ma, ds, chon, doi]) => (
                    <div key={ma} data-cot={ma} className="h-[290px] flex-1 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div style={{ height: 4 * CAO_O }} />
                      {ds.map((g) => (
                        <button key={g} type="button" onClick={() => doi(g)} style={{ height: CAO_O }}
                          className={cn("block w-full rounded text-center text-[0.875rem] tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground",
                            g === chon && "border-y border-primary/30 bg-primary/10 font-bold text-foreground")}>{g}</button>))}
                      <div style={{ height: 4 * CAO_O }} />
                    </div>))}
                </div>
                <div className="flex items-center justify-between gap-1 border-t px-3 py-2">
                  <button type="button" className="rounded px-1.5 py-1 text-[0.8125rem] text-muted-foreground hover:bg-accent hover:text-foreground" onClick={huy}>Hủy</button>
                  <button type="button" className="rounded px-1.5 py-1 text-[0.8125rem] font-bold text-primary hover:bg-primary/10" onClick={xacNhan}>Xác nhận</button>
                </div>
              </div>)}
          </div>
        </div>)}
    </div>
  );
}
