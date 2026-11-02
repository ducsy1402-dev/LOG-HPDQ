// Kiểm thử kỳ thống kê (ngày, tuần, tháng, quý, năm), khối lượng theo kỳ và kế hoạch kho so thực tế
import { describe, it, expect } from "vitest";
import { khoaKy, khoangKy, tenKy, tenNganKy, congKy, dsKy, thangTrongKy } from "./ky";
import { tinhKy } from "./sanLuong";
import { keHoachKhuTheoKy, thucTeKhuTheoKy, tonCuoiNgayKhu, soSanhKhoTheoKhu } from "./kho";

const t = (mo, d, h = 0) => new Date(2026, mo - 1, d, h).getTime();
const iso = (...a) => new Date(t(...a)).toISOString();

describe("Kỳ thống kê", () => {
  it("khóa và khoảng của từng loại kỳ", () => {
    const x = t(10, 28, 15); // thứ Tư 28/10/2026
    expect([khoaKy("ngay", x), khoaKy("tuan", x), khoaKy("thang", x), khoaKy("quy", x), khoaKy("nam", x)]).toEqual(["2026-10-28", "2026-10-26", "2026-10", "2026-Q4", "2026"]);
    expect(khoangKy("tuan", "2026-10-26")).toEqual({ tu: t(10, 26), den: t(11, 2) });
    expect(khoangKy("quy", "2026-Q4")).toEqual({ tu: t(10, 1), den: t(13, 1) });
    expect(khoangKy("nam", "2026")).toEqual({ tu: t(1, 1), den: new Date(2027, 0, 1).getTime() });
  });
  it("tên kỳ, cộng kỳ, danh sách kỳ", () => {
    expect(tenKy("tuan", "2026-10-26")).toBe("Tuần 44/2026 (26/10 – 01/11)");
    expect(tenKy("quy", "2026-Q4")).toBe("Quý 4/2026");
    expect(tenNganKy("tuan", "2026-10-26")).toBe("T44");
    expect(congKy("quy", "2026-Q1", -1)).toBe("2025-Q4");
    expect(congKy("tuan", "2026-10-26", 1)).toBe("2026-11-02");
    expect(congKy("thang", "2026-01", -1)).toBe("2025-12");
    expect(dsKy("thang", t(10, 28), 2, 1)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
  });
  it("tháng giao với khoảng: tỷ lệ theo số ngày", () => {
    const q = thangTrongKy(t(10, 1), t(13, 1));
    expect(q.map((x) => [x.thang, x.tyLe])).toEqual([["2026-10", 1], ["2026-11", 1], ["2026-12", 1]]);
    const tuan = thangTrongKy(t(10, 26), t(11, 2)); // 6 ngày tháng 10 (26–31), 1 ngày tháng 11
    expect(tuan[0].thang).toBe("2026-10"); expect(tuan[0].tyLe).toBeCloseTo(6 / 31, 6);
    expect(tuan[1].thang).toBe("2026-11"); expect(tuan[1].tyLe).toBeCloseTo(1 / 30, 6);
  });
});

describe("Khối lượng theo tuần / tháng / quý", () => {
  const vs = [
    { id: 1, huong: "nhap", loai_hang: "Than", ten_hang: "Than", khoi_luong: 1000, da_lam: 1000, atb: iso(10, 27) },
    { id: 2, huong: "nhap", loai_hang: "Than", ten_hang: "Than", khoi_luong: 2000, da_lam: 2000, atb: iso(10, 5) },
    { id: 3, huong: "xuat", loai_hang: "HRC", ten_hang: "HRC", khoi_luong: 500, da_lam: 500, atb: iso(11, 15) },
  ];
  const D = { voyages: vs, now: t(11, 20), mucTieu: [{ thang: "2026-10", huong: "nhap", loai_hang: "Than", tan: 3100 }], giaoDich: [] };
  it("tuần chỉ lấy chuyến cập trong tuần; quý cộng cả quý", () => {
    expect(tinhKy(D, "tuan", "2026-10-26").thucHien).toBe(1000);
    expect(tinhKy(D, "thang", "2026-10").thucHien).toBe(3000);
    expect(tinhKy(D, "quy", "2026-Q4").thucHien).toBe(3500);
  });
  it("mục tiêu: quý cộng các tháng, tuần chia theo ngày", () => {
    expect(tinhKy(D, "quy", "2026-Q4").mucTieu.nhap).toBe(3100);
    expect(tinhKy(D, "tuan", "2026-10-26").mucTieu.nhap).toBeCloseTo((3100 * 6) / 31, 6);
    expect(tinhKy(D, "thang", "2026-11").mucTieu).toBe(null);
  });
});

describe("Kho: kế hoạch so thực tế theo bãi nhỏ", () => {
  // Hai bãi nhỏ của Bãi A; kế hoạch tháng 10: bãi nhỏ A1 nhập 3.100 t, xuất 620 t; A2 nhập 1.000 t
  const dong = [
    { key: "k1", ten_bai: "Bãi A", ten: "Khu quặng", ton: 1000, loai: "nguyen_lieu" },
    { key: "k2", ten_bai: "Bãi A", ten: "Khu than", ton: 400, loai: "nguyen_lieu" },
    { key: "sai|x", ten_bai: "Bãi A", ten: "Lạ", ton: 5, saiBai: true },
  ];
  const kh = [
    { thang: "2026-10", khu_key: "k1", ten_bai: "Bãi A", ten_khu: "Khu quặng", huong: "nhap", khoi_luong: 3100 },
    { thang: "2026-10", khu_key: "k1", ten_bai: "Bãi A", ten_khu: "Khu quặng", huong: "xuat", khoi_luong: 620 },
    { thang: "2026-10", khu_key: null, ten_bai: "bãi a", ten_khu: "khu than", huong: "nhap", khoi_luong: 1000 }, // khớp theo tên
    { thang: "2026-10", khu_key: "k9", ten_bai: "Bãi Z", ten_khu: "Mất", huong: "nhap", khoi_luong: 700 }, // không còn bãi nhỏ
    { thang: "2026-11", khu_key: "k1", ten_bai: "Bãi A", ten_khu: "Khu quặng", huong: "nhap", khoi_luong: 3000 },
  ];
  const gan = (bai, hang) => (hang === "Quặng" ? "k1" : hang === "Than" ? "k2" : "sai|" + bai + hang);
  it("kế hoạch: ngày chia theo số ngày của tháng, quý cộng các tháng", () => {
    const ngay = keHoachKhuTheoKy(kh, dong, t(10, 28), t(10, 29));
    expect(ngay.khu.get("k1").nhap).toBeCloseTo(100, 6); // 3.100 ÷ 31
    expect(ngay.khu.get("k1").xuat).toBeCloseTo(20, 6);
    expect(ngay.khu.get("k2").nhap).toBeCloseTo(1000 / 31, 6);
    expect(ngay.mat).toBe(1);
    const thang = keHoachKhuTheoKy(kh, dong, t(10, 1), t(11, 1));
    expect(thang.khu.get("k1")).toEqual({ nhap: 3100, xuat: 620 });
    expect(keHoachKhuTheoKy(kh, dong, t(10, 1), t(1 + 12, 1)).khu.get("k1").nhap).toBeCloseTo(6100, 6); // quý 4 có cả tháng 11
  });
  it("thực tế theo sổ kho từng bãi nhỏ, không tính điều chuyển", () => {
    const gd = [
      { ngay: "2026-10-28", loai: "nhap", ten_bai: "Bãi A", hang: "Quặng", so_luong: 500 },
      { ngay: "2026-10-28", loai: "xuat", ten_bai: "Bãi A", hang: "Quặng", so_luong: 100 },
      { ngay: "2026-10-28", loai: "nhap", ten_bai: "Bãi A", hang: "Than", so_luong: 70 },
      { ngay: "2026-10-28", loai: "dieu_chuyen", ten_bai: "Bãi A", den_bai: "Bãi B", hang: "Quặng", so_luong: 999 },
    ];
    const r = thucTeKhuTheoKy(gd, gan, t(10, 28), t(10, 29));
    expect(r.get("k1")).toEqual({ nhap: 500, xuat: 100 }); expect(r.get("k2")).toEqual({ nhap: 70, xuat: 0 });
  });
  it("tồn cuối ngày đi lùi từ tồn hiện tại; so sánh kế hoạch với thực tế", () => {
    const now = t(10, 30, 9);
    const gd = [
      { ngay: "2026-10-29", loai: "nhap", ten_bai: "Bãi A", hang: "Quặng", so_luong: 300 },
      { ngay: "2026-10-30", loai: "xuat", ten_bai: "Bãi A", hang: "Quặng", so_luong: 100 },
      { ngay: "2026-10-28", loai: "nhap", ten_bai: "Bãi A", hang: "Quặng", so_luong: 500 },
    ];
    expect(tonCuoiNgayKhu(dong[0], gd, gan, t(10, 30), now)).toBe(1000); // hôm nay = tồn hiện tại
    expect(tonCuoiNgayKhu(dong[0], gd, gan, t(10, 29), now)).toBe(1100);
    expect(tonCuoiNgayKhu(dong[0], gd, gan, t(10, 28), now)).toBe(800);
    const kq = soSanhKhoTheoKhu({ dong, keHoach: kh, giaoDich: gd, gan, tu: t(10, 28), den: t(10, 29), now });
    expect(kq.rows.map((x) => x.key)).toEqual(["k1", "k2"]); // bỏ bãi nhỏ sai bãi
    const r = kq.rows[0];
    expect(r.nhapTT).toBe(500); expect(r.tonDau).toBe(300); expect(r.tonTT).toBe(800);
    expect(r.tonKH).toBeCloseTo(300 + 100 - 20, 6);
    expect(kq.dangDienRa).toBe(false); expect(kq.matKH).toBe(1);
  });
  it("kỳ ở tương lai: tồn đầu kỳ = tồn hiện tại cộng kế hoạch từ giờ đến đầu kỳ", () => {
    const now = t(10, 30, 9);
    const r = soSanhKhoTheoKhu({ dong, keHoach: kh, giaoDich: [], gan, tu: t(11, 1), den: t(12, 1), now }).rows[0];
    expect(r.tonDau).toBeGreaterThan(1000); // còn kế hoạch tháng 10 từ 30/10 đến hết tháng
    expect(r.tonKH).toBeCloseTo(r.tonDau + 3000, 6);
  });
});
