import { describe, it, expect } from "vitest";
import { ngayCuaKy, ngayCuaKeHoach, kyCuaNgay, thuHai, dichKy, nhanKy, thangCuaKy, kyCua, trungNgay } from "./keHoachKy";
import { keHoachKhuTheoKy } from "./kho";

// Kế hoạch kho theo ngày / tuần / tháng / năm (SQL 12, 13/11/2026)
describe("kỳ kế hoạch kho", () => {
  it("số ngày của từng loại kỳ", () => {
    expect(ngayCuaKy("ngay", "2026-11-13")).toEqual(["2026-11-13"]);
    expect(ngayCuaKy("tuan", "2026-11-09").length).toBe(7);
    expect(ngayCuaKy("thang", "2026-02").length).toBe(28);
    expect(ngayCuaKy("thang", "2028-02").length).toBe(29);
    expect(ngayCuaKy("nam", "2026").length).toBe(365);
    expect(ngayCuaKy("nam", "2028").length).toBe(366);
  });
  it("tuần bắt đầu thứ Hai", () => {
    expect(thuHai("2026-11-13")).toBe("2026-11-09"); // thứ Sáu 13/11/2026 → thứ Hai 09/11
    expect(thuHai("2026-11-15")).toBe("2026-11-09"); // Chủ nhật vẫn thuộc tuần đó
    expect(thuHai("2026-11-09")).toBe("2026-11-09");
    expect(ngayCuaKy("tuan", "2026-11-09")[6]).toBe("2026-11-15");
  });
  it("khóa kỳ của một ngày, kỳ trước / sau, nhãn", () => {
    expect(kyCuaNgay("thang", "2026-11-13")).toBe("2026-11");
    expect(kyCuaNgay("nam", "2026-11-13")).toBe("2026");
    expect(dichKy("thang", "2026-12", 1)).toBe("2027-01");
    expect(dichKy("thang", "2026-01", -1)).toBe("2025-12");
    expect(dichKy("tuan", "2026-11-09", 1)).toBe("2026-11-16");
    expect(dichKy("ngay", "2026-11-30", 1)).toBe("2026-12-01");
    expect(nhanKy("tuan", "2026-11-09")).toBe("Tuần 09/11 – 15/11/2026");
    expect(thangCuaKy("nam", "2027")).toBe("2027-01");
    expect(thangCuaKy("tuan", "2026-10-26")).toBe("2026-10");
  });
  it("dòng cũ (chưa có loai_ky) là kế hoạch tháng", () => {
    expect(kyCua({ thang: "2026-11" })).toEqual({ loai: "thang", ky: "2026-11" });
    expect(ngayCuaKeHoach({ thang: "2026-11" }).length).toBe(30);
  });
  it("hai kỳ chồng nhau", () => {
    expect(trungNgay(ngayCuaKy("ngay", "2026-11-13"), ngayCuaKy("thang", "2026-11"))).toBe(true);
    expect(trungNgay(ngayCuaKy("ngay", "2026-12-01"), ngayCuaKy("thang", "2026-11"))).toBe(false);
  });
});

describe("keHoachKhuTheoKy với kế hoạch nhiều loại kỳ", () => {
  const dong = [{ key: "k1", ten_bai: "Kho A", ten: "Gian A", saiBai: false }];
  const t = (s) => new Date(s + "T00:00:00").getTime();
  it("kế hoạch tháng 3000 t: một tuần 7 ngày lấy 7/30", () => {
    const r = keHoachKhuTheoKy([{ khu_key: "k1", huong: "nhap", khoi_luong: 3000, thang: "2026-11" }], dong, t("2026-11-02"), t("2026-11-09"));
    expect(r.khu.get("k1").nhap).toBeCloseTo(700, 5);
  });
  it("kế hoạch ngày chỉ tính khi ngày nằm trong kỳ", () => {
    const kh = [{ khu_key: "k1", huong: "xuat", khoi_luong: 500, thang: "2026-11", loai_ky: "ngay", ky: "2026-11-13" }];
    expect(keHoachKhuTheoKy(kh, dong, t("2026-11-01"), t("2026-12-01")).khu.get("k1").xuat).toBeCloseTo(500, 5);
    expect(keHoachKhuTheoKy(kh, dong, t("2026-11-14"), t("2026-12-01")).khu.get("k1")).toBeUndefined();
  });
  it("kế hoạch năm chia đều 365 ngày; quý 4 (92 ngày) lấy 92/365", () => {
    const kh = [{ khu_key: "k1", huong: "nhap", khoi_luong: 36500, thang: "2026-01", loai_ky: "nam", ky: "2026" }];
    expect(keHoachKhuTheoKy(kh, dong, t("2026-10-01"), t("2027-01-01")).khu.get("k1").nhap).toBeCloseTo(9200, 5);
  });
});
