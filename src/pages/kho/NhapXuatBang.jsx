import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardPaste, Plus, Save, X } from "lucide-react";
import { useApp } from "@/store";
import { Input, NativeSelect } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { useThietBi } from "@/thietbi/Host";
import { so, plain } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { ngayStr, khuChoPhepHang } from "@/lib/kho";
import { tinhTonDau, luotTonDau } from "@/lib/tonDau";
import { cn } from "@/lib/utils";
import { caHienTai, dsCa, tenCa } from "./GiaoDichForm";

// Nhập / xuất / điều chuyển kho dạng BẢNG, cùng kiểu hộp Kế hoạch xuất/nhập kho (anh Sỹ chốt 16/11/2026):
// chọn ngày + ca, mỗi dòng một gian / lô với các ô Nhập (t), Xuất (t), Điều chuyển (t) (+ đến bãi › gian/lô) và Ghi chú; bấm Lưu ghi MỘT lần mọi lượt.
// Một dòng có thể vừa nhập vừa xuất vừa điều chuyển (mỗi ô có số là một lượt trong sổ). Không còn Nguồn / mục đích, Số lô, Chứng từ.
// Kiểm tra tồn theo cả bảng: tồn hiện có + nhập + điều chuyển đến − xuất − điều chuyển đi của từng (gian / lô, hàng) không được âm.
// Sửa một lượt đã ghi vẫn dùng GiaoDichForm (Lịch sử › Sửa).
const ss = (a, b) => String(a).localeCompare(String(b), "vi", { numeric: true, sensitivity: "base" });
const TRONG = { bai: "", khuKey: "", hang: "", tonDau: "", nhap: "", xuat: "", dc: "", denBai: "", denKhu: "", ghi_chu: "" };

