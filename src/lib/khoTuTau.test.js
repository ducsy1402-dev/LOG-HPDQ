// Kiểm thử ghi kho từ chuyến tàu
import { describe, it, expect } from "vitest";
import { tongHopKho } from "./kho";
import { deXuatKhoTuTau, kiemTraDongKho, phanLoXuat, soLoMoi, khopHang } from "./khoTuTau";

const HH = [{ loai_hang: "Quặng", nhom: "Quặng" }, { loai_hang: "Than", nhom: "Than" }, { loai_hang: "Thép cuộn HRC", nhom: "Thép thành phẩm" }];
const khoBai = [
  { id: 1, ten_bai: "Bãi A", hang: "Quặng", kieu_bai: "co_dinh_hang", dien_tich: 10000, chieu_cao: 5 },
  { id: 2, ten_bai: "Bãi B", hang: "Quặng", kieu_bai: "co_dinh_hang", dien_tich: 10000, chieu_cao: 5 },
  { id: 3, ten_bai: "Bãi C", hang: "Than", kieu_bai: "co_dinh_hang", dien_tich: 10000, chieu_cao: 5 },
  { id: 4, ten_bai: "Kho TP", hang: "Thép cuộn HRC", kieu_bai: "co_dinh_hang", dien_tich: 10000, chieu_cao: 5, loai_kho: "thanh_pham" },
];
const khoTon = [
  { ten_bai: "Kho TP", hang: "Thép cuộn HRC", so_lo: "LO-A", ton: 300, ngay_dau: "2026-10-01" },
  { ten_bai: "Kho TP", hang: "Thép cuộn HRC", so_lo: "LO-B", ton: 500, ngay_dau: "2026-10-05" },
];
const khoLo = [{ so_lo: "LO-A", hang: "Thép cuộn HRC", ngay_nhap: "2026-10-01", trang_thai: "san_sang" }, { so_lo: "LO-B", hang: "Thép cuộn HRC", ngay_nhap: "2026-10-05", trang_thai: "san_sang" }];
const kho = () => ({ ...tongHopKho({ khoBai, khoTon, khoLo, giaoDich: [], hangHoa: HH, now: Date.now() }), hangHoa: HH });

