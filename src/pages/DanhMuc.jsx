import { Fragment, useRef, useState } from "react";
import { Truck, Users, Anchor, Package, Warehouse, HardHat, Plus, Save, Upload, Download, Pencil, Check, X, Database, Wrench, Construction, Columns3, Trash2, Gauge, ListOrdered, Boxes, Route, MapPinned, Layers, LayoutGrid } from "lucide-react";
import { useApp } from "@/store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ThanhTab from "../khung/ThanhTab";
import { PageHead } from "@/components/common";
import { plain, matchQ, so, met } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { useThietBi, TBCho, TB } from "@/thietbi/Host";
import { Card as TCard, Search, Modal, Field, ConfirmButton as TConfirm, Empty as TEmpty, Select as TSelect } from "@/thietbi/components/ui";
import { useChonNhieu, OTickTieuDe, OTick, ThanhChon } from "@/thietbi/components/chonNhieu";
import { ChonGo } from "@/components/ui/combobox";
import DanhMucXe from "@/thietbi/tabs/DanhMucXe";
import { DanhSachNhanSu } from "@/thietbi/tabs/Staffing";
import { DEFAULT_NHA_THAU } from "@/thietbi/lib/plan";
import DM_BANG from "@/data/dmBang.json";
import CotThem from "@/components/CotThem";
import { tuTinhSucChua, khoaTenBai, kiemTraTenBai, loaiQuyHoach, TEN_KHO_KIEN, TEN_KHO_ROI } from "@/lib/kho";
import QuyHoachBai from "@/pages/kho/QuyHoachBai";

// Danh mục dùng chung cho cả web. Mỗi danh sách cùng giao diện Danh mục xe: Thêm, Import, Xuất Excel; Sửa / Xóa ở từng dòng (sửa trong hộp riêng).
// Cột: [khóa, tên cột, loại (text | so | bool | mang), độ rộng, tên cột khác khi nhập Excel]
// chuaPhanBo (true = mọi cột, hoặc mảng khóa cột): ô chưa có giá trị hiện ***** màu vàng (chỉ hiển thị, không lưu thành giá trị)
const laChuaPB = (cfg, k, loai) => loai !== "bool" && (cfg.chuaPhanBo === true || (Array.isArray(cfg.chuaPhanBo) && cfg.chuaPhanBo.includes(k)));
// Thêm tùy chọn cho hộp sửa: chon (ô chọn), chonTrong (chữ khi để trống), goiY (gợi ý khi gõ), ph (chữ mờ), macDinh (giá trị khi thêm mới)

const hienO = (v, loai) => (loai === "mang" ? (v || []).join("; ") : loai === "bool" ? !!v : v ?? "");
const docO = (s, loai) => {
  if (loai === "mang") return Array.isArray(s) ? s : String(s ?? "").split(/[;,]+/).map((x) => x.trim()).filter(Boolean);
  if (loai === "bool") return s === true || /^(1|x|co|có|true|yes|≤)$/i.test(String(s ?? "").trim());
  if (loai === "so") return s === "" || s == null ? null : typeof s === "number" ? s : docSo(String(s).replace(/<=|≤/, ""));
  return String(s ?? "").trim() || null;
};
// Tab đang chọn (tab chính và tab nhỏ) nhớ trong trình duyệt
function useTabNho(khoa, macDinh) {
  const [tab, setTab] = useState(() => { try { return localStorage.getItem(khoa) || macDinh; } catch { return macDinh; } });
  return [tab, (t) => { setTab(t); try { localStorage.setItem(khoa, t); } catch { /* bỏ qua */ } }];
}
// Tab nhỏ trong một tab chính: ds = [[mã, tên, icon, nội dung]]
function TabNho({ khoa, ds }) {
  const [tab, doiTab] = useTabNho(`lg-danh-muc-${khoa}`, ds[0][0]);
  const gt = ds.some((x) => x[0] === tab) ? tab : ds[0][0];
  return (
    <Tabs value={gt} onValueChange={doiTab}>
      <TabsList className="h-auto flex-wrap justify-start bg-transparent p-0 gap-1">{ds.map(([k, t, I]) => (
        <TabsTrigger key={k} value={k} className="rounded-md border border-border/70 px-2.5 py-1 text-xs data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">{I && <I />}{t}</TabsTrigger>))}
      </TabsList>
      {ds.map(([k, , , nd]) => <TabsContent key={k} value={k} className="grid gap-3">{nd}</TabsContent>)}
    </Tabs>
  );
}

