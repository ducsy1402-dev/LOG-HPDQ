import { useRef, useState } from "react";
import { Truck, Users, Anchor, Package, Warehouse, HardHat, Ship, Plus, Save, Upload, Download, Pencil, Database, Wrench, Construction, Columns3, Trash2, ArrowUp } from "lucide-react";
import { useApp } from "@/store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHead } from "@/components/common";
import { plain, matchQ, so } from "@/lib/format";
import { TEN_KIEU_BAI, KIEU_BAI } from "@/lib/kho";
import { docSo } from "@/lib/paste";
import { useThietBi, TBCho, TB } from "@/thietbi/Host";
import { Card as TCard, Search, Modal, Field, ConfirmButton as TConfirm, Empty as TEmpty, Select as TSelect } from "@/thietbi/components/ui";
import { useChonNhieu, OTickTieuDe, OTick, ThanhChon } from "@/thietbi/components/chonNhieu";
import DanhMucXe from "@/thietbi/tabs/DanhMucXe";
import { DanhSachNhanSu } from "@/thietbi/tabs/Staffing";
import { DEFAULT_NHA_THAU } from "@/thietbi/lib/plan";

// Danh mục dùng chung cho cả web. Mỗi danh sách cùng giao diện Danh mục xe: Thêm, Import, Xuất Excel; Sửa / Xóa ở từng dòng (sửa trong hộp riêng).
// Cột: [khóa, tên cột, loại (text | so | bool | mang), độ rộng, tên cột khác khi nhập Excel]
// Thêm tùy chọn cho hộp sửa: chon (ô chọn), chonTrong (chữ khi để trống), goiY (gợi ý khi gõ), ph (chữ mờ), macDinh (giá trị khi thêm mới)

// Loại kho ghi chữ trong bảng, lưu mã: thanh_pham / nguyen_lieu (trống = tự theo nhóm hàng)
const TEN_LOAI_KHO = { thanh_pham: "Thành phẩm", nguyen_lieu: "Nguyên liệu" };
const maKieuBai = (x) => { const p = plain(x); return !p ? null : /tu do/.test(p) ? "tu_do" : /nhom/.test(p) ? "co_dinh_nhom" : /co dinh|1 hang|mot hang/.test(p) ? "co_dinh_hang" : null; };
const maLoaiKho = (x) => { const p = plain(x); return !p ? null : /thanh|^tp$/.test(p) ? "thanh_pham" : /nguyen|^nl$/.test(p) ? "nguyen_lieu" : null; };
const hienO = (v, loai) => (loai === "mang" ? (v || []).join("; ") : loai === "bool" ? !!v : v ?? "");
const docO = (s, loai) => {
  if (loai === "mang") return Array.isArray(s) ? s : String(s ?? "").split(/[;,]+/).map((x) => x.trim()).filter(Boolean);
  if (loai === "bool") return s === true || /^(1|x|co|có|true|yes|≤)$/i.test(String(s ?? "").trim());
  if (loai === "so") return s === "" || s == null ? null : typeof s === "number" ? s : docSo(String(s).replace(/<=|≤/, ""));
  return String(s ?? "").trim() || null;
};
// "Bến 1A" -> 1A, "Bến 2-HH" -> HH2, "Bến 6-CTH" -> 6CTH (giống file Danh mục.xlsx)
const maBen = (ten) => {
  const t = String(ten ?? "").replace(/^bến\s*/i, "").trim();
  const hh = /^(\d+)\s*-\s*HH$/i.exec(t);
  return hh ? "HH" + hh[1] : t.replace(/\s*-\s*/g, "").toUpperCase();
};