describe("Ghi kho từ chuyến tàu", () => {
  it("tàu nhập: phần chưa ghi chia theo khối lượng khai báo của từng bãi", () => {
    const v = { id: 1, ten_tau: "T1", huong: "nhap", ten_hang: "Quặng sắt", loai_hang: "Quặng", khoi_luong: 1000, da_lam: 600, bai_kl: [{ bai: "Bãi A", khoi_luong: 300 }, { bai: "Bãi B", khoi_luong: 100 }] };
    const r = deXuatKhoTuTau(v, { kho: kho(), giaoDich: [] });
    expect(r.conLai).toBe(600);
    expect(r.rows.map((x) => [x.bai, x.hang, x.tan])).toEqual([["Bãi A", "Quặng", 450], ["Bãi B", "Quặng", 150]]);
    expect(r.rows.every((x) => kiemTraDongKho(x, kho(), "nhap") === null)).toBe(true);
  });
  it("trừ phần đã ghi kho theo chuyến, đủ rồi thì không đề xuất", () => {
    const v = { id: 7, ten_tau: "T2", huong: "nhap", loai_hang: "Quặng", khoi_luong: 1000, da_lam: 600, bai_kl: [{ bai: "Bãi A" }] };
    const gd = [{ voyage_id: 7, loai: "nhap", so_luong: 250 }, { voyage_id: 8, loai: "nhap", so_luong: 999 }, { voyage_id: 7, loai: "xuat", so_luong: 50 }];
    const r = deXuatKhoTuTau(v, { kho: kho(), giaoDich: gd });
    expect(r.daGhi).toBe(250);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].tan).toBe(350);
    const du = deXuatKhoTuTau(v, { kho: kho(), giaoDich: [{ voyage_id: 7, loai: "nhap", so_luong: 600 }] });
    expect(du.rows).toHaveLength(0);
    expect(du.canh[0]).toMatch(/đủ/);
  });
  it("chưa có KL đã làm thì báo, không đề xuất", () => {
    const r = deXuatKhoTuTau({ id: 1, ten_tau: "T", huong: "nhap", khoi_luong: 500, bai_kl: [{ bai: "Bãi A" }] }, { kho: kho() });
    expect(r.rows).toHaveLength(0);
    expect(r.canh[0]).toMatch(/KL đã làm/);
  });
  it("chuyến nhiều dòng hàng chia theo tỉ lệ khối lượng từng dòng; làm tròn không lệch tổng", () => {
    const v = { id: 3, ten_tau: "T3", huong: "nhap", khoi_luong: 1000, da_lam: 1000, hang_ds: [{ ten_hang: "Quặng", khoi_luong: 600 }, { ten_hang: "Than", khoi_luong: 400 }], bai_kl: [{ bai: "Bãi A" }, { bai: "Bãi C" }] };
    const r = deXuatKhoTuTau(v, { kho: kho() });
    expect(r.rows.reduce((s, x) => s + x.tan, 0)).toBeCloseTo(1000, 6);
    expect(r.rows).toHaveLength(4);
  });
  it("bãi chưa khai báo thì để trống cho người chọn; bãi lạ bị báo lỗi", () => {
    const v = { id: 4, ten_tau: "T4", huong: "nhap", loai_hang: "Quặng", khoi_luong: 100, da_lam: 100 };
    const r = deXuatKhoTuTau(v, { kho: kho() });
    expect(r.rows[0].bai).toBe("");
    expect(kiemTraDongKho(r.rows[0], kho(), "nhap")).toMatch(/Chọn bãi/);
    expect(kiemTraDongKho({ bai: "Bãi Lạ", hang: "Quặng", tan: 5 }, kho(), "nhap")).toMatch(/chưa có trong danh mục/);
    expect(kiemTraDongKho({ bai: "Bãi C", hang: "Quặng", tan: 5 }, kho(), "nhap")).toMatch(/chưa có bãi chứa/);
  });
  it("tàu xuất thành phẩm: lấy theo lô cũ trước, thiếu thì báo", () => {
    const k = kho();
    expect(phanLoXuat(k, "Kho TP", "Thép cuộn HRC", 400)).toEqual({ ra: [{ so_lo: "LO-A", tan: 300 }, { so_lo: "LO-B", tan: 100 }], thieu: 0 });
    expect(phanLoXuat(k, "Kho TP", "Thép cuộn HRC", 900).thieu).toBe(100);
    const v = { id: 5, ten_tau: "T5", huong: "xuat", loai_hang: "Thép cuộn HRC", khoi_luong: 1000, da_lam: 900, bai_kl: [{ bai: "Kho TP" }] };
    const r = deXuatKhoTuTau(v, { kho: k });
    expect(r.rows.map((x) => [x.so_lo, x.tan])).toEqual([["LO-A", 300], ["LO-B", 500], ["", 100]]);
    expect(kiemTraDongKho(r.rows[0], k, "xuat")).toBeNull();
    expect(kiemTraDongKho(r.rows[2], k, "xuat")).toMatch(/Chọn lô/);
  });
  it("số lô gợi ý không trùng; khớp tên hàng không dấu", () => {
    const d = new Date(2026, 9, 25, 10).getTime();
    expect(soLoMoi([], d)).toBe("LO-261025-01");
    expect(soLoMoi(["LO-261025-01", "LO-261025-02"], d)).toBe("LO-261025-03");
    expect(khopHang("quang sat uc", ["Quặng sắt Úc", "Than"])).toBe("Quặng sắt Úc");
    expect(khopHang("Quặng", ["Than"])).toBeNull();
  });
});