// tab, onTab: tab chính nằm trong đường dẫn #/danh-muc/<tab> (khung điều hướng truyền vào); tab nhỏ vẫn nhớ trong trình duyệt
export default function DanhMuc({ tab: tabUrl, onTab }) {
  const { D, quyen, api, run, toast } = useApp();
  const tb = useThietBi();
  const tbD = tb?.D;
  const [tabNho, doiNho] = useTabNho("lg-danh-muc-tab", "thiet-bi");
  const tab = tabUrl ?? tabNho;
  const doiTab = (t) => { doiNho(t); onTab?.(t); };
  const adminTB = !!tb?.sua?.("dm_thiet_bi");
  // Danh sách lưu nguyên một bản ghi (nhà thầu, thiết bị gắn): gộp các dòng sửa theo khóa rồi lưu cả danh sách
  const gopDs = (ds, rows, khoa) => { const m = new Map(ds.map((x) => [x[khoa], x])); for (const r of rows) m.set(r[khoa], { ...m.get(r[khoa]), ...r }); return [...m.values()]; };

  // Cột mới của SQL 08 (xưởng, hệ số, loại hàng, đơn trọng, số lớp…): chỉ hiện khi CSDL đã có
  const coSql08 = !!D.coSql08;
  const hangMoi = (tbD?.hanghoa || []).some((h) => "loai_hh" in h);
  const xeMoi = (tbD?.vehicles || []).some((v) => "ten_loai" in v);
  const khoMoi = (D.khoBai || []).some((r) => "so_lop" in r);

  // Bảng danh mục phụ (bảng danh_muc_bang, SQL 08): cột theo dòng tiêu đề của sheet trong file Danh_muc_tong_hop.xlsx
  const bangPhu = (key) => {
    const c = DM_BANG[key], k0 = c.cot[0][0], k1 = key === "cau_dm" ? c.cot[1]?.[0] : null;
    return {
      ten: c.ten, khoa: "id", batBuoc: k0, coSua: key === "bai_lon" ? quyen.suaDmKho : quyen.quanTri || quyen.suaDmThietBi, ai: "quản trị", bang: "dm_" + key,
      rows: (D.dmBang || []).filter((r) => r.bang === key).map((r) => ({ id: r.id, ...r.data })),
      cot: c.cot.map(([k, t, l]) => [k, t, l, l === "so" ? 100 : Math.min(220, Math.max(110, t.length * 7))]),
      mo: c.cot.length && !(D.dmBang || []).some((r) => r.bang === key) ? "Chưa có dữ liệu (sheet trong file mới có tiêu đề). Bấm Thêm hoặc Import để nhập." : null,
      khop: (o, rows) => rows.find((x) => plain(x[k0]) === plain(o[k0]) && (!k1 || plain(x[k1]) === plain(o[k1])))?.id,
      luu: (rows) => run(() => api.saveDmBang(key, rows), `Đã lưu ${rows.length} dòng ${c.ten.toLowerCase()}`),
      xoa: (r) => run(() => api.deleteDmBang([r.id]), "Đã xóa dòng"),
      xoaNhieu: (rs) => run(() => api.deleteDmBang(rs.map((r) => r.id)), `Đã xóa ${rs.length} dòng`),
    };
  };
  const canSql08 = !coSql08 && <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Danh mục này cần chạy <b>sql/08_danh_muc_tong_hop.sql</b> trong Supabase.</div>;
  const bangPhuO = (k, icon) => canSql08 || <BangSua key={k} nguon={bangPhu(k)} icon={icon} />;

  const cotBen = [["ma", "Bến", "text", 70, ["ben", "ten ben", "ma ben"]], ["ten_khac", "Tên khác / mã cũ (;)", "mang", 150], ["dwt_max", "Tải trọng (DWT)", "so", 110, ["tai trong", "trong tai tau (dwt)", "dwt"]], ["mon_max", "Mớn (m)", "so", 80, ["mon", "mon tau load hang (m)"]], ["mon_cung", "Mớn cứng (≤)", "bool", 70], ["loa_max", "Chiều dài bến (m)", "so", 100, ["chieu dai ben"]], ["loai_hang", "Loại hàng thường làm (ưu tiên trái → phải)", "text", 300, ["loai hang", "hang chinh"]], ...(D.coSql19 ? [["bang_tai", "Băng tải làm hàng", "text", 130, ["bang tai"]]] : []), ["thu_tu", "Thứ tự trên lịch", "so", 60], ["ghi_chu", "Ghi chú", "text", 160]];
  const nguonBen = (ten, cot, mo) => ({
    ten, khoa: "ma", rows: D.berths, coSua: quyen.suaDmCauBen, ai: "quản trị", mo, cot, bang: "ben",
    chuyenNhap: (o, goc) => { const cung = /<=|≤/.test(String(goc.mon_max ?? "")); return { ...o, ma: String(o.ma).trim().toUpperCase(), ...(cung ? { mon_cung: true } : {}) }; },
    luu: (rows) => run(() => api.upsertRows("berths", rows, "ma"), `Đã lưu ${rows.length} bến`),
    xoa: (r) => run(() => api.deleteRow("berths", "ma", r.ma), `Đã xóa bến ${r.ma}`),
    xoaNhieu: (rs) => run(() => api.deleteRows("berths", "ma", rs.map((r) => r.ma)), `Đã xóa ${rs.length} bến`),
  });

  // Hàng hóa: hàng rời (tỷ khối đống, độ ẩm) và hàng thành phẩm / hàng kiện (đơn trọng)
  const nguonHang = (loai) => {
    const roi = loai === "roi", ds = (tbD?.hanghoa || []).filter((h) => (roi ? h.loai_hh !== "thanh_pham" : h.loai_hh === "thanh_pham"));
    return {
      ten: roi ? "Hàng rời" : "Hàng thành phẩm (hàng kiện)", khoa: "loai_hang", rows: ds, coSua: quyen.suaDmHang, ai: "quản trị", bang: "hang",
      mo: roi ? "Tỷ khối đống (tấn/m³) dùng tính sức chứa bãi nguyên liệu, tra loại hàng của chuyến tàu." : "Đơn trọng: khối lượng một kiện (cuộn, bó, tấm…).",
      goiY: { nhom: [...new Set((tbD?.hanghoa || []).map((h) => h.nhom).filter(Boolean))] },
      cot: [["loai_hang", "Tên hàng", "text", 230, ["ten hang", "ten hang hoa"]], ["nhom", "Loại hàng (nhóm hàng)", "text", 150, ["loai hang", "nhom hang", "loai hang (nhom hang)"]],
        ...(hangMoi ? [["don_vi", "Đơn vị", "text", 90]] : []),
        roi ? ["ti_trong", "Tỷ khối đống", "so", 100, ["ty khoi dong", "ti trong", "ty khoi"]] : hangMoi ? ["don_trong", "Đơn trọng", "so", 90] : null,
        ...(hangMoi && roi ? [["do_am", "Độ ẩm", "text", 110]] : []), ["ghi_chu", "Ghi chú", "text", 220]].filter(Boolean),
      luu: (rows) => tb.run(() => tb.api.upsertHangHoa(rows.map((r) => (hangMoi ? { ...r, loai_hh: loai } : r))), `Đã lưu ${rows.length} loại hàng`),
      xoa: (r) => tb.run(() => tb.api.deleteHangHoa(r.loai_hang), `Đã xóa ${r.loai_hang}`),
      xoaNhieu: (rs) => tb.run(() => tb.api.deleteHangHoas(rs.map((r) => r.loai_hang)), `Đã xóa ${rs.length} loại hàng`),
    };
  };

  // Khai báo & quy hoạch (16/11/2026): khai báo kho / bãi (bảng danh_muc_bang "bai_lon") rồi bấm biểu tượng Quy hoạch ở từng dòng để chia gian / lô
  // (mỗi gian / lô là một dòng kho_bai: Gian/lô, Diện tích phân bổ, Thiết bị bãi, Quy hoạch chứa = Hàng rời / Hàng kiện).
  const dsHang = tbD?.hanghoa || [];
  const nguonKhaiBao = () => {
    const goc = bangPhu("bai_lon"), kT = DM_BANG.bai_lon.cot[0][0], kDT = DM_BANG.bai_lon.cot[1][0];
    const dongCua = (ten) => (D.khoBai || []).filter((r) => khoaTenBai(r.ten_bai) === khoaTenBai(ten));
    const daKhaiBao = new Set(goc.rows.map((r) => khoaTenBai(r[kT])));
    const chuaKhaiBao = [...new Set((D.khoBai || []).map((r) => r.ten_bai).filter((t) => t && !daKhaiBao.has(khoaTenBai(t))))];
    // Kiểm tra trước khi lưu: tên không trùng, không đổi tên kho / bãi đã quy hoạch, diện tích không nhỏ hơn đã phân bổ
    const kiemTra = (rows) => {
      const sau = new Map(goc.rows.map((r) => [r.id, r[kT]]));
      let tam = -1;
      for (const r of rows) {
        // Không được để ô trống (anh Sỹ 21/11/2026): mọi cột của dòng khai báo phải có giá trị (số 0 vẫn là giá trị)
        const trong = DM_BANG.bai_lon.cot.find(([kc]) => r[kc] == null || String(r[kc]).trim() === "");
        if (trong) return `Kho / bãi "${String(r[kT] ?? "").trim() || "(chưa đặt tên)"}": chưa điền "${trong[1]}". Không được để ô trống nên chưa lưu được.`;
        const e = kiemTraTenBai(r[kT], [...sau].map(([id, ten]) => ({ id, ten })), r.id);
        if (e) return e;
        const cu = r.id != null ? sau.get(r.id) : null;
        if (cu && khoaTenBai(cu) !== khoaTenBai(r[kT]) && dongCua(cu).length) return `Kho / bãi "${cu}" đã quy hoạch ${dongCua(cu).length} gian / lô nên không đổi tên được (xóa quy hoạch trước)`;
        const dt = +r[kDT] || 0, da = dongCua(r[kT]).reduce((x, d) => x + (+d.dien_tich || 0), 0);
        if (dt > 0 && da > dt + 1e-6) return `Diện tích "${r[kT]}" (${so(dt)} m²) nhỏ hơn diện tích đã phân bổ cho các gian / lô (${so(da)} m²)`;
        sau.set(r.id ?? tam--, r[kT]);
      }
      return null;
    };
    const chanXoa = (rs) => { const co = rs.find((r) => dongCua(r[kT]).length); if (!co) return false; toast(`"${co[kT]}" đã quy hoạch ${dongCua(co[kT]).length} gian / lô: xóa quy hoạch các gian / lô trước rồi mới xóa được kho / bãi`, "bad"); return true; };
    return {
      ...goc, ten: "Khai báo & quy hoạch", tenNutThem: "Khai báo", gonNut: true, mo: null,
      // Gõ hoặc chọn các giá trị đã có (anh Sỹ 21/11/2026); ô chưa có giá trị hiện ***** (chữ vàng, chỉ hiển thị, không lưu thành giá trị)
      goiY: {
        pham_vi_khu_vuc: [...new Set(goc.rows.map((r) => String(r.pham_vi_khu_vuc ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })),
        loai_kho_bai: [...new Set(["Cố định", "Tự do", ...goc.rows.map((r) => String(r.loai_kho_bai ?? "").trim()).filter(Boolean)])],
      },
      chuaPhanBo: true,
      moDau: <>Khai báo kho / bãi (tên, diện tích, khu vực, loại), rồi bấm biểu tượng <b>Quy hoạch</b> ở từng dòng để chia gian / lô: diện tích phân bổ, thiết bị bãi, quy hoạch chứa (Hàng rời / Hàng kiện). Chỉ gian / lô đã quy hoạch mới hiện ở hai tab <b>{TEN_KHO_ROI}</b> và <b>{TEN_KHO_KIEN}</b>. Không trùng tên kho / bãi, không trùng gian / lô trong cùng kho / bãi, tổng diện tích phân bổ không vượt diện tích kho / bãi.
        {chuaKhaiBao.length > 0 && <div style={{ marginTop: 6, color: "var(--warn)" }}>Có {chuaKhaiBao.length} kho / bãi đã có gian / lô nhưng chưa khai báo ở đây: {chuaKhaiBao.join(", ")}. Bấm Khai báo để thêm (giữ đúng tên).</div>}</>,
      luu: (rows) => { const e = kiemTra(rows); if (e) { toast(e, "bad"); return false; } return goc.luu(rows); },
      xoa: (r) => (chanXoa([r]) ? false : goc.xoa(r)),
      xoaNhieu: (rs) => (chanXoa(rs) ? false : goc.xoaNhieu(rs)),
      nutDong: (r, { mo, bam }) => { const n = dongCua(r[kT]).length; return (
        <button type="button" className={"btn sm" + (mo ? " pri" : "")} title="Quy hoạch gian / lô" aria-label={`Quy hoạch gian / lô của ${r[kT]}`} onClick={bam}><LayoutGrid size={13} />{n > 0 && <span style={{ marginLeft: 2 }}>{n}</span>}</button>); },
      moRong: (r) => (
        <QuyHoachBai bai={{ ten: r[kT], dienTich: r[kDT] }} dong={dongCua(r[kT])} hangHoa={dsHang} coSua={quyen.suaDmKho} toast={toast}
          onLuu={(row, moi) => run(() => api.upsertRows("kho_bai", [row], "id"), moi ? `Đã quy hoạch gian / lô ${row.ten_khu}` : `Đã sửa quy hoạch ${row.ten_khu}`)}
          onXoa={(row) => run(() => api.deleteRow("kho_bai", "id", row.id), `Đã xóa quy hoạch ${row.ten_khu || row.hang || ""}`)} />),
    };
  };

  // Kho hàng kiện (thành phẩm) / Kho hàng rời: các gian / lô ĐÃ quy hoạch (tab Khai báo & quy hoạch) và thông tin của từng gian / lô:
  // hàng đang chứa, sức chứa danh nghĩa, hệ số lưu chứa, sức chứa khả dụng, số lớp xếp (hàng kiện) / chiều cao đống (hàng rời)…
  const nguonKho = (loai) => {
    const tp = loai === "thanh_pham";
    // Hàng đã khai báo ở kho KIA (Hàng kiện ↔ Hàng rời), không phân biệt hoa thường / dấu: không khai báo lại ở kho này (anh Sỹ 21/11/2026)
    const hangKhoKhia = new Map();
    for (const r of D.khoBai || []) { const l = loaiQuyHoach(r), h = String(r.hang ?? "").trim(); if (h && (l === "thanh_pham" || l === "nguyen_lieu") && l !== loai) hangKhoKhia.set(plain(h), h); }
    const tenKhoKhia = tp ? TEN_KHO_ROI : TEN_KHO_KIEN;
    return {
      ten: tp ? TEN_KHO_KIEN : TEN_KHO_ROI, khoa: "id", batBuoc: "ten_bai", coSua: quyen.suaDmKho, ai: "quản trị", bang: "kho", anCot: ["khu vuc"], chiSua: true,
      rows: (D.khoBai || []).filter((r) => loaiQuyHoach(r) === loai),
      khoaDoc: ["ten_bai", "ten_khu", "dien_tich", "thiet_bi"],
      mo: `Chỉ hiện các gian / lô đã quy hoạch ${tp ? "Hàng kiện" : "Hàng rời"} (thêm, sửa, xóa ở tab Khai báo & quy hoạch › biểu tượng Quy hoạch). Ở đây khai báo thông tin của từng gian / lô. Sức chứa khả dụng (tấn) là số web dùng; để trống thì web tự tính = sức chứa danh nghĩa × hệ số lưu chứa (chưa có hệ số thì = sức chứa danh nghĩa)${tp ? "" : "; sức chứa danh nghĩa để trống thì = diện tích × chiều cao đống × tỷ khối hàng"}. Kho / bãi khai báo "Cố định" thì mỗi gian / lô chỉ nhận đúng hàng của dòng; "Tự do" nhận mọi hàng (sửa ở tab Khai báo & quy hoạch).`,
      cot: [["ten_bai", "Tên kho / bãi", "text", 150, ["ten kho/bai", "ten kho bai", "bai lon", "ten bai"]], ["ten_khu", "Gian / lô", "text", 140, ["gian/lo", "gian lo", "bai nho", "khu"]],
        ["dien_tich", "Diện tích phân bổ (m²)", "so", 100, ["dien tich phan bo", "dien tich"]],
        ...(tp ? (khoMoi ? [["so_lop", "Số lớp xếp khả dụng", "so", 90, ["so lop xep kha dung", "so lop"]]] : []) : [["chieu_cao", "Chiều cao đống (m)", "so", 90, ["chieu cao dong", "chieu cao"]]]),
        ["hang", "Hàng đang chứa", "text", 200, ["ten hang", "ten hang (hang dang chua)", "hang hoa"]],
        ...(khoMoi ? [["suc_chua_dn", "Sức chứa danh nghĩa (t)", "so", 110, ["suc chua danh nghia"]], ["he_so_luu_chua", "Hệ số lưu chứa", "so", 80, ["he so luu chua"]]] : []),
        ["suc_chua_tay", "Sức chứa khả dụng (t)", "so", 110, ["suc chua kha dung", "suc chua nhap tay"]],

        ["thiet_bi", "Thiết bị bãi", "text", 140, ["thiet bi tai kho/bai", "thiet bi bai", "thiet bi"]], ["ghi_chu", "Ghi chú", "text", 180]],
      ph: { suc_chua_tay: "Trống = danh nghĩa × hệ số lưu chứa", ...(tp ? {} : { suc_chua_dn: "Trống = diện tích × cao × tỷ khối" }) },
      goiY: { hang: dsHang.map((h) => h.loai_hang).filter((h) => !hangKhoKhia.has(plain(h))) },
      chuaPhanBo: true,
      // Chỉ cập nhật gian / lô đã quy hoạch (khớp tên kho / bãi + gian / lô); import không tạo gian / lô mới
      khop: (o, rows) => rows.find((x) => khoaTenBai(x.ten_bai) === khoaTenBai(o.ten_bai) && String(x.ten_khu || x.hang || "").trim().toLowerCase() === String(o.ten_khu || "").trim().toLowerCase())?.id,
      luu: (rows) => {
        const trung = rows.find((r) => String(r.hang ?? "").trim() && hangKhoKhia.has(plain(r.hang)));
        if (trung) { toast(`Hàng "${String(trung.hang).trim()}" đã khai báo ở ${tenKhoKhia} (${hangKhoKhia.get(plain(trung.hang))}) nên không khai báo thêm ở ${tp ? TEN_KHO_KIEN : TEN_KHO_ROI}. Mỗi hàng chỉ thuộc một kho.`, "bad"); return false; }
        // Sức chứa để trống thì tự tính (danh nghĩa × hệ số lưu chứa; kho hàng rời: danh nghĩa = diện tích × cao × tỷ khối)
        const tt = tuTinhSucChua(rows, loai, dsHang, khoMoi);
        if (tt.thieuHeSo) toast(tt.thieuHeSo === 1 ? "Chưa điền hệ số lưu chứa: lấy sức chứa khả dụng = sức chứa danh nghĩa." : `${tt.thieuHeSo} dòng chưa điền hệ số lưu chứa: lấy sức chứa khả dụng = sức chứa danh nghĩa.`);
        return run(() => api.upsertRows("kho_bai", tt.rows.map((r) => ({ ...r, loai_kho: loai, ...(D.coSql17 ? { ten_khu: String(r.ten_khu || "").trim() || null } : {}) })), "id"), `Đã lưu ${rows.length} gian / lô${tt.tuTinh ? " (đã tự tính sức chứa để trống)" : ""}`);
      },
    };
  };

  const NGUON = {
    cau: tbD && {
      ten: "Cẩu cảng", khoa: "ma", rows: tbD.vehicles.filter((v) => v.doi === "Cẩu"), coSua: adminTB, ai: "quản trị", bang: "cau",
      mo: "Cẩu là xe đội \"Cẩu\" trong danh mục thiết bị (theo dõi hỏng / bảo dưỡng như xe). Tải trọng, tầm với theo Thông số cẩu cảng. Cẩu phục vụ nhiều bến: ghi các bến cách nhau dấu ;.",
      goiY: { model: [...new Set(tbD.vehicles.filter((v) => v.doi === "Cẩu").map((v) => v.model).filter(Boolean))], ben_phuc_vu: D.berths.map((b) => b.ma) },
      cot: [["ma", "Mã", "text", 90, ["ma cau", "ten cau"]], ...(xeMoi ? [["ten_loai", "Tên", "text", 120, ["ten"]]] : []), ["model", "Loại", "text", 110, ["loai cau"]], ["ben_phuc_vu", "Thuộc bến (;)", "mang", 100, ["thuoc ben", "ben phuc vu"]],
        ["tai_nang", "Tải trọng", "text", 90, ["tai trong"]], ["tam_voi", "Tầm với", "text", 80], ["bang_tai", "Băng tải làm hàng", "text", 120],
        ...(xeMoi ? [["he_so", "Hệ số làm việc", "so", 80, ["he so lam viec"]]] : []), ["ghi_chu", "Ghi chú", "text", 200]],
      chuyenNhap: (o) => ({ ...o, ben_phuc_vu: (o.ben_phuc_vu || []).map((b) => { const t = String(b).toUpperCase(); return t === "B1A" ? "TL" : /^B(6|7)CTH$/.test(t) ? t.slice(1) : t; }) }),
      luu: (rows) => tb.run(() => tb.api.upsertVehicles(rows.map((r) => ({ ...r, doi: "Cẩu" }))), `Đã lưu ${rows.length} cẩu`),
      xoa: (r) => tb.run(() => tb.api.deleteVehicle(r.ma), `Đã xóa cẩu ${r.ma}`),
      xoaNhieu: (rs) => tb.run(() => tb.api.deleteVehicles(rs.map((r) => r.ma)), `Đã xóa ${rs.length} cẩu`),
    },
    nhaThau: tbD && (() => {
      const ds = (tbD.nhaThau?.list?.length ? tbD.nhaThau.list : DEFAULT_NHA_THAU).map((x) => ({ dang_dung: true, ...x }));
      return {
        ten: "Nhà thầu", khoa: "ten", rows: ds, coSua: adminTB, ai: "quản trị", macDinh: { dang_dung: true }, bang: "nhaThau",
        mo: "Đơn vị thực hiện khi gán xe thuê ngoài (Kế hoạch & phân bổ) và phương tiện nhà thầu của chuyến tàu. Bỏ tích Đang dùng để ẩn mà vẫn giữ kế hoạch cũ.",
        cot: [["ten", "Tên nhà thầu", "text", 200], ["lien_he", "Liên hệ (người, SĐT)", "text", 220], ["ghi_chu", "Ghi chú", "text", 220], ["dang_dung", "Đang dùng", "bool", 70]],
        luu: (rows) => tb.run(() => tb.api.saveNhaThau(gopDs(ds, rows, "ten")), "Đã lưu danh mục nhà thầu"),
        xoa: (r) => tb.run(() => tb.api.saveNhaThau(ds.filter((x) => x.ten !== r.ten)), `Đã xóa ${r.ten}`),
        xoaNhieu: (rs) => { const bo = new Set(rs.map((r) => r.ten)); return tb.run(() => tb.api.saveNhaThau(ds.filter((x) => !bo.has(x.ten))), `Đã xóa ${rs.length} nhà thầu`); },
      };
    })(),
  };
  const canCang = !quyen.coCang && <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Danh mục này thuộc phần Khai thác Cảng: cần quyền Cảng.</div>;
  const tsXe = Object.entries(DM_BANG).filter(([, c]) => c.nhom === "ts_xe");

  const TABS = [
    ["thiet-bi", "Thiết bị cơ giới", Truck, <TabNho key="tb" khoa="thiet-bi" ds={[
      ["xe", "Danh sách xe", Truck, <TBCho key="xe"><DanhMucXe /></TBCho>],
      ["cau", "Cẩu cảng", Construction, NGUON.cau ? <BangSua nguon={NGUON.cau} icon={Construction} /> : <TBCho />],
      ["tb-gan", "Thiết bị gắn", Wrench, bangPhuO("tb_gan", Wrench)],
      ["cau-ts", "Thông số cẩu cảng", Gauge, bangPhuO("cau_ts", Gauge)],
      ["cau-dm", "Định mức cẩu cảng", ListOrdered, bangPhuO("cau_dm", ListOrdered)],
      ["ts-xe", "Thông số xe", Gauge, canSql08 || <TabNho khoa="ts-xe" ds={tsXe.map(([k, c]) => [k, c.ten, null, <BangSua key={k} nguon={bangPhu(k)} icon={Gauge} />])} />],
      ["nhan-su", "Nhân sự", Users, <TBCho key="ns"><DanhSachNhanSu /></TBCho>],
      ["nha-thau", "Nhà thầu", HardHat, NGUON.nhaThau ? <BangSua nguon={NGUON.nhaThau} icon={HardHat} /> : <TBCho />],
    ]} />],
    ["hang", "Danh mục hàng hóa", Package, tbD ? <TabNho key="hh" khoa="hang" ds={[
      ["roi", "Hàng rời", Layers, <BangSua nguon={nguonHang("roi")} icon={Layers} />],
      ["thanh-pham", "Hàng thành phẩm (kiện)", Boxes, <BangSua nguon={nguonHang("thanh_pham")} icon={Boxes} />],
    ]} /> : <TBCho />],
    ["kho", "Danh mục kho bãi", Warehouse, canCang || <TabNho key="kb" khoa="kho" ds={[
      ["khai-bao", "Khai báo & quy hoạch", MapPinned, canSql08 || <BangSua key="kbqh" nguon={nguonKhaiBao()} icon={MapPinned} />],
      ["thanh-pham", TEN_KHO_KIEN, Boxes, <BangSua nguon={nguonKho("thanh_pham")} icon={Boxes} />],
      ["nguyen-lieu", TEN_KHO_ROI, Warehouse, <BangSua nguon={nguonKho("nguyen_lieu")} icon={Warehouse} />],
    ]} />],
    ["ben", "Danh mục cầu bến", Anchor, canCang || <TabNho key="cb" khoa="ben" ds={[
      ["ds", "Danh sách bến", Anchor, <BangSua nguon={nguonBen("Cầu bến", cotBen, "Mã bến theo file danh mục: TL (bến tàu lai), B01…B11, HH2, HH3, 6CTH, 7CTH; cột Tên khác giữ mã cũ (1A, 1…11) để dán / nhập kiểu cũ vẫn nhận. Mớn ghi ≤ là giới hạn cứng khi kiểm tra tàu – bến.")} icon={Anchor} />],
      ...(D.coSql28 ? [["tuyen", "Bố trí tuyến bến", Route, <BangSua nguon={nguonBen("Bố trí tuyến bến", [["ma", "Bến", "text", 70], ["tuyen", "Tuyến bến", "text", 120], ["met_tu", "Từ mét", "so", 80], ["met_den", "Đến mét", "so", 80], ["goc_vuong", "Đầu góc vuông (dau / cuoi)", "text", 120], ["thu_tu", "Thứ tự trên lịch", "so", 80], ["bang_tai", "Băng tải làm hàng", "text", 140]],
        "Các bến cùng tuyến nối tiếp nhau trên một đoạn cầu cảng thẳng (tàu cập được hai bến liền nhau). Đầu góc vuông ghi dau (phía mét nhỏ) hoặc cuoi. Dùng cho lịch cầu bến theo mét và sơ đồ cầu bến.")} icon={Route} />]] : []),
    ]} />],
  ];
  return (
    <>
      <PageHead title="Danh mục dùng chung" desc="Nhập một lần, dùng cho cả web. Bốn nhóm: thiết bị cơ giới, hàng hóa, kho bãi, cầu bến; mỗi nhóm chia các tab nhỏ." />
      <Tabs value={TABS.some((t) => t[0] === tab) ? tab : "thiet-bi"} onValueChange={doiTab}>
        <ThanhTab value={TABS.some((t) => t[0] === tab) ? tab : "thiet-bi"} onChange={doiTab} label="Danh mục" tabs={TABS.map(([k, t, I]) => [k, t, I])} />
        {TABS.map(([k, , , nd]) => <TabsContent key={k} value={k} className="grid gap-3">{nd}</TabsContent>)}
      </Tabs>
    </>
  );
}

// Bảng một danh mục, cùng giao diện với Danh mục xe: bảng chỉ để xem; Sửa / Xóa từng dòng (sửa trong hộp riêng); Thêm, Import, Xuất Excel
function BangSua({ nguon, icon }) {
  const { D, quyen, api, run, toast, fail } = useApp();
  // Cột tự thêm (SQL 18): định nghĩa ở danh_muc_cot, giá trị trong r.them; trên bảng / hộp sửa / Excel dùng khóa "$mã cột"
  const coThem = !!D.coSql18;
  const cotThem = (D.dmCot || []).filter((c) => c.bang === nguon.bang && !(nguon.anCot || []).includes(plain(c.ten))).sort((a, b) => a.thu_tu - b.thu_tu);
  const cfg = { ...nguon, cot: [...nguon.cot, ...cotThem.map((c) => ["$" + c.ma, c.ten, c.loai, 130])],
    rows: nguon.rows.map((r) => ({ ...r, _them: r.them || {}, ...Object.fromEntries(Object.entries(r.them || {}).map(([k, v]) => ["$" + k, v])) })) };
  const [moCot, setMoCot] = useState(false);
  const [xoaCot, setXoaCot] = useState(null); // cột tự thêm đang hỏi xóa
  const goc = cfg.rows;
  const coSua = cfg.coSua;
  const idKhoa = cfg.khoa === "id";
  const khoaNhap = cfg.batBuoc || cfg.khoa;
  const [q, setQ] = useState("");
  const [nhap, setNhap] = useState(null);
  const [sua, setSua] = useState(null); // "moi" = thêm (hộp thoại)
  const [dangSua, setDangSua] = useState(null); // khóa dòng đang SỬA TẠI DÒNG (bút chì → ô nhập ngay trên dòng; ✓ lưu, ✗ hủy; anh Sỹ 21/11/2026)
  const [fd, setFd] = useState(null); // dữ liệu dòng đang sửa tại dòng
  const [moRong, setMoRong] = useState(null); // khóa dòng đang mở bảng con (cfg.moRong)
  const fileRef = useRef();
  const tenCot = (k) => cfg.cot.find((c) => c[0] === k)?.[1] || k;
  const sach = (r) => {
    const out = idKhoa && r.id != null ? { id: r.id } : {}, them = { ...(r._them || {}) };
    for (const [k, , loai] of cfg.cot) { const v = docO(r[k], loai); if (k[0] === "$") them[k.slice(1)] = v; else out[k] = v; }
    return coThem ? { ...out, them } : out;
  };
  // Dòng nhập Excel: gom các cột tự thêm vào them (giữ giá trị cũ của các cột không có trong file)
  const gom = (o) => {
    const cu = idKhoa ? (o.id != null ? goc.find((g) => g.id === o.id) : null) : goc.find((g) => g[cfg.khoa] === o[cfg.khoa]);
    const out = {}, them = { ...(cu?._them || {}) }; let coT = false;
    for (const [k, v] of Object.entries(o)) if (k[0] === "$") { them[k.slice(1)] = v; coT = true; } else out[k] = v;
    return coThem && coT ? { ...out, them } : out;
  };
  const luuMot = async (f, moi) => {
    const r = sach(f);
    if (!String(r[khoaNhap] ?? "").trim()) return toast(`Chưa nhập ${tenCot(khoaNhap)}`, "bad");
    if (!idKhoa && moi && goc.some((g) => plain(g[cfg.khoa]) === plain(r[cfg.khoa]))) return toast(`"${r[cfg.khoa]}" đã có trong danh mục`, "bad");
    if (await cfg.luu([r])) { setSua(null); setDangSua(null); setFd(null); }
  };
  const xuat = async () => {
    const XLSX = await import("xlsx");
    const aoa = [cfg.cot.map((c) => c[1]), ...goc.map((r) => cfg.cot.map(([k, , loai]) => (loai === "bool" ? (r[k] ? "x" : "") : hienO(r[k], loai))))];
    const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = cfg.cot.map((c) => ({ wch: Math.round(c[3] / 7) }));
    XLSX.utils.book_append_sheet(wb, ws, cfg.ten.replace(/[\\/?*[\]:]/g, " ").slice(0, 30));
    XLSX.writeFile(wb, `Danh_muc_${plain(cfg.ten).replace(/[^a-z0-9]+/g, "_")}.xlsx`);
  };
  // Nhập Excel: tìm dòng tiêu đề khớp tên cột (có / không dấu, bỏ phần trong ngoặc, hoặc tên cột khác); ô khóa trống (ô gộp) thì lấy giá trị dòng trên
  const khopCot = (c) => {
    const p = plain(c), p2 = p.replace(/\(.*?\)/g, "").trim();
    if (!p) return "";
    return cfg.cot.find(([k, t, , , khac = []]) => [p, p2].some((x) => x === plain(t) || x === k || khac.some((y) => plain(y) === x)) || (p.length > 3 && plain(t).startsWith(p)))?.[0] || "";
  };
  const docFile = async (file) => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
      // Chọn sheet có tên gần với danh mục, không có thì sheet đầu
      const ten = wb.SheetNames.find((n) => plain(n).includes(plain(cfg.ten).split(/[ /]/)[0])) || wb.SheetNames[0];
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[ten], { header: 1, raw: true, defval: "" });
      const hi = aoa.findIndex((r) => r.filter((c) => khopCot(c)).length >= Math.min(2, cfg.cot.length));
      if (hi < 0) return toast(`Không thấy dòng tiêu đề. Cần các cột như: ${cfg.cot.map((c) => c[1]).join(", ")}`, "bad");
      const map = aoa[hi].map(khopCot);
      const out = []; let truoc = {}, boQua = 0;
      for (const r of aoa.slice(hi + 1)) {
        if (r.every((c) => c === "" || c == null)) continue;
        const thoi = {};
        map.forEach((k, i) => { if (k) thoi[k] = r[i]; });
        if (khoaNhap in thoi && (thoi[khoaNhap] === "" || thoi[khoaNhap] == null) && truoc[khoaNhap]) thoi[khoaNhap] = truoc[khoaNhap];
        truoc = { ...truoc, ...Object.fromEntries(Object.entries(thoi).filter(([, v]) => v !== "")) };
        let o = Object.fromEntries(Object.entries(thoi).map(([k, v]) => [k, docO(v, cfg.cot.find((c) => c[0] === k)[2])]));
        if (cfg.chuyenNhap) o = cfg.chuyenNhap(o, thoi);
        if (!String(o[khoaNhap] ?? "").trim()) continue;
        if (cfg.khop) { const id = cfg.khop(o, goc); if (id != null) o.id = id; }
        if (cfg.chiSua && o.id == null) { boQua++; continue; } // danh mục chỉ cập nhật dòng đã có
        out.push(o);
      }
      if (boQua) toast(`${boQua} dòng không khớp gian / lô đã quy hoạch nên bị bỏ qua (quy hoạch gian / lô ở tab Khai báo & quy hoạch trước).`, "bad");
      setNhap({ file: `${file.name} · sheet ${ten}`, rows: out, cot: [...new Set(map.filter(Boolean))] });
    } catch (e) { fail(e); }
  };
  const daCo = (r) => (idKhoa ? r.id != null : goc.some((g) => g[cfg.khoa] === r[cfg.khoa]));
  const hien = goc.filter((r) => matchQ(q, ...cfg.cot.map(([k, , l]) => hienO(r[k], l))));
  const o = (r, k, loai) => (loai === "bool" ? (r[k] ? "✓" : "") : loai === "so" ? (["met_tu", "met_den", "loa_max"].includes(k) ? met(r[k]) : so(r[k], 2)) : hienO(r[k], loai));
  const [k0, , l0] = cfg.cot[0];
  // Tick chọn nhiều dòng rồi xóa một lần
  const c = useChonNhieu();
  const khoaDong = (r) => String(idKhoa ? r.id : r[cfg.khoa]);
  const keysHien = hien.map(khoaDong);
  const batSua = (r) => { setSua(null); setDangSua(khoaDong(r)); setFd(khoiTaoForm(cfg, r)); };
  const huySua = () => { setDangSua(null); setFd(null); };
  // Ô nhập của một cột ngay trên dòng đang sửa (cùng quy tắc với hộp Thêm: cột khóa của dòng đã lưu không đổi được)
  const oSua = (k, loai, w) => {
    const khoaCu = (!idKhoa && k === cfg.khoa) || !!cfg.khoaDoc?.includes(k), chon = cfg.chon?.[k], goiY = cfg.goiY?.[k];
    const dat = (v) => setFd((x) => ({ ...x, [k]: v }));
    if (loai === "bool") return <input type="checkbox" style={{ width: 18, height: 18 }} checked={!!fd[k]} onChange={(e) => dat(e.target.checked)} aria-label={tenCot(k)} />;
    if (chon) return <TSelect value={fd[k]} onChange={dat} options={chon} blank={cfg.chonTrong?.[k] ?? "—"} />;
    if (goiY && !khoaCu) return <div style={{ minWidth: Math.min(Math.max(w || 110, 110), 240) }}><ChonGo value={fd[k]} onChange={(v) => dat(v)} options={goiY} placeholder={laChuaPB(cfg, k, loai) ? "*****" : cfg.ph?.[k]} aria-label={tenCot(k)} /></div>;
    return (
      <>
        <input className={"inp" + (loai === "so" ? " num" : "") + (k === khoaNhap ? " mono" : "")} style={{ minWidth: Math.min(Math.max(w || 90, 70), 240) }} value={fd[k]} readOnly={khoaCu} inputMode={loai === "so" ? "decimal" : undefined}
          title={khoaCu ? (cfg.khoaDoc ? "Sửa ở tab Khai báo & quy hoạch" : "Không đổi khóa của dòng đã lưu (xóa rồi thêm mới nếu cần)") : undefined} list={goiY ? tenDlDong(cfg, k) : undefined} aria-label={tenCot(k)}
          placeholder={cfg.ph?.[k] ?? (loai === "mang" ? "Cách nhau dấu ;" : "")} onChange={(e) => dat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") luuMot(fd, false); if (e.key === "Escape") huySua(); }} />
        {goiY && <datalist id={tenDlDong(cfg, k)}>{goiY.map((x) => <option key={x} value={x} />)}</datalist>}
      </>);
  };
  const xoaChon = (ks) => { const ds = new Set(ks); return cfg.xoaNhieu(goc.filter((r) => ds.has(khoaDong(r)))); };

  return (
    <TB>
      <TCard title={`${cfg.ten} (${hien.length === goc.length ? goc.length : `${hien.length}/${goc.length}`})`} icon={icon || Database}
        right={<>
          <Search value={q} onChange={setQ} placeholder="Tìm…" style={{ width: 180 }} />
          <button className="btn sm" onClick={xuat}><Download size={14} />Xuất Excel</button>
          {coSua && <>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) docFile(e.target.files[0]); e.target.value = ""; }} />
            <button className="btn sm" onClick={() => fileRef.current.click()}><Upload size={14} />Import</button>
            {quyen.quanTri && <button className="btn sm" onClick={() => (coThem ? setMoCot(true) : toast("Cần chạy SQL 18 trong Supabase trước khi thêm cột", "bad"))} title="Thêm / đổi tên / xóa cột tự đặt của bảng này"><Columns3 size={14} />Thêm cột</button>}
            {!cfg.chiSua && <button className="btn sm pri" onClick={() => setSua("moi")}><Plus size={14} />{cfg.tenNutThem || "Thêm"}</button>}
          </>}
        </>}>
        {(cfg.mo || cfg.moDau || !coSua) && <div className="small mute mb">{cfg.moDau || cfg.mo}{!coSua && ` Chỉ ${cfg.ai} sửa được danh mục này.`}</div>}
        {coSua && cfg.xoaNhieu && <ThanhChon c={c} keys={keysHien} onXoa={xoaChon} />}
        {hien.length ? (
          <div className="tw">
            <table className="t">
              <thead><tr>{coSua && cfg.xoaNhieu && <OTickTieuDe c={c} keys={keysHien} />}
                {cfg.cot.map(([k, t, loai]) => <th key={k} className={loai === "so" ? "n" : undefined}>{t}
                  {k[0] === "$" && quyen.quanTri && coThem && <button type="button" className="ico-x" onClick={() => setXoaCot(cotThem.find((x) => "$" + x.ma === k))} title={`Xóa cột "${t}"`} aria-label={`Xóa cột ${t}`}
                    style={{ marginLeft: 4, border: 0, background: "none", color: "var(--muted)", cursor: "pointer", padding: 0, verticalAlign: "middle" }}><Trash2 size={12} /></button>}</th>)}
                {(coSua || cfg.nutDong) && <th className="act"></th>}</tr></thead>
              <tbody>{hien.map((r, i) => { const dangR = !!fd && dangSua === khoaDong(r); return (
                <Fragment key={idKhoa ? r.id ?? i : r[cfg.khoa] ?? i}>
                  <tr style={dangR ? { background: "color-mix(in srgb, var(--accent, #6366f1) 10%, transparent)" } : c.chon.has(khoaDong(r)) ? { background: "color-mix(in srgb, var(--bad) 6%, transparent)" } : undefined}>
                    {coSua && cfg.xoaNhieu && <OTick c={c} k={khoaDong(r)} ten={o(r, k0, l0)} />}
                    {cfg.cot.map(([k, , loai, w], j) => (dangR ? <td key={k} className={loai === "so" ? "n" : undefined}>{oSua(k, loai, w)}</td> : j === 0
                      ? <td key={k}>{coSua ? <button className="ma" onClick={() => batSua(r)} title="Sửa tại dòng">{o(r, k, loai)}</button> : <span className="ma" style={{ cursor: "default" }}>{o(r, k, loai)}</span>}</td>
                      : <td key={k} className={loai === "so" ? "n" : undefined} title={loai === "text" && w >= 160 ? r[k] || undefined : undefined}
                          style={loai === "text" && w >= 160 ? { maxWidth: w + 80, overflow: "hidden", textOverflow: "ellipsis" } : undefined}>{laChuaPB(cfg, k, loai) && !String(r[k] ?? "").trim() ? <span style={{ color: "var(--warn)", fontWeight: 600 }} title="Chưa có giá trị">*****</span> : o(r, k, loai)}</td>))}
                    {(coSua || cfg.nutDong) && <td className="act"><div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                      {cfg.nutDong?.(r, { mo: moRong === khoaDong(r), bam: () => setMoRong((x) => (x === khoaDong(r) ? null : khoaDong(r))) })}
                      {coSua && (dangR
                        ? <><button className="btn sm pri" onClick={() => luuMot(fd, false)} title="Lưu dòng (Enter)" aria-label="Lưu dòng"><Check size={13} /></button><button className="btn sm" onClick={huySua} title="Hủy sửa (Esc)" aria-label="Hủy sửa"><X size={13} /></button></>
                        : <button className="btn sm" onClick={() => batSua(r)} title="Sửa tại dòng" aria-label="Sửa"><Pencil size={13} /></button>)}
                      {coSua && cfg.xoa && <TConfirm onConfirm={() => cfg.xoa(r)} title={`Xóa ${o(r, k0, l0)} khỏi danh mục`} confirmText={cfg.gonNut ? "Xóa?" : "Xác nhận"}>{cfg.gonNut ? <Trash2 size={13} /> : "Xóa"}</TConfirm>}
                    </div></td>}
                  </tr>
                  {cfg.moRong && moRong === khoaDong(r) && <tr><td colSpan={cfg.cot.length + 1 + (coSua && cfg.xoaNhieu ? 1 : 0)} style={{ background: "color-mix(in srgb, var(--accent, #6366f1) 4%, transparent)" }}>{cfg.moRong(r)}</td></tr>}
                </Fragment>); })}</tbody>
            </table>
          </div>
        ) : <TEmpty>{goc.length ? "Không có dòng khớp." : `Chưa có dữ liệu.${cfg.chiSua ? " Gian / lô hiện ở đây sau khi quy hoạch ở tab Khai báo & quy hoạch (biểu tượng Quy hoạch trên từng kho / bãi)." : coSua ? " Bấm Import để nạp từ Excel hoặc Thêm để nhập tay." : ""}`}</TEmpty>}
      </TCard>
      {xoaCot && (
        <Modal title={`Xóa cột "${xoaCot.ten}"?`} onClose={() => setXoaCot(null)} width={480}
          footer={<><button className="btn" onClick={() => setXoaCot(null)}>Hủy</button>
            <button className="btn danger" onClick={async () => { if (await run(() => api.saveCot(nguon.bang, cotThem.filter((x) => x.ma !== xoaCot.ma).map((x, i) => ({ ma: x.ma, ten: x.ten, loai: x.loai, thu_tu: i }))), `Đã xóa cột ${xoaCot.ten}`)) setXoaCot(null); }}><Trash2 size={14} />Xóa cột</button></>}>
          <div className="small">Cột "{xoaCot.ten}" biến mất khỏi bảng, hộp sửa, Import / Xuất Excel của {cfg.ten.toLowerCase()}. Số đã ghi ở cột này không dùng lại được (thêm lại cột cùng tên là cột mới, trống).</div>
          <div className="small mute" style={{ marginTop: 8 }}>Các cột có sẵn của danh mục không xóa được vì web dùng để tính toán.</div>
        </Modal>)}
      {moCot && <CotThem bang={nguon.bang} ten={cfg.ten} cotGoc={nguon.cot} cot={cotThem} onClose={() => setMoCot(false)} onLuu={(ds) => run(() => api.saveCot(nguon.bang, ds), "Đã lưu cột")} />}
      {sua === "moi" && <FormDong cfg={cfg} r={null} onClose={() => setSua(null)} onLuu={luuMot} />}
      {nhap && (
        <Modal title={`Import ${cfg.ten.toLowerCase()}`} onClose={() => setNhap(null)} width={900}
          footer={<><button className="btn" onClick={() => setNhap(null)}>Hủy</button><button className="btn pri" disabled={!nhap.rows.length} onClick={async () => { if (await cfg.luu(nhap.rows.map(gom))) setNhap(null); }}><Save size={14} />Lưu {nhap.rows.length} dòng</button></>}>
          <div className="small mute mb">{nhap.file} · {nhap.rows.length} dòng đọc được · {nhap.rows.filter(daCo).length} dòng đã có sẽ cập nhật, còn lại thêm mới. Không xóa dòng nào.</div>
          <div className="tw">
            <table className="t"><thead><tr><th></th>{nhap.cot.map((k) => <th key={k}>{tenCot(k)}</th>)}</tr></thead>
              <tbody>{nhap.rows.map((r, i) => <tr key={i}><td className="mute">{daCo(r) ? "Cập nhật" : "Mới"}</td>{nhap.cot.map((k) => <td key={k}>{String(hienO(r[k], cfg.cot.find((c) => c[0] === k)[2]))}</td>)}</tr>)}</tbody></table>
          </div>
        </Modal>
      )}
    </TB>
  );
}