export default function DanhMuc() {
  const { D, quyen, api, run } = useApp();
  const tb = useThietBi();
  const tbD = tb?.D;
  const [tab, setTab] = useState(() => { try { return localStorage.getItem("lg-danh-muc-tab") || "thiet-bi"; } catch { return "thiet-bi"; } });
  const doiTab = (t) => { setTab(t); try { localStorage.setItem("lg-danh-muc-tab", t); } catch { /* bỏ qua */ } };
  const adminTB = !!tb?.isAdmin;
  // Danh sách lưu nguyên một bản ghi (nhà thầu, thiết bị gắn): gộp các dòng sửa theo khóa rồi lưu cả danh sách
  const gopDs = (ds, rows, khoa) => { const m = new Map(ds.map((x) => [x[khoa], x])); for (const r of rows) m.set(r[khoa], { ...m.get(r[khoa]), ...r }); return [...m.values()]; };

  // Thiết bị gắn: mỗi dòng { ten, dung_cho: "Gắn xe" | "Cẩu cảng", them }; lưu cả danh sách, cột Dùng cho và cột tự thêm
  const tbGanDong = (ten) => ({ ten, dung_cho: tbD.thietBiGanDungOf(ten), them: tbD.meta?.thietBiGanThem?.[ten] });
  const luuTbGan = (ds, thongBao) => tb.run(() => tb.api.saveThietBiGan(ds.map((x) => x.ten),
    Object.fromEntries(ds.filter((x) => x.them && Object.keys(x.them).length).map((x) => [x.ten, x.them])),
    Object.fromEntries(ds.filter((x) => x.dung_cho === "Cẩu cảng").map((x) => [x.ten, "Cẩu cảng"]))), thongBao);

  const NGUON = {
    ben: {
      ten: "Cầu bến", khoa: "ma", rows: D.berths, coSua: quyen.quanTri, ai: "quản trị",
      mo: "Bến 1A (Tàu Lai, TL/BTL) và bến 1 là hai bến riêng. Mớn ghi ≤ trong file là giới hạn cứng khi kiểm tra tàu - bến. Tuyến bến, từ mét – đến mét: các bến cùng tuyến nối tiếp nhau trên một đoạn cầu cảng thẳng (tàu cập được hai bến liền nhau); đầu góc vuông ghi dau (phía mét nhỏ) hoặc cuoi.",
      cot: [["ma", "Mã bến", "text", 70, ["ten ben"]], ["ten_khac", "Tên khác (TL; BTL; B01…)", "mang", 160], ["dwt_max", "Trọng tải tàu (DWT)", "so", 110, ["trong tai tau (dwt)", "dwt"]], ["mon_max", "Mớn tàu (m)", "so", 90, ["mon tau load hang (m)"]], ["mon_cung", "Mớn cứng (≤)", "bool", 70], ["loa_max", "Chiều dài bến (m)", "so", 100, ["chieu dai ben"]], ["loai_hang", "Hàng chính", "text", 230], ...(D.coSql19 ? [["bang_tai", "Băng tải làm hàng", "text", 130, ["bang tai"]]] : []), ["thu_tu", "Thứ tự (trên lịch cầu bến)", "so", 60],
        ...(D.coSql28 ? [["tuyen", "Tuyến bến", "text", 90], ["met_tu", "Từ mét", "so", 70], ["met_den", "Đến mét", "so", 70], ["goc_vuong", "Đầu góc vuông (dau / cuoi)", "text", 100]] : []), ["ghi_chu", "Ghi chú", "text", 160]],
      chuyenNhap: (o, goc) => { const ma = maBen(o.ma); const cung = /<=|≤/.test(String(goc.mon_max ?? "")); return { ...o, ma, ten_khac: o.ten_khac?.length ? o.ten_khac : [String(goc.ma)], ...(cung ? { mon_cung: true } : {}) }; },
      luu: (rows) => run(() => api.upsertRows("berths", rows, "ma"), `Đã lưu ${rows.length} bến`),
      xoa: (r) => run(() => api.deleteRow("berths", "ma", r.ma), `Đã xóa bến ${r.ma}`),
      xoaNhieu: (rs) => run(() => api.deleteRows("berths", "ma", rs.map((r) => r.ma)), `Đã xóa ${rs.length} bến`),
    },
    cau: tbD && {
      ten: "Cẩu / thiết bị làm hàng", khoa: "ma", rows: tbD.vehicles.filter((v) => v.doi === "Cẩu"), coSua: adminTB, ai: "quản trị",
      mo: "Cẩu là xe đội \"Cẩu\" trong danh mục thiết bị (theo dõi hỏng / bảo dưỡng như xe). Cẩu phục vụ nhiều bến: ghi các bến cách nhau dấu ;. Tổ, chế độ sửa ở danh sách phương tiện phía trên.",
      goiY: { model: [...new Set(tbD.vehicles.filter((v) => v.doi === "Cẩu").map((v) => v.model).filter(Boolean))], ben_phuc_vu: D.berths.map((b) => b.ma) },
      cot: [["ma", "Tên cẩu", "text", 130], ["model", "Loại cẩu", "text", 130], ["ben_phuc_vu", "Bến phục vụ (;)", "mang", 110], ["tai_nang", "Tải trọng (tấn)", "text", 110], ["tam_voi", "Tầm với", "text", 100], ["nang_suat", "Năng suất (tấn/h)", "text", 100], ["pham_vi", "Phạm vi di chuyển", "text", 110], ["bang_tai", "Băng tải làm hàng", "text", 120], ["ghi_chu", "Ghi chú", "text", 240]],
      luu: (rows) => tb.run(() => tb.api.upsertVehicles(rows.map((r) => ({ ...r, doi: "Cẩu" }))), `Đã lưu ${rows.length} cẩu`),
      xoa: (r) => tb.run(() => tb.api.deleteVehicle(r.ma), `Đã xóa cẩu ${r.ma}`),
      xoaNhieu: (rs) => tb.run(() => tb.api.deleteVehicles(rs.map((r) => r.ma)), `Đã xóa ${rs.length} cẩu`),
    },
    tbGan: tbD && {
      ten: "Thiết bị gắn", khoa: "ten", rows: tbD.thietBiGanAll.map(tbGanDong), coSua: adminTB, ai: "quản trị", macDinh: { dung_cho: "Gắn xe" },
      mo: "Dùng cho: Gắn xe (gầu, búa, nhóp… chọn ở cột Thiết bị gắn của từng xe xúc đào) hoặc Cẩu cảng (mâm từ, nhóp, ngáng, móc C, gầu ngoạm… chọn ở phiếu chuyến). Hai loại trùng tên thì ghi thêm (cẩu cảng) cho loại của cẩu.",
      cot: [["ten", "Tên thiết bị gắn", "text", 220, ["loai thiet bi", "thiet bi gan"]], ["dung_cho", "Dùng cho", "text", 110, ["dung cho", "gan xe", "loai"]]],
      chon: { dung_cho: ["Gắn xe", "Cẩu cảng"] }, chonTrong: { dung_cho: "Gắn xe" },
      luu: (rows) => luuTbGan(gopDs(tbD.thietBiGanAll.map(tbGanDong), rows.map((r) => ({ ...r, dung_cho: /cau/.test(plain(r.dung_cho)) ? "Cẩu cảng" : "Gắn xe" })), "ten"), "Đã lưu danh mục thiết bị gắn"),
      xoa: (r) => luuTbGan(tbD.thietBiGanAll.filter((x) => x !== r.ten).map(tbGanDong), `Đã xóa ${r.ten}`),
      xoaNhieu: (rs) => { const bo = new Set(rs.map((r) => r.ten)); return luuTbGan(tbD.thietBiGanAll.filter((x) => !bo.has(x)).map(tbGanDong), `Đã xóa ${rs.length} thiết bị gắn`); },
    },
    hang: tbD && {
      ten: "Hàng hóa", khoa: "loai_hang", rows: tbD.hanghoa, coSua: adminTB, ai: "quản trị",
      mo: "Dùng chung: tra tỉ trọng, loại hàng của chuyến tàu, kho bãi.",
      goiY: { nhom: [...new Set(tbD.hanghoa.map((h) => h.nhom).filter(Boolean))] },
      cot: [["loai_hang", "Tên hàng hóa", "text", 230], ["nhom", "Nhóm hàng", "text", 140], ["ti_trong", "Tỉ trọng (t/m³)", "so", 100, ["ti trong"]], ["ghi_chu", "Ghi chú", "text", 260]],
      luu: (rows) => tb.run(() => tb.api.upsertHangHoa(rows), `Đã lưu ${rows.length} loại hàng`),
      xoa: (r) => tb.run(() => tb.api.deleteHangHoa(r.loai_hang), `Đã xóa ${r.loai_hang}`),
      xoaNhieu: (rs) => tb.run(() => tb.api.deleteHangHoas(rs.map((r) => r.loai_hang)), `Đã xóa ${rs.length} loại hàng`),
    },
    kho: {
      ten: "Kho bãi", khoa: "id", batBuoc: "ten_bai", rows: D.coSql15 ? D.khoBai.map((r) => ({ ...r, loai_kho: TEN_LOAI_KHO[r.loai_kho] || "", ...(D.coSql17 ? { kieu_bai: TEN_KIEU_BAI[r.kieu_bai] || "" } : {}) })) : D.khoBai, coSua: quyen.quanTri || adminTB, ai: "quản trị",
      mo: D.coSql17 ? "Mỗi dòng là một bãi nhỏ (khu) trong bãi lớn. Kiểu: Cố định 1 hàng (trống = kiểu này) chỉ nhận đúng hàng của dòng; Cố định nhóm nhận mọi hàng cùng nhóm (ghi Nhóm, trống = nhóm của hàng); Tự do nhận mọi hàng. Sức chứa = diện tích × chiều cao chất đống × tỉ trọng hàng (khu nhiều hàng: tỉ trọng bình quân hàng đang chứa); ghi Sức chứa nhập tay để thay công thức." : D.coSql15 ? "Mỗi dòng là một bãi – một loại hàng chứa (một bãi có thể nhiều dòng). Sức chứa = diện tích × chiều cao chất đống × tỉ trọng hàng; ghi Sức chứa nhập tay để thay công thức. Loại kho để trống thì tự theo nhóm hàng." : "Mỗi dòng là một bãi – một loại hàng chứa (một bãi có thể nhiều dòng).",
      cot: [["ten_bai", D.coSql17 ? "Bãi lớn" : "Tên bãi", "text", 170, ["ten bai", "bai lon"]],
        ...(D.coSql17 ? [["ten_khu", "Bãi nhỏ / khu", "text", 150, ["bai nho", "khu", "ten khu"]], ["kieu_bai", "Kiểu bãi", "text", 120, ["kieu"]], ["nhom_bai", "Nhóm", "text", 100, ["nhom bai"]]] : []),
        ["dien_tich", "Diện tích (m²)", "so", 100, ["dien tich m2", "dien tich"]], ["hang", "Hàng", "text", 220, ["ten hang hoa", "hang hoa"]],
        ...(D.coSql15 ? [["chieu_cao", "Chiều cao chất đống (m)", "so", 100, ["chieu cao"]], ["suc_chua_tay", "Sức chứa nhập tay (t)", "so", 110, ["suc chua"]], ["loai_kho", "Loại kho", "text", 110], ["tieu_thu_ngay", "Tiêu thụ / ngày (t)", "so", 100, ["tieu thu"]]] : []),
        ["thiet_bi", "Thiết bị", "text", 140], ["ghi_chu", "Ghi chú", "text", 200]],
      chon: { kieu_bai: KIEU_BAI.map((x) => x[1]), loai_kho: Object.values(TEN_LOAI_KHO) },
      chonTrong: { kieu_bai: "(trống = cố định 1 hàng)", loai_kho: "Tự theo nhóm hàng" },
      ph: { ten_khu: "Trống = tên hàng", hang: "Khu tự do: để trống được", nhom_bai: "Trống = nhóm của hàng", suc_chua_tay: "Trống = tính theo công thức" },
      goiY: { ten_bai: [...new Set(D.khoBai.map((r) => r.ten_bai).filter(Boolean))], hang: (tbD?.hanghoa || []).map((h) => h.loai_hang), nhom_bai: [...new Set((tbD?.hanghoa || []).map((h) => h.nhom).filter(Boolean))] },
      khop: (o, rows) => rows.find((x) => x.ten_bai === o.ten_bai && (x.hang || "") === (o.hang || "") && (x.ten_khu || "") === (o.ten_khu || ""))?.id,
      luu: (rows) => run(() => api.upsertRows("kho_bai", D.coSql15 ? rows.map((r) => ({ ...r, loai_kho: maLoaiKho(r.loai_kho), ...(D.coSql17 ? { kieu_bai: maKieuBai(r.kieu_bai), ten_khu: String(r.ten_khu || "").trim() || null, nhom_bai: String(r.nhom_bai || "").trim() || null } : {}) })) : rows, "id"), `Đã lưu ${rows.length} dòng kho bãi`),
      xoa: (r) => run(() => api.deleteRow("kho_bai", "id", r.id), `Đã xóa ${r.ten_bai}`),
      xoaNhieu: (rs) => run(() => api.deleteRows("kho_bai", "id", rs.map((r) => r.id)), `Đã xóa ${rs.length} bãi`),
    },
    nhaThau: tbD && (() => {
      const ds = (tbD.nhaThau?.list?.length ? tbD.nhaThau.list : DEFAULT_NHA_THAU).map((x) => ({ dang_dung: true, ...x }));
      return {
        ten: "Nhà thầu", khoa: "ten", rows: ds, coSua: adminTB, ai: "quản trị", macDinh: { dang_dung: true },
        mo: "Đơn vị thực hiện khi gán xe thuê ngoài (Kế hoạch & phân bổ) và phương tiện nhà thầu của chuyến tàu. Bỏ tích Đang dùng để ẩn mà vẫn giữ kế hoạch cũ.",
        cot: [["ten", "Tên nhà thầu", "text", 200], ["lien_he", "Liên hệ (người, SĐT)", "text", 220], ["ghi_chu", "Ghi chú", "text", 220], ["dang_dung", "Đang dùng", "bool", 70]],
        luu: (rows) => tb.run(() => tb.api.saveNhaThau(gopDs(ds, rows, "ten")), "Đã lưu danh mục nhà thầu"),
        xoa: (r) => tb.run(() => tb.api.saveNhaThau(ds.filter((x) => x.ten !== r.ten)), `Đã xóa ${r.ten}`),
        xoaNhieu: (rs) => { const bo = new Set(rs.map((r) => r.ten)); return tb.run(() => tb.api.saveNhaThau(ds.filter((x) => !bo.has(x.ten))), `Đã xóa ${rs.length} nhà thầu`); },
      };
    })(),
    tau: {
      ten: "Tàu", khoa: "ten", rows: D.vessels, coSua: quyen.nhap, ai: "người nhập liệu trở lên",
      mo: "Tự thêm khi lưu chuyến tàu; chọn lại tàu cũ sẽ tự điền DWT, mớn, LOA.",
      cot: [["ten", "Tên tàu", "text", 200, ["ten tau"]], ["dwt", "DWT", "so", 100], ["draft", "Mớn (m)", "so", 80, ["draft", "mon"]], ["loa", "LOA (m)", "so", 80], ["ghi_chu", "Ghi chú", "text", 200]],
      luu: (rows) => run(() => api.upsertRows("vessels", rows.map((r) => ({ ...r, ten: String(r.ten).toUpperCase() })), "ten"), `Đã lưu ${rows.length} tàu`),
      xoa: (r) => run(() => api.deleteRow("vessels", "ten", r.ten), `Đã xóa tàu ${r.ten}`),
      xoaNhieu: (rs) => run(() => api.deleteRows("vessels", "ten", rs.map((r) => r.ten)), `Đã xóa ${rs.length} tàu`),
    },
  };
  for (const [k, v] of Object.entries(NGUON)) if (v) v.bang = k; // mã bảng cho cột tự thêm (danh_muc_cot.bang)
  const canCang = !quyen.coCang && <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Danh mục này thuộc phần Khai thác Cảng: cần chạy SQL 13, 14 và có quyền Cảng.</div>;

  const TABS = [
    ["thiet-bi", "Thiết bị cơ giới", Truck], ["nhan-su", "Nhân sự", Users], ["ben", "Cầu bến", Anchor], ["hang", "Hàng hóa", Package],
    ["kho", "Kho bãi", Warehouse], ["nha-thau", "Nhà thầu", HardHat], ["tau", "Tàu", Ship],
  ];
  return (
    <>
      <PageHead title="Danh mục dùng chung" desc="Nhập một lần, dùng cho cả web: thiết bị cơ giới (xe, cẩu, thiết bị gắn), nhân sự, cầu bến, hàng hóa, kho bãi, nhà thầu và tàu." />
      <Tabs value={tab} onValueChange={doiTab}>
        <TabsList>{TABS.map(([k, t, I]) => <TabsTrigger key={k} value={k}><I />{t}</TabsTrigger>)}</TabsList>
        <TabsContent value="thiet-bi" className="grid gap-3">
          <TBCho><DanhMucXe /></TBCho>
          {NGUON.cau && <BangSua nguon={NGUON.cau} icon={Construction} />}
          {NGUON.tbGan && <BangSua nguon={NGUON.tbGan} icon={Wrench} />}
        </TabsContent>
        <TabsContent value="nhan-su"><TBCho><DanhSachNhanSu /></TBCho></TabsContent>
        <TabsContent value="ben">{canCang || <BangSua nguon={NGUON.ben} icon={Anchor} />}</TabsContent>
        <TabsContent value="hang">{NGUON.hang ? <BangSua nguon={NGUON.hang} icon={Package} /> : <TBCho />}</TabsContent>
        <TabsContent value="kho">{canCang || <BangSua nguon={NGUON.kho} icon={Warehouse} />}</TabsContent>
        <TabsContent value="nha-thau">{NGUON.nhaThau ? <BangSua nguon={NGUON.nhaThau} icon={HardHat} /> : <TBCho />}</TabsContent>
        <TabsContent value="tau" className="grid gap-3">{canCang || <BangSua nguon={NGUON.tau} icon={Ship} />}</TabsContent>
      </Tabs>
    </>
  );
}

