import { describe, it, expect } from "vitest";
import { chiaDeuTheoGio, ngayCuaChuyen, keHoachTheoNgay, tongNgay, thucTeNgay, chuoiKeHoach, luyKe, demTau, loaiThe } from "./keHoachNgay";
import { taoNhomHang } from "./sanLuong";

// Kế hoạch sản lượng theo ngày, theo line tàu (SQL 13, 13/11/2026)
const HH = [{ loai_hang: "Thép cuộn HRC", nhom: "HRC" }, { loai_hang: "Thép thanh", nhom: "Thép thanh" }, { loai_hang: "Quặng cỡ A", nhom: "Quặng" }, { loai_hang: "Than PCI", nhom: "Than" }];
const nhomHang = taoNhomHang(HH);
const T = (s) => new Date(s).toISOString();
const tau = (o) => ({ id: 1, huong: "nhap", ten_tau: "T", khoi_luong: 30000, kl_tra: 0, ...o });

describe("chia kế hoạch theo giờ làm hàng", () => {
  it("tổng các ngày bằng khối lượng tàu, chia theo giờ", () => {
    // làm hàng từ 12:00 ngày 10 đến 12:00 ngày 12 (48 giờ): ngày 10 và 12 mỗi ngày 1/4, ngày 11 một nửa
    const v = tau({ bd_lam_hang: T("2026-11-10T12:00:00"), kt_lam_hang: T("2026-11-12T12:00:00"), atb: T("2026-11-10T08:00:00") });
    const m = chiaDeuTheoGio(v);
    expect([...m.keys()]).toEqual(["2026-11-10", "2026-11-11", "2026-11-12"]);
    expect(m.get("2026-11-11")).toBe(15000);
    expect([...m.values()].reduce((s, x) => s + x, 0)).toBe(30000);
  });
  it("phần dư làm tròn dồn vào ngày nhiều nhất, tổng vẫn đúng", () => {
    const v = tau({ khoi_luong: 1000, bd_lam_hang: T("2026-11-10T00:00:00"), kt_lam_hang: T("2026-11-13T00:00:00"), atb: T("2026-11-09T20:00:00") });
    const m = chiaDeuTheoGio(v);
    expect([...m.values()].reduce((s, x) => s + x, 0)).toBe(1000);
  });
  it("chưa có mốc nào: không chia", () => { expect(chiaDeuTheoGio(tau({})).size).toBe(0); });
  it("các ngày tàu ở bến", () => {
    const v = tau({ atb: T("2026-11-10T08:00:00"), atd: T("2026-11-12T09:00:00"), bd_lam_hang: T("2026-11-10T10:00:00"), kt_lam_hang: T("2026-11-12T06:00:00") });
    expect(ngayCuaChuyen(v)).toEqual(["2026-11-10", "2026-11-11", "2026-11-12"]);
  });
});

