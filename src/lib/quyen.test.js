import { describe, it, expect } from "vitest";
import { tinhQuyen, emailTuTenDangNhap, tenDangNhap, DS_SUA, DS_XEM, NHOM_SUA, chuanQuyenXem, xemCanCho } from "./quyen";

// Tài khoản thường (SQL 27): vai trò chung "xem" ở mọi phân hệ + danh sách mục xem + danh sách mục chỉnh sửa
const tk = (nhom = [], xem = ["tat_ca"]) => tinhQuyen({ cang: "xem", kho: "xem", thietBi: "xem", xem, nhom });
const tatCa = (q) => [q.nhap, q.quanLy, q.quanTri, q.kho.nhap, q.keHoachNgay, q.sl().datMucTieu, q.sl().nhapThucTe, q.suaDmThietBi, q.suaDmHang, q.suaDmKho, q.suaDmCauBen, q.suaThietBi];

describe("Tên đăng nhập không đuôi email", () => {
  it("thêm đuôi hpdq.test, giữ nguyên email đầy đủ, bỏ đuôi khi hiển thị", () => {
    expect(emailTuTenDangNhap("BgdCty")).toBe("bgdcty@hpdq.test");
    expect(emailTuTenDangNhap("  nhaplieulog ")).toBe("nhaplieulog@hpdq.test");
    expect(emailTuTenDangNhap("a.b@gmail.com")).toBe("a.b@gmail.com");
    expect(emailTuTenDangNhap("")).toBe("");
    expect(tenDangNhap("bgdcty@hpdq.test")).toBe("bgdcty");
    expect(tenDangNhap("a.b@gmail.com")).toBe("a.b@gmail.com");
  });
});

describe("Danh sách mục quyền", () => {
  it("8 mục xem, 13 mục chỉnh sửa chia 4 khu vực", () => {
    expect(DS_XEM).toEqual(["tat_ca", "tong_quan", "khai_bao", "dieu_do", "linetime", "ke_hoach_th", "kho", "danh_muc"]);
    expect(DS_SUA).toHaveLength(13);
    expect(NHOM_SUA.map((g) => g.muc.length)).toEqual([2, 5, 2, 4]);
  });
  it("mỗi mục sửa gắn với một trang xem có thật", () => {
    for (const g of NHOM_SUA) for (const m of g.muc) expect(DS_XEM).toContain(m.xem);
  });
  it("chuẩn hóa quyền xem: Tất cả thì chỉ giữ Tất cả; tick sửa thì tự có quyền xem trang đó", () => {
    expect(chuanQuyenXem(["kho", "tat_ca", "danh_muc"])).toEqual(["tat_ca"]);
    expect(chuanQuyenXem(["kho", "tong_quan", "khong_co"])).toEqual(["tong_quan", "kho"]);
    expect(xemCanCho(["kh_cang", "san_luong", "dm_hang"]).sort()).toEqual(["danh_muc", "ke_hoach_th"]);
  });
});

describe("Quyền xem (ẩn / hiện trang)", () => {
  it("Tất cả: thấy mọi trang; không có mục nào: không thấy trang nào", () => {
    expect(["tong_quan", "kho", "danh_muc"].map(tk().thay)).toEqual([true, true, true]);
    expect(["tong_quan", "kho"].map(tk([], []).thay)).toEqual([false, false]);
  });
  it("chọn từng trang: chỉ thấy trang đã chọn", () => {
    const q = tk([], ["tong_quan", "kho"]);
    expect([q.thay("tong_quan"), q.thay("kho"), q.thay("danh_muc"), q.thay("linetime")]).toEqual([true, true, false, false]);
  });
  it("quản trị thấy mọi trang kể cả khi không có mục xem nào", () => {
    const q = tinhQuyen({ admin: true, cang: "quan_tri", kho: "quan_tri", thietBi: "quan_tri", xem: [], nhom: [] });
    expect(q.thay("danh_muc")).toBe(true);
  });
  it("chưa chạy SQL 27 (không có danh sách xem): xem tất cả", () => {
    expect(tinhQuyen({ cang: "xem", kho: "xem", thietBi: "xem", nhom: [] }).thay("kho")).toBe(true);
  });
});

describe("Quyền chỉnh sửa", () => {
  it("không tick gì: chỉ xem, không sửa ở đâu", () => {
    const q = tk();
    expect(tatCa(q)).toEqual(Array(12).fill(false));
    expect([q.coCang, q.coThietBi, q.kho.co]).toEqual([true, true, true]);
  });
  it("Linetime: sửa chuyến tàu, không đụng kế hoạch tổng hợp / kho", () => {
    const q = tk(["linetime"]);
    expect([q.nhap, q.quanLy]).toEqual([true, true]);
    expect([q.quanTri, q.kho.nhap, q.keHoachNgay, q.sl().datMucTieu, q.sl().nhapThucTe, q.suaThietBi, q.suaDmCauBen]).toEqual(Array(7).fill(false));
  });
  it("từng nút Kế hoạch tổng hợp độc lập nhau", () => {
    expect([tk(["kh_dai_han"]).sl().datMucTieu, tk(["kh_dai_han"]).keHoachNgay, tk(["kh_dai_han"]).sl().nhapThucTe]).toEqual([true, false, false]);
    expect([tk(["kh_cang"]).keHoachNgay, tk(["kh_cang"]).sl().datMucTieu]).toEqual([true, false]);
    expect([tk(["san_luong"]).sl().nhapThucTe, tk(["san_luong"]).sl().datMucTieu, tk(["san_luong"]).keHoachNgay]).toEqual([true, false, false]);
    expect([tk(["kh_van_tai"]).suaThietBi, tk(["kh_van_tai"]).sl().datMucTieu]).toEqual([true, false]);
  });
  it("kho: mỗi tab kho một quyền riêng", () => {
    const k = tk(["kho_hang_kien"]).kho;
    expect([k.nhap, k.theoLoai("thanh_pham"), k.theoLoai("nguyen_lieu")]).toEqual([true, true, false]);
    const r = tk(["kho_hang_roi"]).kho;
    expect([r.nhap, r.theoLoai("thanh_pham"), r.theoLoai("nguyen_lieu")]).toEqual([true, false, true]);
  });
  it("từng tab Danh mục độc lập nhau", () => {
    const q = tk(["dm_hang"]);
    expect([q.suaDmHang, q.suaDmThietBi, q.suaDmKho, q.suaDmCauBen]).toEqual([true, false, false, false]);
    expect([tk(["dm_cau_ben"]).suaDmCauBen, tk(["dm_kho"]).suaDmKho, tk(["dm_thiet_bi"]).suaDmThietBi]).toEqual([true, true, true]);
  });
  it("Khai báo: sửa phần thiết bị cơ giới, không sửa Điều độ riêng", () => {
    expect(tk(["khai_bao"]).suaThietBi).toBe(true);
    expect(tk(["khai_bao"]).co("dieu_do")).toBe(false);
  });
  it("mục lạ (không có trong danh sách) bị bỏ qua", () => {
    expect(tatCa(tk(["van_tai", "kho_bai", "khong_co"]))).toEqual(Array(12).fill(false));
  });
  it("quản trị: mọi quyền", () => {
    const qt = tinhQuyen({ admin: true, cang: "quan_tri", kho: "quan_tri", thietBi: "quan_tri", xem: [], nhom: [] });
    expect(tatCa(qt)).toEqual(Array(12).fill(true));
    expect(qt.kho.theoLoai("thanh_pham") && qt.kho.theoLoai("nguyen_lieu")).toBe(true);
  });
});
