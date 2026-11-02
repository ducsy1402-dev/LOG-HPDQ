// Phương tiện / thiết bị phục vụ chuyến tàu: xe vận chuyển mỗi ca, thiết bị hót vét, thiết bị lên hàng (tàu xuất) / vun hàng (tàu nhập).
// Mỗi dòng: { loai, so, don_vi: "hoa_phat" | "nha_thau" }. Thiết bị Hòa Phát sẽ tính vào nhu cầu của web Thiết bị cơ giới.
export const DON_VI = [["hoa_phat", "Hòa Phát"], ["nha_thau", "Nhà thầu"]];
export const DON_VI_NGAN = { hoa_phat: "HP", nha_thau: "NT" };
// 9 đội của web Thiết bị cơ giới (gợi ý; vẫn gõ được loại khác như "Xúc đào mini")
export const LOAI_MAC_DINH = ["Xe ben", "Xe đầu kéo", "Xúc lật", "Xúc đào", "Xe nâng", "Xe bồn", "Xe cẩu thùng", "Xe gang lỏng", "PT chuyên dụng khác"];

export const NHOM_TB = [
  { k: "xe_van_chuyen", ten: () => "Xe vận chuyển (mỗi ca)", ngan: () => "Xe vận chuyển", dv: "xe/ca" },
  { k: "hot_vet", ten: () => "Thiết bị be hầm / hót vét / hỗ trợ", ngan: () => "Be hầm / hót vét", dv: "chiếc" },
  { k: "vun_hang", ten: (v) => (v?.huong === "xuat" ? "Thiết bị lên hàng" : "Thiết bị vun hàng"), ngan: (v) => (v?.huong === "xuat" ? "Lên hàng" : "Vun hàng"), dv: "chiếc" },
];

export const tenBai = (v) => (v?.huong === "xuat" ? "Bãi lấy hàng" : "Bãi nhận");
export const dsTB = (x) => (Array.isArray(x) ? x.filter((r) => r && r.loai) : []);
// Băng tải làm hàng: ghi cùng phương tiện vận chuyển, kèm tuyến { bang_tai: "#1, #2" } lấy theo danh mục cầu bến; không có đơn vị, không tính là xe
export const laBangTai = (loai) => /^bang tai/.test(String(loai ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim());
// Tên thiết bị gắn của cẩu để hiện / in: bỏ chữ "(cẩu cảng)" thêm vào khi trùng tên với loại gắn xe
export const tenGanCau = (t) => String(t ?? "").replace(/\s*\(cẩu cảng\)\s*$/i, "").trim();
export const dsGanCau = (x) => (Array.isArray(x) ? x.map(tenGanCau).filter(Boolean) : []);
export const dsBangTai = (s) => String(s ?? "").split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
// "Xe ben 8 (HP) · Xe đầu kéo 4 (NT) · Băng tải #1, #2"
export const moTaTB = (x) => dsTB(x).map((r) => (r.bang_tai ? `${r.loai} ${r.bang_tai}` : `${r.loai} ${r.so ?? (r.tu_tinh ? "tự tính" : "?")}${r.don_vi ? ` (${DON_VI_NGAN[r.don_vi] || r.don_vi})` : ""}`)).join(" · ");
export const tongTB = (x, donVi) => dsTB(x).filter((r) => !donVi || r.don_vi === donVi).reduce((s, r) => s + (+r.so || 0), 0);