// Dữ liệu ban đầu của một dòng (hộp Thêm và sửa tại dòng dùng chung)
const khoiTaoForm = (cfg, r) => ({ ...(r?.id != null ? { id: r.id } : {}), _them: r?._them, ...Object.fromEntries(cfg.cot.map(([k, , loai]) => [k, loai === "bool" ? (r ? !!r[k] : !!cfg.macDinh?.[k]) : String(hienO(r ? r[k] : cfg.macDinh?.[k], loai))])) });
const tenDlDong = (cfg, k) => `dl-${plain(cfg.ten).replace(/[^a-z0-9]+/g, "-")}-${k}`;

// Hộp THÊM một dòng danh mục (sửa dòng đã có làm ngay trên dòng)
function FormDong({ cfg, r, onClose, onLuu }) {
  const moi = !r;
  const idKhoa = cfg.khoa === "id";
  const khoaNhap = cfg.batBuoc || cfg.khoa;
  const [f, setF] = useState(() => ({ ...(r?.id != null ? { id: r.id } : {}),
    _them: r?._them, ...Object.fromEntries(cfg.cot.map(([k, , loai]) => [k, loai === "bool" ? (r ? !!r[k] : !!cfg.macDinh?.[k]) : String(hienO(r ? r[k] : cfg.macDinh?.[k], loai))])) }));
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const tenDl = (k) => `dl-${plain(cfg.ten).replace(/[^a-z0-9]+/g, "-")}-${k}`;
  return (
    <Modal title={moi ? `Thêm ${cfg.ten.toLowerCase()}` : `Sửa ${cfg.ten.toLowerCase()} · ${hienO(r[cfg.cot[0][0]], cfg.cot[0][2])}`} onClose={onClose} width={cfg.cot.length > 6 ? 760 : 600}
      footer={<><button className="btn" onClick={onClose}>Hủy</button><button className="btn pri" onClick={() => onLuu(f, moi)}><Save size={14} />Lưu</button></>}>
      {cfg.mo && <div className="small mute mb">{cfg.mo}</div>}
      <div className="form-grid">
        {cfg.cot.map(([k, t, loai, w]) => {
          const khoaCu = !moi && ((!idKhoa && k === cfg.khoa) || !!cfg.khoaDoc?.includes(k));
          const chon = cfg.chon?.[k];
          const goiY = cfg.goiY?.[k];
          return (
            <Field key={k} label={t + (k === khoaNhap ? " *" : "")} className={w >= 200 || k === "ghi_chu" ? "wide" : ""}>
              {loai === "bool" ? <input type="checkbox" style={{ width: 18, height: 18, marginTop: 6 }} checked={!!f[k]} onChange={(e) => set(k, e.target.checked)} />
                : chon ? <TSelect value={f[k]} onChange={(v) => set(k, v)} options={chon} blank={cfg.chonTrong?.[k] ?? "—"} />
                : goiY && !khoaCu ? <ChonGo value={f[k]} onChange={(v) => set(k, v)} options={goiY} placeholder={laChuaPB(cfg, k, loai) ? "*****" : cfg.ph?.[k]} />
                : <>
                  <input className={"inp" + (loai === "so" ? " num" : "") + (k === khoaNhap ? " mono" : "")} value={f[k]} readOnly={khoaCu} inputMode={loai === "so" ? "decimal" : undefined}
                    title={khoaCu ? (cfg.khoaDoc ? "Sửa ở tab Khai báo & quy hoạch" : "Không đổi khóa của dòng đã lưu (xóa rồi thêm mới nếu cần)") : undefined} list={goiY ? tenDl(k) : undefined}
                    placeholder={cfg.ph?.[k] ?? (loai === "mang" ? "Cách nhau dấu ;" : "")} onChange={(e) => set(k, e.target.value)} autoFocus={moi && k === khoaNhap} />
                  {goiY && <datalist id={tenDl(k)}>{goiY.map((x) => <option key={x} value={x} />)}</datalist>}
                </>}
            </Field>);
        })}
      </div>
    </Modal>
  );
}