// Bảng một danh mục, cùng giao diện với Danh mục xe: bảng chỉ để xem; Sửa / Xóa từng dòng (sửa trong hộp riêng); Thêm, Import, Xuất Excel
function BangSua({ nguon, icon }) {
  const { D, quyen, api, run, toast, fail } = useApp();
  // Cột tự thêm (SQL 18): định nghĩa ở danh_muc_cot, giá trị trong r.them; trên bảng / hộp sửa / Excel dùng khóa "$mã cột"
  const coThem = !!D.coSql18;
  const cotThem = (D.dmCot || []).filter((c) => c.bang === nguon.bang).sort((a, b) => a.thu_tu - b.thu_tu);
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
  const o = (r, k, loai) => (loai === "bool" ? (r[k] ? "✓" : "") : loai === "so" ? so(r[k], 2) : hienO(r[k], loai));
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

// Hộp quản lý cột tự thêm của một danh mục: thêm, đổi tên, đổi loại, đổi thứ tự, xóa.
// Chỉ để ghi thêm thông tin; các phép tính của web chỉ dùng cột có sẵn.
const LOAI_COT = [["text", "Chữ"], ["so", "Số"], ["bool", "Có / không"]];
function CotThem({ ten, cotGoc, cot, onClose, onLuu }) {
  const { toast } = useApp();
  const [ds, setDs] = useState(() => cot.map((c) => ({ ma: c.ma, ten: c.ten, loai: c.loai })));
  const set = (i, k, v) => setDs((o) => o.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  const len = (i) => setDs((o) => { const n = [...o]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; });
  const luu = async () => {
    const sach = ds.map((c) => ({ ...c, ten: c.ten.trim() }));
    if (sach.some((c) => !c.ten)) return toast("Còn cột chưa có tên", "bad");
    const ten = [...cotGoc.map((c) => plain(c[1])), ...sach.map((c) => plain(c.ten))];
    const trung = ten.find((t, i) => ten.indexOf(t) !== i);
    if (trung) return toast(`Trùng tên cột "${sach.find((c) => plain(c.ten) === trung)?.ten}"`, "bad");
    const moc = Date.now().toString(36);
    if (await onLuu(sach.map((c, i) => ({ ma: c.ma || `c${moc}${i}`, ten: c.ten, loai: c.loai, thu_tu: i })))) onClose();
  };
  return (
    <Modal title={`Cột thêm · ${ten}`} onClose={onClose} width={620}
      footer={<><button className="btn" onClick={onClose}>Hủy</button><button className="btn pri" onClick={luu}><Save size={14} />Lưu</button></>}>
      <div className="small mute mb">Cột thêm dùng để ghi thêm thông tin cho từng dòng (hiện trên bảng, hộp sửa, Import / Xuất Excel). Các phép tính của web chỉ dùng cột có sẵn. Xóa cột chỉ ẩn cột; thêm lại cùng tên không lấy lại số cũ.</div>
      <div className="grid" style={{ display: "grid", gap: 8 }}>
        {ds.map((c, i) => (
          <div key={c.ma || "moi" + i} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input className="inp" style={{ flex: 1 }} value={c.ten} placeholder="Tên cột" onChange={(e) => set(i, "ten", e.target.value)} autoFocus={!c.ma && i === ds.length - 1} />
            <TSelect value={c.loai} onChange={(v) => set(i, "loai", v)} options={LOAI_COT} style={{ width: 130 }} />
            <button className="btn sm" disabled={!i} onClick={() => len(i)} title="Đưa lên"><ArrowUp size={13} /></button>
            <button className="btn sm danger" onClick={() => setDs((o) => o.filter((_, j) => j !== i))} title="Xóa cột"><Trash2 size={13} /></button>
          </div>))}
        {!ds.length && <div className="small mute">Chưa có cột thêm.</div>}
        <div><button className="btn sm" onClick={() => setDs((o) => [...o, { ma: "", ten: "", loai: "text" }])}><Plus size={14} />Thêm cột</button></div>
      </div>
    </Modal>
  );
}