describe("gộp kế hoạch ngày, so với thực tế", () => {
  const v1 = tau({ id: 1, huong: "xuat", ten_hang: "Thép cuộn HRC", loai_hang: "HRC" });
  const v2 = tau({ id: 2, huong: "nhap", ten_hang: "Quặng cỡ A", loai_hang: "Quặng" });
  const vmap = new Map([[1, v1], [2, v2]]);
  const rows = [{ voyage_id: 1, ngay: "2026-11-10", khoi_luong: 1000 }, { voyage_id: 1, ngay: "2026-11-11", khoi_luong: 2000 }, { voyage_id: 2, ngay: "2026-11-10", khoi_luong: 500 }, { voyage_id: 9, ngay: "2026-11-10", khoi_luong: 99 }];
  const ngays = ["2026-11-10", "2026-11-11", "2026-11-12"];
  it("theo hướng và nhóm hàng của chuyến; chuyến không còn bị bỏ qua", () => {
    const m = keHoachTheoNgay(rows, vmap, nhomHang);
    expect(tongNgay(m, ngays, "xuat")).toEqual([1000, 2000, 0]);
    expect(tongNgay(m, ngays, "nhap")).toEqual([500, 0, 0]);
    expect(tongNgay(m, ngays, "xuat", "HRC")).toEqual([1000, 2000, 0]);
    expect(tongNgay(m, ngays, "xuat", "Than")).toEqual([0, 0, 0]);
  });
  it("chuyến nhiều dòng hàng chia theo tỉ lệ khối lượng", () => {
    const v = tau({ id: 3, huong: "nhap", khoi_luong: 30000, hang_ds: [{ ten_hang: "Quặng cỡ A", khoi_luong: 20000 }, { ten_hang: "Than PCI", khoi_luong: 10000 }] });
    const m = keHoachTheoNgay([{ voyage_id: 3, ngay: "2026-11-10", khoi_luong: 3000 }], new Map([[3, v]]), nhomHang);
    expect(tongNgay(m, ngays, "nhap", "Quặng")[0]).toBeCloseTo(2000, 5);
    expect(tongNgay(m, ngays, "nhap", "Than")[0]).toBeCloseTo(1000, 5);
  });
  it("thực tế theo ngày", () => {
    const tt = [{ ngay: "2026-11-10", huong: "xuat", loai_hang: "HRC", tan: 700 }, { ngay: "2026-11-10", huong: "xuat", loai_hang: "Slab", tan: 100 }, { ngay: "2026-11-11", huong: "nhap", loai_hang: "Quặng", tan: 50 }];
    expect(thucTeNgay(tt, ngays, "xuat")).toEqual([800, 0, 0]);
    expect(thucTeNgay(tt, ngays, "xuat", "HRC")).toEqual([700, 0, 0]);
  });
  it("kế hoạch biểu đồ: có kế hoạch ngày thì dùng, không thì mục tiêu tháng chia đều", () => {
    const m = keHoachTheoNgay(rows, vmap, nhomHang);
    expect(chuoiKeHoach(m, ngays, "xuat", 9000)).toEqual({ kh: [1000, 2000, 0], nguon: "ngay" });
    expect(chuoiKeHoach(new Map(), ngays, "xuat", 9000)).toEqual({ kh: [3000, 3000, 3000], nguon: "muc_tieu" });
    expect(chuoiKeHoach(new Map(), ngays, "xuat", 0).nguon).toBe("khong");
  });
  it("lũy kế, thực tế chỉ đến ngày giới hạn", () => {
    expect(luyKe([1, 2, 3])).toEqual([1, 3, 6]);
    expect(luyKe([1, 2, 3], 2)).toEqual([1, 3, null]);
  });
});

describe("ba thẻ tàu", () => {
  const now = new Date("2026-11-13T10:00:00").getTime(), h = (n) => new Date(now + n * 36e5).toISOString();
  const ds = [
    tau({ id: 1, huong: "xuat", ten_hang: "Thép cuộn HRC", atb: h(-5), bd_lam_hang: h(-3) }),                  // HRC đang làm
    tau({ id: 2, huong: "xuat", ten_hang: "Thép cuộn HRC", etb: h(10), eta: h(8) }),                          // HRC chờ trong 24h
    tau({ id: 3, huong: "xuat", ten_hang: "Thép cuộn HRC", etb: h(60), eta: h(58) }),                         // HRC còn xa (không tính)
    tau({ id: 4, huong: "xuat", ten_hang: "Thép thanh", atb: h(-5), bd_lam_hang: h(-3) }),                    // thép thành phẩm đang làm
    tau({ id: 5, huong: "nhap", ten_hang: "Quặng cỡ A", atb: h(-2), bd_lam_hang: h(-1) }),                    // nhập đang làm
    tau({ id: 6, huong: "nhap", ten_hang: "Than PCI", etb: h(20), eta: h(18) }),                              // nhập chờ
    tau({ id: 7, huong: "nhap", ten_hang: "Quặng cỡ A", etb: h(-90), atb: h(-90), bd_lam_hang: h(-88), kt_lam_hang: h(-60), atd: h(-50) }), // đã rời
    tau({ id: 8, huong: "xuat", ten_hang: "Hàng lạ" }),                                          // xuất khác: không vào thẻ nào
  ];
  it("phân loại chuyến", () => {
    expect(loaiThe(ds[0], HH)).toBe("hrc"); expect(loaiThe(ds[3], HH)).toBe("tp"); expect(loaiThe(ds[4], HH)).toBe("nhap"); expect(loaiThe(ds[7], HH)).toBeNull();
  });
  it("đếm đang làm hàng và chờ trong 24 giờ tới", () => {
    const r = demTau(ds, now, HH);
    expect(r.hrc.lam.map((v) => v.id)).toEqual([1]);
    expect(r.hrc.cho.map((v) => v.id)).toEqual([2]);
    expect(r.tp.lam.map((v) => v.id)).toEqual([4]);
    expect(r.tp.cho.length).toBe(0);
    expect(r.nhap.lam.map((v) => v.id)).toEqual([5]);
    expect(r.nhap.cho.map((v) => v.id)).toEqual([6]);
  });
});
