import { useRef, useState } from "react";
import { Truck, Users, Anchor, Package, Warehouse, HardHat, Plus, Save, Upload, Download, Pencil, Database, Wrench, Construction, Columns3, Trash2, Gauge, ListOrdered, Boxes, Route, MapPinned, Layers } from "lucide-react";
import { useApp } from "@/store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHead } from "@/components/common";
import { plain, matchQ, so, met } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { useThietBi, TBCho, TB } from "@/thietbi/Host";
import { Card as TCard, Search, Modal, Field, ConfirmButton as TConfirm, Empty as TEmpty, Select as TSelect } from "@/thietbi/components/ui";
import { useChonNhieu, OTickTieuDe, OTick, ThanhChon } from "@/thietbi/components/chonNhieu";
import DanhMucXe from "@/thietbi/tabs/DanhMucXe";
import { DanhSachNhanSu } from "@/thietbi/tabs/Staffing";
import { DEFAULT_NHA_THAU } from "@/thietbi/lib/plan";
import DM_BANG from "@/data/dmBang.json";
import CotThem from "@/components/CotThem";

// Danh mục dùng chung cho cả web. Mỗi danh sách cùng giao diện Danh mục xe: Thêm, Import, Xuất Excel; Sửa / Xóa ở từng dòng (sửa trong hộp riêng).
// Cột: [khóa, tên cột, loại (text | so | bool | mang), độ rộng, tên cột khác khi nhập Excel]
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