export default function NhapXuatBang({ loaiKho, kho, onDan, onXong }) {
  const { D, api, run, toast } = useApp();
  const tbD = useThietBi()?.D;
  const hh = kho.hangHoa || [];
  const coBaiNho = !!D.coSql12;
  const dongKho = useMemo(() => kho.dong.filter((d) => d.loai === loaiKho && !d.saiBai), [kho, loaiKho]);
  const capKho = useMemo(() => kho.cap.filter((c) => c.loai === loaiKho), [kho, loaiKho]);
  const baiDs = useMemo(() => [...new Set(dongKho.map((d) => d.ten_bai))].sort(ss), [dongKho]);
  const khuCuaBai = (b) => dongKho.filter((d) => d.ten_bai === b).sort((x, y) => ss(x.ten, y.ten));
  const khuTheoKey = useMemo(() => new Map(dongKho.map((d) => [d.key, d])), [dongKho]);
  const tenKhuDong = (d) => (d.hang && plain(d.hang) !== plain(d.ten) ? `${d.ten} · ${d.hang}` : d.ten);
  const ton = (key, hang) => capKho.find((c) => c.key === key && plain(c.hang) === plain(hang))?.ton || 0;

  const homNay = ngayStr(D.now), ca0 = caHienTai();
  const [ngay, setNgay] = useState(ca0.ngay), [ca, setCa] = useState(ca0.so);
  const dem = useRef(0);
  const dongMoi = (o = {}) => ({ _k: `n${++dem.current}`, ...TRONG, bai: baiDs.length === 1 ? baiDs[0] : "", ...o });
  const [f, setF] = useState(() => { const b = baiDs.length === 1 ? baiDs[0] : "", ks = b ? khuCuaBai(b) : []; return [{ _k: "n0", ...TRONG, bai: b, khuKey: ks.length === 1 ? ks[0].key : "" }]; });
  const dat = (k, v) => setF((o) => o.map((r) => (r._k === k ? { ...r, ...(typeof v === "function" ? v(r) : v) } : r)));

  const doiNgay = (n) => { if (!n) return; setNgay(n); const ds = dsCa(tbD, n); if (!ds.some((c) => c[0] === ca)) setCa(ds[0]?.[0] || ca); };
  const lech = (n) => { const d = new Date(ngay + "T00:00"); d.setDate(d.getDate() + n); doiNgay(ngayStr(d.getTime())); };

  // Cột Hàng = hàng ĐANG CHỨA khai cho gian / lô ở Danh mục (tự nhảy theo gian / lô); gian / lô chưa khai hàng thì lấy các hàng đang có tồn. Gian / lô chưa chứa hàng nào thì mới cho chọn hàng được phép nhận (khỏi bí khi nhập lần đầu)
  const hangCuaKhu = (kr) => {
    if (!kr) return [];
    // Gian / lô đã khai "Hàng đang chứa" (Danh mục) thì cột Hàng chỉ có đúng hàng đó và tự nhảy theo gian / lô (kể cả bãi kiểu Tự do đang có tồn hàng khác)
    const khai = String(kr.hang || "").trim();
    const dang = khai ? [khai] : [...new Set((kr.chua || []).map((c) => String(c.hang || "").trim()).filter(Boolean))];
    return dang.length ? dang : hh.map((h) => h.loai_hang).filter((h) => khuChoPhepHang(kr, h, hh));
  };
  const hangTuDong = (kr, hangCu) => {
    if (!kr) return "";
    const hs = hangCuaKhu(kr);
    if (hangCu && hs.some((h) => plain(h) === plain(hangCu))) return hangCu;
    return hs.length === 1 ? hs[0] : "";
  };
  const chonBai = (r, b) => { const ks = khuCuaBai(b), kr = ks.length === 1 ? ks[0] : null; dat(r._k, { bai: b, khuKey: kr?.key || "", hang: hangTuDong(kr, r.hang) }); };
  const chonKhu = (r, key) => dat(r._k, { khuKey: key, hang: hangTuDong(khuTheoKey.get(key), r.hang) });
  const chonDenBai = (r, b) => { const ks = khuCuaBai(b).filter((d) => d.key !== r.khuKey); dat(r._k, { denBai: b, denKhu: ks.length === 1 ? ks[0].key : "" }); };

  const coSo = (r) => ["tonDau", "nhap", "xuat", "dc"].some((k) => String(r[k]).trim() !== "");
  // Kiểm tra cả bảng, trả { recs, loi }
  const lap = () => {
    const recs = [], delta = new Map(), nhan = new Map(), coTonDau = new Set();
    const cong = (key, hang, x, ten) => { const k = `${key}|${plain(hang)}`; delta.set(k, (delta.get(k) || 0) + x); nhan.set(k, ten); };
    for (let i = 0; i < f.length; i++) {
      const r = f[i];
      if (!coSo(r)) continue;
      const loi = (m) => ({ loi: `Dòng ${i + 1}: ${m}` });
      const kr = khuTheoKey.get(r.khuKey), hang = String(r.hang || "").trim();
      if (!r.bai) return loi("chọn bãi");
      if (!kr) return loi("chọn gian / lô");
      if (!hang) return loi("chọn hàng hóa");
      const tenHang = hangCuaKhu(kr).find((h) => plain(h) === plain(hang));
      if (!tenHang) return loi(`${kr.ten_bai} › ${kr.ten} không chứa ${hang} (chỉ chọn hàng đang chứa trong gian / lô)`);
      const tenGian = `${kr.ten_bai} › ${kr.ten}`;
      const base = { ngay, ca: tenCa(tbD, ngay, ca), ten_bai: kr.ten_bai, ...(coBaiNho ? { ten_khu: kr.ten } : {}), hang: tenHang, so_lo: null, nguon: null, voyage_id: null, chung_tu: null, ghi_chu: String(r.ghi_chu || "").trim() || null };
      const sl = (k, ten) => { const t = String(r[k]).trim(); if (!t) return null; const v = docSo(t); return v != null && Number.isFinite(v) && v >= 0 ? v : `${ten} phải là số không âm (nhập 0 cũng được)`; }; // 0 được nhận (anh Sỹ 21/11/2026)
      // Tồn đầu (đầu ngày đang chọn): ĐẶT LẠI số tồn, lần khai báo gần nhất thay các lần trước (không cộng dồn); lib/tonDau.js
      const tdS = String(r.tonDau).trim();
      if (tdS) {
        const X = docSo(tdS), kk = `${kr.key}|${plain(tenHang)}`;
        if (X == null || !(X >= 0)) return loi("Tồn đầu phải là số không âm");
        if (ngay < ngayStr(Date.now() - 30 * 864e5)) return loi("Tồn đầu chỉ khai cho ngày trong 30 ngày gần đây");
        if (coTonDau.has(kk)) return loi(`hai dòng cùng khai tồn đầu của ${tenGian} · ${tenHang}`);
        coTonDau.add(kk);
        const td = tinhTonDau({ kho, giaoDich: D.giaoDich || [], key: kr.key, hang: tenHang, ngay, tonDau: X });
        const luot = luotTonDau({ ngay, ca: tenCa(tbD, ngay, ca), kr, hang: tenHang, tonDau: X, ...td, ghi_chu: base.ghi_chu, ghiCa: true });
        if (luot) recs.push(luot);
        cong(kr.key, tenHang, td.delta, `${tenGian} · ${tenHang}`);
      }
      for (const [k, ten, lg] of [["nhap", "Nhập", "nhap"], ["xuat", "Xuất", "xuat"], ["dc", "Điều chuyển", "dieu_chuyen"]]) {
        const v = sl(k, ten);
        if (v == null) continue;
        if (typeof v === "string") return loi(v);
        if (lg === "nhap") {
          if (!khuChoPhepHang(kr, tenHang, hh)) return loi(`${tenGian} không nhận ${tenHang}${kr.kieu === "co_dinh_hang" && kr.hang ? ` (cố định hàng ${kr.hang})` : kr.kieu === "co_dinh_nhom" ? " (cố định nhóm khác)" : ""}`);
          cong(kr.key, tenHang, v, `${tenGian} · ${tenHang}`);
          recs.push({ ...base, loai: "nhap", so_luong: v });
        } else if (lg === "xuat") {
          cong(kr.key, tenHang, -v, `${tenGian} · ${tenHang}`);
          recs.push({ ...base, loai: "xuat", so_luong: v });
        } else {
          const kd = khuTheoKey.get(r.denKhu);
          if (!r.denBai) return loi("điều chuyển: chọn bãi đến");
          if (!kd) return loi("điều chuyển: chọn gian / lô đến");
          if (kd.key === kr.key) return loi("điều chuyển: gian / lô đến phải khác gian / lô đi");
          if (!khuChoPhepHang(kd, tenHang, hh)) return loi(`${kd.ten_bai} › ${kd.ten} không nhận ${tenHang}`);
          cong(kr.key, tenHang, -v, `${tenGian} · ${tenHang}`);
          cong(kd.key, tenHang, v, `${kd.ten_bai} › ${kd.ten} · ${tenHang}`);
          recs.push({ ...base, loai: "dieu_chuyen", den_bai: kd.ten_bai, ...(coBaiNho ? { den_khu: kd.ten } : {}), so_luong: v });
        }
      }
    }
    for (const [k, d] of delta) {
      if (d >= 0 || coTonDau.has(k)) continue; // gian / lô đã khai tồn đầu: số tồn do tồn đầu quyết định, không kiểm vượt tồn theo sổ cũ
      const key = k.slice(0, k.indexOf("|")), hang = k.slice(k.indexOf("|") + 1);
      const t = capKho.find((c) => c.key === key && plain(c.hang) === hang)?.ton || 0;
      // d đã gồm cả nhập / điều chuyển đến của bảng: tồn sau khi ghi = t + d
      if (t + d < -1e-6) return { loi: `Vượt tồn: ${nhan.get(k)} đang có ${so(t)} t, sau khi ghi bảng này còn âm ${so(-(t + d))} t` };
    }
    return { recs };
  };
  const { recs, loi } = useMemo(lap, [f, ngay, ca]); // eslint-disable-line react-hooks/exhaustive-deps
  const tong = (c) => f.reduce((s, r) => s + (docSo(r[c]) || 0), 0);
  const luu = async () => {
    if (loi) return toast(loi, "bad");
    if (!recs.length) return toast("Chưa có lượt nào: nhập số ở ô Tồn đầu, Nhập, Xuất hoặc Điều chuyển", "bad");
    const dm = (lg) => recs.filter((x) => x.loai === lg).length;
    const ok = await run(() => api.addGiaoDich(recs), `Đã ghi ${recs.length} lượt: ${[["dau_ky", "tồn đầu"], ["nhap", "nhập"], ["xuat", "xuất"], ["dieu_chuyen", "điều chuyển"]].filter(([k]) => dm(k)).map(([k, t]) => `${dm(k)} ${t}`).join(", ")}`);
    if (ok) onXong();
  };
  const caOpts = dsCa(tbD, ngay).map(([v, t, gio]) => [v, gio ? `${t} ${gio}` : t]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => lech(-1)} aria-label="Ngày trước" title="Ngày trước"><ChevronLeft /></Button>
          <Input type="date" className="h-7 w-36 text-xs" value={ngay} onChange={(e) => doiNgay(e.target.value)} aria-label="Ngày" />
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => lech(1)} aria-label="Ngày sau" title="Ngày sau"><ChevronRight /></Button>
          <Button size="xs" variant="ghost" onClick={() => { const c = caHienTai(); setNgay(c.ngay); setCa(c.so); }}>Hôm nay</Button>
          <NativeSelect className="h-7 w-44 text-xs" value={ca} onChange={(e) => setCa(e.target.value)} options={caOpts} aria-label="Ca" />
          {ngay !== homNay && <span className="text-xs text-muted-foreground">{ngay.slice(8, 10)}/{ngay.slice(5, 7)}/{ngay.slice(0, 4)}</span>}
        </div>
        {onDan && <Button size="xs" variant="outline" onClick={onDan} title="Nạp nhiều lượt cùng lúc từ bảng Excel (dán hoặc chọn file)"><ClipboardPaste />Dán nhanh / Excel</Button>}
        <div className="ml-auto flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span><span className="text-muted-foreground">Nhập</span> <b className="tabular-nums text-ok">{so(tong("nhap"))}</b></span>
          <span><span className="text-muted-foreground">Xuất</span> <b className="tabular-nums text-warn">{so(tong("xuat"))}</b></span>
          <span><span className="text-muted-foreground">Điều chuyển</span> <b className="tabular-nums text-info">{so(tong("dc"))}</b></span>
        </div>
      </div>
      <div className="scroll-x max-h-[40vh] rounded-md border">
        <table className="tbl text-xs">
          <thead><tr><th className="min-w-[250px]">Bãi › Gian/lô</th><th className="min-w-[170px]">Hàng hóa</th><th className="num" title="Đặt lại số tồn đầu ngày đang chọn; lần khai báo gần nhất thay các lần trước, không cộng dồn">Tồn đầu</th><th className="num">Nhập</th><th className="num">Xuất</th><th className="num">Điều chuyển</th><th className="min-w-[250px]">Đến bãi › Gian/lô (điều chuyển)</th><th>Ghi chú</th><th></th></tr></thead>
          <tbody>
            {f.map((r) => {
              const kr = khuTheoKey.get(r.khuKey), hs = hangCuaKhu(kr), t = kr && r.hang ? ton(kr.key, r.hang) : null;
              const denKhus = r.denBai ? khuCuaBai(r.denBai).filter((d) => d.key !== r.khuKey) : [];
              return (
                <tr key={r._k} className={cn(coSo(r) && "bg-warn/5")}>
                  <td className="whitespace-nowrap">
                    <div className="flex gap-1.5">
                      <NativeSelect className="h-8 min-w-[120px]" value={r.bai} onChange={(e) => chonBai(r, e.target.value)} placeholder="Chọn bãi" options={baiDs} aria-label="Bãi" />
                      <NativeSelect className="h-8 min-w-[120px]" value={r.khuKey} onChange={(e) => chonKhu(r, e.target.value)} placeholder={r.bai ? "Chọn gian/lô" : "Chọn bãi trước"} disabled={!r.bai} options={r.bai ? khuCuaBai(r.bai).map((d) => [d.key, tenKhuDong(d)]) : []} aria-label="Gian/lô" />
                    </div>
                  </td>
                  <td>
                    <ChonGo className="min-w-[160px]" value={r.hang} onChange={(x) => dat(r._k, { hang: x })} options={hs.map((h) => [h, h, `tồn ${so(ton(kr.key, h))} t`])} placeholder={kr ? "Chọn hàng" : "Chọn gian/lô trước"} />
                    {t != null && <div className="mt-0.5 text-[0.6875rem] text-muted-foreground">Tồn: {so(t)} t</div>}
                  </td>
                  <td className="num"><Input className="ml-auto h-8 w-28 text-right tabular-nums" inputMode="decimal" value={r.tonDau} placeholder="—" onChange={(e) => dat(r._k, { tonDau: e.target.value })} aria-label="Tồn đầu" title="Số tồn ở đầu ngày đang chọn (đặt lại, không cộng dồn)" /></td>
                  <td className="num"><Input className="ml-auto h-8 w-28 text-right tabular-nums" inputMode="decimal" value={r.nhap} placeholder="0" onChange={(e) => dat(r._k, { nhap: e.target.value })} aria-label="Khối lượng nhập" /></td>
                  <td className="num"><Input className="ml-auto h-8 w-28 text-right tabular-nums" inputMode="decimal" value={r.xuat} placeholder="0" onChange={(e) => dat(r._k, { xuat: e.target.value })} aria-label="Khối lượng xuất" /></td>
                  <td className="num"><Input className="ml-auto h-8 w-28 text-right tabular-nums" inputMode="decimal" value={r.dc} placeholder="0" onChange={(e) => dat(r._k, { dc: e.target.value })} aria-label="Khối lượng điều chuyển" /></td>
                  <td className="whitespace-nowrap">
                    <div className="flex gap-1.5">
                      <NativeSelect className="h-8 min-w-[120px]" value={r.denBai} onChange={(e) => chonDenBai(r, e.target.value)} placeholder="Bãi đến" options={baiDs} aria-label="Bãi đến" />
                      <NativeSelect className="h-8 min-w-[120px]" value={r.denKhu} onChange={(e) => dat(r._k, { denKhu: e.target.value })} placeholder={r.denBai ? "Gian/lô đến" : "Chọn bãi đến"} disabled={!r.denBai} options={denKhus.map((d) => [d.key, tenKhuDong(d)])} aria-label="Gian/lô đến" />
                    </div>
                  </td>
                  <td><Input className="h-8" value={r.ghi_chu} onChange={(e) => dat(r._k, { ghi_chu: e.target.value })} aria-label="Ghi chú" /></td>
                  <td className="w-8"><button type="button" className="rounded p-1 text-muted-foreground hover:text-bad" onClick={() => setF((o) => (o.length > 1 ? o.filter((x) => x._k !== r._k) : [dongMoi()]))} title="Bỏ dòng" aria-label="Bỏ dòng"><X className="h-4 w-4" /></button></td>
                </tr>);
            })}
          </tbody>
        </table>
      </div>
      {loi && coSoBang(f) && <p className="rounded-md border border-bad/40 bg-bad/5 px-3 py-1.5 text-xs text-bad">{loi}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-[0.6875rem] text-muted-foreground">Chọn bãi và gian / lô rồi nhập số ở ô Tồn đầu, Nhập, Xuất và / hoặc Điều chuyển (điều chuyển chọn thêm bãi › gian/lô đến). Số tính bằng tấn. <b>Tồn đầu</b> là số tồn đầu ngày đang chọn: lần khai báo gần nhất thay các lần trước, không cộng dồn. Một dòng ghi được nhiều lượt; Lưu ghi tất cả một lần. Hàng để trống thì tự điền theo hàng của gian / lô.</p>
        <Button size="sm" variant="outline" onClick={() => setF((o) => [dongMoi({ bai: o[0]?.bai || "" }), ...o])}><Plus />Thêm dòng</Button>
        <Button size="sm" disabled={!recs?.length || !!loi} onClick={luu}><Save />Lưu{recs?.length ? ` ${recs.length} lượt` : ""}</Button>
      </div>
    </div>
  );
}
const coSoBang = (f) => f.some((r) => ["tonDau", "nhap", "xuat", "dc"].some((k) => String(r[k]).trim() !== ""));
