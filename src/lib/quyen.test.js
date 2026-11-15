import { describe, it, expect } from "vitest";
import { tinhQuyen, emailTuTenDangNhap, tenDangNhap, DS_NHOM } from "./quyen";

// Tài khoản của anh Sỹ (SQL 16): vai trò chung "xem" ở mọi phân hệ + một nhóm
const tk = (...nhom) => tinhQuyen({ cang: "xem", kho: "xem", thietBi: "xem", nhom });
const tatCa = (q) => [q.nhap, q.quanLy, q.quanTri, q.kho.nhap, q.keHoachNgay, q.sl("cang").datMucTieu, q.sl("cang").nhapThucTe, q.sl("van_tai").datMucTieu, q.sl("van_tai").nhapThucTe, q.suaDmThietBi, q.suaDmHang, q.suaDmKho, q.suaDmCauBen, q.suaThietBi];

describe("Tên đăng nhập không đuôi email", () => {
  it("thêm đuôi hpdq.test, giữ nguyên email đầy đủ, bỏ đuôi khi hiển thị", () => {
    expect(emailTuTenDangNhap("QuanTriLog")).toBe("quantrilog@hpdq.test");
    expect(emailTuTenDangNhap("  nhaplieulog ")).toBe("nhaplieulog@hpdq.test");
    expect(emailTuTenDangNhap("a.b@gmail.com")).toBe("a.b@gmail.com");
    expect(emailTuTenDangNhap("")).toBe("");
    expect(tenDangNhap("quantrilog@hpdq.test")).toBe("quantrilog");
    expect(tenDangNhap("a.b@gmail.com")).toBe("a.b@gmail.com");
  });
});

describe("Quyền theo nhóm", () => {
  it("quantrilog: xem tất cả, không sửa ở đâu", () => {
    const q = tk();
    expect(tatCa(q)).toEqual(Array(14).fill(false));
    expect([q.coCang, q.coThietBi, q.kho.co]).toEqual([true, true, true]);
  });
  it("kehoachvantailog: thiết bị cơ giới, danh mục thiết bị + hàng hóa, mục tiêu / thực tế vận tải; không đụng linetime, kho, mục tiêu cảng", () => {
    const q = tk("van_tai");
    expect([q.suaThietBi, q.suaDmThietBi, q.suaDmHang, q.sl("van_tai").datMucTieu, q.sl("van_tai").nhapThucTe]).toEqual([true, true, true, true, true]);
    expect([q.nhap, q.kho.nhap, q.keHoachNgay, q.sl("cang").datMucTieu, q.sl("cang").nhapThucTe, q.suaDmKho, q.suaDmCauBen, q.quanTri]).toEqual(Array(8).fill(false));
  });
  it("kehoachkhobailog: kho bãi + danh mục kho bãi + hàng hóa", () => {
    const q = tk("kho_bai");
    expect([q.kho.nhap, q.kho.quanLy, q.suaDmKho, q.suaDmHang]).toEqual([true, true, true, true]);
    expect([q.nhap, q.suaThietBi, q.suaDmThietBi, q.suaDmCauBen, q.sl("cang").datMucTieu, q.sl("van_tai").nhapThucTe, q.quanTri]).toEqual(Array(7).fill(false));
  });
  it("kehoachxuatnhaplog: mục tiêu sản lượng cảng (mục tiêu, kế hoạch ngày, thực tế) + hàng hóa; không đụng vận tải", () => {
    const q = tk("xuat_nhap");
    expect([q.sl("cang").datMucTieu, q.sl("cang").nhapThucTe, q.keHoachNgay, q.suaDmHang]).toEqual([true, true, true, true]);
    expect([q.sl("van_tai").datMucTieu, q.sl("van_tai").nhapThucTe, q.nhap, q.kho.nhap, q.suaThietBi, q.suaDmKho, q.suaDmCauBen]).toEqual(Array(7).fill(false));
  });
  it("kehoachcaubenlog: linetime, danh mục cầu bến + hàng hóa; không đặt được mục tiêu sản lượng", () => {
    const q = tk("cau_ben");
    expect([q.nhap, q.quanLy, q.suaDmCauBen, q.suaDmHang]).toEqual([true, true, true, true]);
    expect([q.quanTri, q.kho.nhap, q.keHoachNgay, q.sl("cang").datMucTieu, q.sl("cang").nhapThucTe, q.suaThietBi, q.suaDmKho]).toEqual(Array(7).fill(false));
  });
  it("nhaplieulog: chỉ sản lượng thực tế (cảng và vận tải), không đặt mục tiêu", () => {
    const q = tk("nhap_lieu");
    expect([q.sl("cang").nhapThucTe, q.sl("van_tai").nhapThucTe]).toEqual([true, true]);
    expect([q.sl("cang").datMucTieu, q.sl("van_tai").datMucTieu, q.nhap, q.kho.nhap, q.keHoachNgay, q.suaThietBi, q.suaDmHang, q.suaDmKho, q.suaDmCauBen]).toEqual(Array(9).fill(false));
  });
  it("dieudolog: hiện chỉ xem (quyền sửa để sẵn cho trang Điều độ)", () => {
    expect(tatCa(tk("dieu_do"))).toEqual(Array(14).fill(false));
  });
  it("tài khoản cũ giữ nguyên: quản trị mọi quyền, nhập liệu Cảng như trước", () => {
    const qt = tinhQuyen({ cang: "quan_tri", kho: "quan_tri", thietBi: "quan_tri", nhom: [] });
    expect(tatCa(qt)).toEqual(Array(14).fill(true));
    const nl = tinhQuyen({ cang: "nhap", kho: null, thietBi: "nhap" });
    expect([nl.nhap, nl.quanLy, nl.sl("cang").nhapThucTe, nl.sl("cang").datMucTieu, nl.keHoachNgay]).toEqual([true, false, true, false, true]);
  });
  it("có đủ 6 nhóm", () => { expect(DS_NHOM).toEqual(["van_tai", "kho_bai", "xuat_nhap", "cau_ben", "nhap_lieu", "dieu_do"]); });
});