export default function DanhMuc() {
  const { D, quyen, api, run } = useApp();
  const tb = useThietBi();
  const tbD = tb?.D;
  const [tab, doiTab] = useTabNho("lg-danh-muc-tab", "thiet-bi");
  const adminTB = !!tb?.isAdmin;
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
      ten: c.ten, khoa: "id", batBuoc: k0, coSua: quyen.quanTri || adminTB, ai: "quản trị", bang: "dm_" + key,
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
    ten, khoa: "ma", rows: D.berths, coSua: quyen.quanTri, ai: "quản trị", mo, cot, bang: "ben",
    chuyenNhap: (o, goc) => { const cung = /<=|≤/.test(String(goc.mon_max ?? "")); return { ...o, ma: String(o.ma).trim().toUpperCase(), ...(cung ? { mon_cung: true } : {}) }; },
    luu: (rows) => run(() => api.upsertRows("berths", rows, "ma"), `Đã lưu ${rows.length} bến`),
    xoa: (r) => run(() => api.deleteRow("berths", "ma", r.ma), `Đã xóa bến ${r.ma}`),
    xoaNhieu: (rs) => run(() => api.deleteRows("berths", "ma", rs.map((r) => r.ma)), `Đã xóa ${rs.length} bến`),
  });

  // Hàng hóa: hàng rời (tỷ khối đống, độ ẩm) và hàng thành phẩm / hàng kiện (đơn trọng)
  const nguonHang = (loai) => {
    const roi = loai === "roi", ds = (tbD?.hanghoa || []).filter((h) => (roi ? h.loai_hh !== "thanh_pham" : h.loai_hh === "thanh_pham"));
    return {
      ten: roi ? "Hàng rời" : "Hàng thành phẩm (hàng kiện)", khoa: "loai_hang", rows: ds, coSua: adminTB, ai: "quản trị", bang: "hang",
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

  // Kho bãi: mỗi dòng một gian / lô (bãi nhỏ) của kho / bãi lớn; tab thành phẩm và tab nguyên liệu
  const nguonKho = (loai) => {
    const tp = loai === "thanh_pham";
    return {
      ten: tp ? "Kho thành phẩm" : "Kho nguyên liệu", khoa: "id", batBuoc: "ten_bai", coSua: quyen.quanTri || adminTB, ai: "quản trị", bang: "kho", anCot: ["khu vuc"],
      rows: (D.khoBai || []).filter((r) => (tp ? r.loai_kho === "thanh_pham" : r.loai_kho !== "thanh_pham")),
      mo: `Mỗi dòng là một gian / lô trong kho / bãi lớn. Sức chứa khả dụng (tấn) là số web dùng; để trống thì tính = diện tích × ${tp ? "chiều cao" : "chiều cao đống"} × tỷ khối hàng. Kho / bãi khai báo "Cố định" thì mỗi gian / lô chỉ nhận đúng hàng của dòng; "Tự do" nhận mọi hàng (sửa ở tab Khai báo kho / bãi).`,
      cot: [["ten_bai", "Tên kho / bãi", "text", 150, ["ten kho/bai", "ten kho bai", "bai lon", "ten bai"]], ["ten_khu", "Gian / lô", "text", 140, ["gian/lo", "gian lo", "bai nho", "khu"]],
        ["dien_tich", "Diện tích phân bổ (m²)", "so", 100, ["dien tich phan bo", "dien tich"]],
        ...(tp ? (khoMoi ? [["so_lop", "Số lớp xếp khả dụng", "so", 90, ["so lop xep kha dung", "so lop"]]] : []) : [["chieu_cao", "Chiều cao đống (m)", "so", 90, ["chieu cao dong", "chieu cao"]]]),
        ["hang", "Hàng đang chứa", "text", 200, ["ten hang", "ten hang (hang dang chua)", "hang hoa"]],
        ...(khoMoi ? [["suc_chua_dn", "Sức chứa danh nghĩa (t)", "so", 110, ["suc chua danh nghia"]], ["he_so_luu_chua", "Hệ số lưu chứa", "so", 80, ["he so luu chua"]]] : []),
        ["suc_chua_tay", "Sức chứa khả dụng (t)", "so", 110, ["suc chua kha dung", "suc chua nhap tay"]],
        ...(tp ? [] : [["tieu_thu_ngay", "Tiêu thụ / ngày (t)", "so", 100, ["tieu thu"]]]),
        ["thiet_bi", "Thiết bị tại kho / bãi", "text", 140, ["thiet bi tai kho/bai", "thiet bi"]], ["ghi_chu", "Ghi chú", "text", 180]],
      ph: { ten_khu: "Trống = tên hàng", suc_chua_tay: "Trống = tính theo công thức" },
      goiY: { ten_bai: [...new Set((D.khoBai || []).map((r) => r.ten_bai).filter(Boolean))], hang: (tbD?.hanghoa || []).map((h) => h.loai_hang) },
      khop: (o, rows) => rows.find((x) => x.ten_bai === o.ten_bai && (x.ten_khu || "") === (o.ten_khu || "") && (x.hang || "") === (o.hang || ""))?.id,
      luu: (rows) => run(() => api.upsertRows("kho_bai", rows.map((r) => ({ ...r, loai_kho: loai, ...(D.coSql17 ? { ten_khu: String(r.ten_khu || "").trim() || null } : {}) })), "id"), `Đã lưu ${rows.length} dòng kho bãi`),
      xoa: (r) => run(() => api.deleteRow("kho_bai", "id", r.id), `Đã xóa ${r.ten_bai}${r.ten_khu ? ` › ${r.ten_khu}` : ""}`),
      xoaNhieu: (rs) => run(() => api.deleteRows("kho_bai", "id", rs.map((r) => r.id)), `Đã xóa ${rs.length} dòng`),
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
      ["khai-bao", "Khai báo kho / bãi", MapPinned, bangPhuO("bai_lon", MapPinned)],
      ["thanh-pham", "Kho thành phẩm", Boxes, <BangSua nguon={nguonKho("thanh_pham")} icon={Boxes} />],
      ["nguyen-lieu", "Kho nguyên liệu", Warehouse, <BangSua nguon={nguonKho("nguyen_lieu")} icon={Warehouse} />],
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
        <TabsList>{TABS.map(([k, t, I]) => <TabsTrigger key={k} value={k}><I />{t}</TabsTrigger>)}</TabsList>
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
  const [sua, setSua] = useState(null); // "moi" = thêm, dòng = sửa
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
    if (await cfg.luu([r])) setSua(null);
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
      const out = []; let truoc = {};
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
        out.push(o);
      }
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
            <button className="btn sm pri" onClick={() => setSua("moi")}><Plus size={14} />Thêm</button>
          </>}
        </>}>
        {(cfg.mo || !coSua) && <div className="small mute mb">{cfg.mo}{!coSua && ` Chỉ ${cfg.ai} sửa được danh mục này.`}</div>}
        {coSua && cfg.xoaNhieu && <ThanhChon c={c} keys={keysHien} onXoa={xoaChon} />}
        {hien.length ? (
          <div className="tw">
            <table className="t">
              <thead><tr>{coSua && cfg.xoaNhieu && <OTickTieuDe c={c} keys={keysHien} />}
                {cfg.cot.map(([k, t, loai]) => <th key={k} className={loai === "so" ? "n" : undefined}>{t}
                  {k[0] === "$" && quyen.quanTri && coThem && <button type="button" className="ico-x" onClick={() => setXoaCot(cotThem.find((x) => "$" + x.ma === k))} title={`Xóa cột "${t}"`} aria-label={`Xóa cột ${t}`}
                    style={{ marginLeft: 4, border: 0, background: "none", color: "var(--muted)", cursor: "pointer", padding: 0, verticalAlign: "middle" }}><Trash2 size={12} /></button>}</th>)}
                {coSua && <th className="act"></th>}</tr></thead>
              <tbody>{hien.map((r, i) => (
                <tr key={idKhoa ? r.id ?? i : r[cfg.khoa] ?? i} style={c.chon.has(khoaDong(r)) ? { background: "color-mix(in srgb, var(--bad) 6%, transparent)" } : undefined}>
                  {coSua && cfg.xoaNhieu && <OTick c={c} k={khoaDong(r)} ten={o(r, k0, l0)} />}
                  {cfg.cot.map(([k, , loai, w], j) => (j === 0
                    ? <td key={k}>{coSua ? <button className="ma" onClick={() => setSua(r)} title="Sửa">{o(r, k, loai)}</button> : <span className="ma" style={{ cursor: "default" }}>{o(r, k, loai)}</span>}</td>
                    : <td key={k} className={loai === "so" ? "n" : undefined} title={loai === "text" && w >= 160 ? r[k] || undefined : undefined}
                        style={loai === "text" && w >= 160 ? { maxWidth: w + 80, overflow: "hidden", textOverflow: "ellipsis" } : undefined}>{o(r, k, loai)}</td>))}
                  {coSua && <td className="act"><div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                    <button className="btn sm" onClick={() => setSua(r)}><Pencil size={13} />Sửa</button>
                    <TConfirm onConfirm={() => cfg.xoa(r)} title={`Xóa ${o(r, k0, l0)} khỏi danh mục`} />
                  </div></td>}
                </tr>))}</tbody>
            </table>
          </div>
        ) : <TEmpty>{goc.length ? "Không có dòng khớp." : `Chưa có dữ liệu.${coSua ? " Bấm Import để nạp từ Excel hoặc Thêm để nhập tay." : ""}`}</TEmpty>}
      </TCard>
      {xoaCot && (
        <Modal title={`Xóa cột "${xoaCot.ten}"?`} onClose={() => setXoaCot(null)} width={480}
          footer={<><button className="btn" onClick={() => setXoaCot(null)}>Hủy</button>
            <button className="btn danger" onClick={async () => { if (await run(() => api.saveCot(nguon.bang, cotThem.filter((x) => x.ma !== xoaCot.ma).map((x, i) => ({ ma: x.ma, ten: x.ten, loai: x.loai, thu_tu: i }))), `Đã xóa cột ${xoaCot.ten}`)) setXoaCot(null); }}><Trash2 size={14} />Xóa cột</button></>}>
          <div className="small">Cột "{xoaCot.ten}" biến mất khỏi bảng, hộp sửa, Import / Xuất Excel của {cfg.ten.toLowerCase()}. Số đã ghi ở cột này không dùng lại được (thêm lại cột cùng tên là cột mới, trống).</div>
          <div className="small mute" style={{ marginTop: 8 }}>Các cột có sẵn của danh mục không xóa được vì web dùng để tính toán.</div>
        </Modal>)}
      {moCot && <CotThem bang={nguon.bang} ten={cfg.ten} cotGoc={nguon.cot} cot={cotThem} onClose={() => setMoCot(false)} onLuu={(ds) => run(() => api.saveCot(nguon.bang, ds), "Đã lưu cột")} />}
      {sua && <FormDong cfg={cfg} r={sua === "moi" ? null : sua} onClose={() => setSua(null)} onLuu={luuMot} />}
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

// Hộp thêm / sửa một dòng danh mục
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
          const khoaCu = !moi && !idKhoa && k === cfg.khoa;
          const chon = cfg.chon?.[k];
          const goiY = cfg.goiY?.[k];
          return (
            <Field key={k} label={t + (k === khoaNhap ? " *" : "")} className={w >= 200 || k === "ghi_chu" ? "wide" : ""}>
              {loai === "bool" ? <input type="checkbox" style={{ width: 18, height: 18, marginTop: 6 }} checked={!!f[k]} onChange={(e) => set(k, e.target.checked)} />
                : chon ? <TSelect value={f[k]} onChange={(v) => set(k, v)} options={chon} blank={cfg.chonTrong?.[k] ?? "—"} />
                : <>
                  <input className={"inp" + (loai === "so" ? " num" : "") + (k === khoaNhap ? " mono" : "")} value={f[k]} readOnly={khoaCu} inputMode={loai === "so" ? "decimal" : undefined}
                    title={khoaCu ? "Không đổi khóa của dòng đã lưu (xóa rồi thêm mới nếu cần)" : undefined} list={goiY ? tenDl(k) : undefined}
                    placeholder={cfg.ph?.[k] ?? (loai === "mang" ? "Cách nhau dấu ;" : "")} onChange={(e) => set(k, e.target.value)} autoFocus={moi && k === khoaNhap} />
                  {goiY && <datalist id={tenDl(k)}>{goiY.map((x) => <option key={x} value={x} />)}</datalist>}
                </>}
            </Field>);
        })}
      </div>
    </Modal>
  );
}
