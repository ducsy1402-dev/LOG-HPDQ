import { describe, it, expect } from "vitest";
import { ngayCuaThang, khoaDong, tongTheoCot, tuDb, raDb, khoaCua } from "./sanLuongTT";

describe("Sản lượng thực tế theo ca / ngày", () => {
  it("số ngày của tháng, kể cả tháng 2 năm nhuận", () => {
    expect(ngayCuaThang("2026-11")).toHaveLength(30);
    expect(ngayCuaThang("2028-02")).toHaveLength(29);
    expect(ngayCuaThang("2026-12")[30]).toBe("2026-12-31");
  });
  it("khóa dòng bỏ dấu cách / hoa thường như nhau, vận tải tách theo đơn vị", () => {
    expect(khoaDong("nhap", " Quặng ")).toBe(khoaDong("nhap", "quặng"));
    expect(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat")).not.toBe(khoaDong("phuc_vu_cang", "Xe ben", "nha_thau"));
  });
  it("cộng cả tháng theo cột (cảng và vận tải)", () => {
    const cang = [{ ngay: "2026-11-01", ca: "CA 1", huong: "nhap", loai_hang: "Quặng", tan: 100 }, { ngay: "2026-11-01", ca: "CA 2", huong: "nhap", loai_hang: "Quặng", tan: 50.5 }, { ngay: "2026-11-02", ca: "CA 1", huong: "xuat", loai_hang: "HRC", tan: 7 }];
    const m = tongTheoCot("cang", cang);
    expect(m.get(khoaDong("nhap", "Quặng"))).toBe(150.5);
    expect(m.get(khoaDong("xuat", "HRC"))).toBe(7);
    const vt = [{ huong: "phuc_vu_cang", loai_xe: "Xe ben", don_vi: "hoa_phat", tan: 30 }, { huong: "phuc_vu_cang", loai_xe: "Xe ben", don_vi: "nha_thau", tan: 12 }];
    const m2 = tongTheoCot("van_tai", vt);
    expect(m2.get(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat"))).toBe(30);
    expect(m2.get(khoaDong("phuc_vu_cang", "Xe ben", "nha_thau"))).toBe(12);
  });
  it("đổi qua lại dạng CSDL", () => {
    const r = tuDb("van_tai", { huong: "phuc_vu_cang", loai_xe: "Xe ben", don_vi: "nha_thau", tan: 5 });
    expect(r.loai).toBe("Xe ben"); expect(r.donVi).toBe("nha_thau");
    expect(raDb("van_tai", r)).toEqual({ loai_xe: "Xe ben", don_vi: "nha_thau" });
    expect(raDb("cang", { loai: "Than" })).toEqual({ loai_hang: "Than" });
    expect(khoaCua(tuDb("cang", { huong: "nhap", loai_hang: "Than" }))).toBe(khoaDong("nhap", "Than"));
  });
});
