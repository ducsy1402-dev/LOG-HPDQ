import { describe, it, expect } from "vitest";
import { tuTinhSucChua, sucChua, heSoLuuChua, locKhoTheoTab, TAB_KHO, TAB_KHO_CU, laHRC, kiemTraTenBai, kiemTraGianLo } from "./kho";

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
  const gan = (bai) => dong.find((d) => d.ten_bai === bai).key;
  const kho = { dong, cap, lo: [{ ten_bai: "Kho nóng HRC1", hang: "Thép cuộn HRC" }, { ten_bai: "Kho thanh", hang: "Thép thanh" }], hangHoa: HH, gan };
  const tab = (id) => TAB_KHO.find((t) => t.id === id);
  it("nhận diện hàng HRC", () => { expect(laHRC("Thép cuộn HRC", HH)).toBe(true); expect(laHRC("Thép thanh", HH)).toBe(false); });
  it("tab Kho hàng kiện: mọi gian / lô quy hoạch hàng kiện (cả HRC và thanh / cuộn, cả gian còn trống)", () => { expect(locKhoTheoTab(kho, tab("hang-kien")).dong.map((d) => d.key)).toEqual(["1", "2", "3"]); });
  it("tab Kho hàng rời: chỉ gian / lô quy hoạch hàng rời", () => { expect(locKhoTheoTab(kho, tab("hang-roi")).dong.map((d) => d.key)).toEqual(["4"]); });
  it("tồn và lô chỉ của tab", () => {
    const k = locKhoTheoTab(kho, tab("hang-roi"));
    expect(k.cap.map((c) => c.hang)).toEqual(["Phế"]);
    expect(k.lo.length).toBe(0);
    expect(locKhoTheoTab(kho, tab("hang-kien")).lo.length).toBe(2);
    expect(k.dongAll.length).toBe(4);
  });
  it("đường dẫn cũ mở đúng tab mới", () => { expect(TAB_KHO_CU.hrc).toBe("hang-kien"); expect(TAB_KHO_CU["nguyen-lieu"]).toBe("hang-roi"); });
});

describe("kiểm tra khai báo / quy hoạch kho bãi", () => {
  const bai = [{ id: 1, ten: "Kho G - CTH" }, { id: 2, ten: "Bãi A" }];
  it("không cho trùng tên kho / bãi (so không dấu, bỏ ký tự đặc biệt)", () => {
    expect(kiemTraTenBai("kho g cth", bai, undefined)).toMatch(/đã được khai báo/);
    expect(kiemTraTenBai("Bãi B", bai, undefined)).toBeNull();
    expect(kiemTraTenBai("Bãi A", bai, 2)).toBeNull(); // sửa chính nó
    expect(kiemTraTenBai("  ", bai)).toMatch(/Chưa nhập/);
  });
  const dong = [{ id: 10, ten_khu: "Gian 1", dien_tich: 600 }, { id: 11, ten_khu: "Gian 2", dien_tich: 300 }];
  it("không cho trùng gian / lô trong cùng kho / bãi", () => {
    expect(kiemTraGianLo({ ten_khu: "gian 1", dien_tich: 10 }, dong, 2000)).toMatch(/không cho trùng/);
    expect(kiemTraGianLo({ id: 10, ten_khu: "Gian 1", dien_tich: 600 }, dong, 2000)).toBeNull();
    expect(kiemTraGianLo({ ten_khu: "", dien_tich: 10 }, dong, 2000)).toMatch(/Chưa nhập/);
  });
  it("không cho vượt diện tích kho / bãi", () => {
    expect(kiemTraGianLo({ ten_khu: "Gian 3", dien_tich: 100 }, dong, 1000)).toBeNull(); // vừa đủ 1000
    expect(kiemTraGianLo({ ten_khu: "Gian 3", dien_tich: 101 }, dong, 1000)).toMatch(/Vượt diện tích/);
    expect(kiemTraGianLo({ id: 10, ten_khu: "Gian 1", dien_tich: 800 }, dong, 1000)).toMatch(/Vượt diện tích/); // sửa: không tính số cũ của chính nó
    expect(kiemTraGianLo({ ten_khu: "Gian 3", dien_tich: 99999 }, dong, null)).toBeNull(); // chưa khai báo diện tích kho / bãi
  });
});
