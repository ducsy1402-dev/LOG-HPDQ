import { describe, it, expect } from "vitest";
import { tuTinhSucChua, sucChua, heSoLuuChua, locKhoTheoTab, TAB_KHO, laHRC } from "./kho";

// Hộp thêm kho: sức chứa để trống thì web tự tính (13/11/2026)
const HH = [{ loai_hang: "Phế", nhom: "Phế", ti_trong: 0.6 }, { loai_hang: "Thép cuộn HRC", nhom: "HRC" }, { loai_hang: "Thép thanh", nhom: "Thép thanh" }];

describe("tuTinhSucChua", () => {
  it("kho thành phẩm: khả dụng trống = danh nghĩa × hệ số lưu chứa", () => {
    const r = tuTinhSucChua([{ ten_bai: "Kho A", suc_chua_dn: 10000, he_so_luu_chua: 0.85 }], "thanh_pham", HH);
    expect(r.rows[0].suc_chua_tay).toBe(8500);
    expect(r.thieuHeSo).toBe(0);
  });
  it("hệ số trống: khả dụng = danh nghĩa và báo thiếu hệ số", () => {
    const r = tuTinhSucChua([{ ten_bai: "Kho A", suc_chua_dn: 10000 }, { ten_bai: "Kho B", suc_chua_dn: 500, he_so_luu_chua: null }], "thanh_pham", HH);
    expect(r.rows.map((x) => x.suc_chua_tay)).toEqual([10000, 500]);
    expect(r.thieuHeSo).toBe(2);
  });
  it("đã nhập khả dụng thì giữ nguyên", () => {
    const r = tuTinhSucChua([{ suc_chua_dn: 10000, he_so_luu_chua: 0.85, suc_chua_tay: 7000 }], "thanh_pham", HH);
    expect(r.rows[0].suc_chua_tay).toBe(7000);
    expect(r.tuTinh).toBe(0);
  });
  it("hệ số nhập kiểu phần trăm (85) cũng được", () => {
    expect(heSoLuuChua(85)).toBe(0.85);
    expect(heSoLuuChua(0.85)).toBe(0.85);
    expect(heSoLuuChua("")).toBeNull();
    expect(tuTinhSucChua([{ suc_chua_dn: 1000, he_so_luu_chua: 90 }], "thanh_pham", HH).rows[0].suc_chua_tay).toBe(900);
  });
  it("kho nguyên liệu: danh nghĩa trống = diện tích × chiều cao đống × tỷ khối, rồi khả dụng = danh nghĩa × hệ số", () => {
    const r = tuTinhSucChua([{ ten_bai: "Bãi A", hang: "Phế", dien_tich: 1000, chieu_cao: 5, he_so_luu_chua: 0.8 }], "nguyen_lieu", HH);
    expect(r.rows[0].suc_chua_dn).toBe(3000); // 1000 × 5 × 0,6
    expect(r.rows[0].suc_chua_tay).toBe(2400);
  });
  it("nguyên liệu thiếu tỷ khối hàng: không tự điền danh nghĩa", () => {
    const r = tuTinhSucChua([{ hang: "Hàng lạ", dien_tich: 1000, chieu_cao: 5 }], "nguyen_lieu", HH);
    expect(r.rows[0].suc_chua_dn).toBeUndefined();
    expect(r.rows[0].suc_chua_tay).toBeUndefined();
  });
  it("CSDL chưa có cột mới: không tự điền danh nghĩa", () => {
    const r = tuTinhSucChua([{ hang: "Phế", dien_tich: 1000, chieu_cao: 5 }], "nguyen_lieu", HH, false);
    expect(r.rows[0].suc_chua_dn).toBeUndefined();
  });
});

describe("sucChua (hiển thị)", () => {
  it("khả dụng trống nhưng có danh nghĩa: tính theo danh nghĩa × hệ số", () => {
    expect(sucChua({ suc_chua_dn: 1000, he_so_luu_chua: 0.9 }, HH).tan).toBe(900);
    expect(sucChua({ suc_chua_dn: 1000 }, HH).tan).toBe(1000);
  });
  it("nhập tay luôn thắng", () => {
    expect(sucChua({ suc_chua_tay: 700, suc_chua_dn: 1000, he_so_luu_chua: 0.9 }, HH).tan).toBe(700);
  });
});

describe("chia kho theo tab (Khai thác kho bãi)", () => {
  const dong = [
    { key: "1", ten_bai: "Kho nóng HRC1", loai: "thanh_pham", hang: "Thép cuộn HRC", chua: [{ hang: "Thép cuộn HRC", ton: 5 }], ton: 5 },
    { key: "2", ten_bai: "Kho thanh", loai: "thanh_pham", hang: "Thép thanh", chua: [{ hang: "Thép thanh", ton: 7 }], ton: 7 },
    { key: "3", ten_bai: "Kho G", loai: "thanh_pham", hang: "", chua: [], ton: 0 },
    { key: "4", ten_bai: "Bãi A", loai: "nguyen_lieu", hang: "Phế", chua: [{ hang: "Phế", ton: 9 }], ton: 9 },
  ];
  const cap = dong.flatMap((d) => d.chua.map((c) => ({ key: d.key, ten_bai: d.ten_bai, hang: c.hang, ton: c.ton, loai: d.loai })));
  const kho = { dong, cap, lo: [{ hang: "Thép cuộn HRC" }, { hang: "Thép thanh" }], hangHoa: HH };
  const tab = (id) => TAB_KHO.find((t) => t.id === id);
  it("nhận diện hàng HRC", () => { expect(laHRC("Thép cuộn HRC", HH)).toBe(true); expect(laHRC("Thép thanh", HH)).toBe(false); });
  it("tab HRC: gian HRC và gian còn trống", () => { expect(locKhoTheoTab(kho, tab("hrc")).dong.map((d) => d.key)).toEqual(["1", "3"]); });
  it("tab Thanh/Cuộn: thành phẩm khác HRC và gian còn trống", () => { expect(locKhoTheoTab(kho, tab("thanh-cuon")).dong.map((d) => d.key)).toEqual(["2", "3"]); });
  it("tab Nguyên liệu: chỉ kho nguyên liệu", () => { expect(locKhoTheoTab(kho, tab("nguyen-lieu")).dong.map((d) => d.key)).toEqual(["4"]); });
  it("tồn và lô chỉ của tab", () => {
    const k = locKhoTheoTab(kho, tab("hrc"));
    expect(k.cap.map((c) => c.hang)).toEqual(["Thép cuộn HRC"]);
    expect(k.lo.length).toBe(1);
    expect(k.dongAll.length).toBe(4);
  });
});
