import { describe, it, expect } from "vitest";
import { ngayCuaThang, khoaDong, tongTheoCot, tuDb, raDb, khoaCua, khopDoiXe } from "./sanLuongTT";

describe("Sản lượng thực tế theo ca / ngày", () => {
  it("số ngày của tháng, kể cả tháng 2 năm nhuận", () => {
    expect(ngayCuaThang("2026-11")).toHaveLength(30);
    expect(ngayCuaThang("2028-02")).toHaveLength(29);
    expect(ngayCuaThang("2026-12")[30]).toBe("2026-12-31");
  });
  it("khóa dòng bỏ dấu cách / hoa thường như nhau, vận tải tách theo đơn vị và loại hàng", () => {
    expect(khoaDong("nhap", " Quặng ")).toBe(khoaDong("nhap", "quặng"));
    expect(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat")).not.toBe(khoaDong("phuc_vu_cang", "Xe ben", "nha_thau"));
    expect(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat", "Quặng")).not.toBe(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat", "Than"));
    expect(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat", "")).toBe(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat"));
  });
  it("cộng cả tháng theo cột (cảng và vận tải, có loại hàng)", () => {
    const cang = [{ ngay: "2026-11-01", ca: "CA 1", huong: "nhap", loai_hang: "Quặng", tan: 100 }, { ngay: "2026-11-01", ca: "CA 2", huong: "nhap", loai_hang: "Quặng", tan: 50.5 }, { ngay: "2026-11-02", ca: "CA 1", huong: "xuat", loai_hang: "HRC", tan: 7 }];
    const m = tongTheoCot("cang", cang);
    expect(m.get(khoaDong("nhap", "Quặng"))).toBe(150.5);
    expect(m.get(khoaDong("xuat", "HRC"))).toBe(7);
    const vt = [
      { huong: "phuc_vu_cang", loai_xe: "Xe ben", don_vi: "hoa_phat", loai_hang: "Quặng", tan: 30 },
      { huong: "phuc_vu_cang", loai_xe: "Xe ben", don_vi: "hoa_phat", loai_hang: "Than", tan: 8 },
      { huong: "phuc_vu_cang", loai_xe: "Xe ben", don_vi: "nha_thau", loai_hang: "", tan: 12 },
    ];
    const m2 = tongTheoCot("van_tai", vt);
    expect(m2.get(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat", "Quặng"))).toBe(30);
    expect(m2.get(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat", "Than"))).toBe(8);
    expect(m2.get(khoaDong("phuc_vu_cang", "Xe ben", "nha_thau"))).toBe(12);
  });
  it("đổi qua lại dạng CSDL", () => {
    const r = tuDb("van_tai", { huong: "phuc_vu_cang", loai_xe: "Xe ben", don_vi: "nha_thau", loai_hang: "Đá", tan: 5 });
    expect(r.loai).toBe("Xe ben"); expect(r.donVi).toBe("nha_thau"); expect(r.hang).toBe("Đá");
    expect(raDb("van_tai", r)).toEqual({ loai_xe: "Xe ben", don_vi: "nha_thau", loai_hang: "Đá" });
    expect(raDb("cang", { loai: "Than" })).toEqual({ loai_hang: "Than" });
    expect(khoaCua(tuDb("cang", { huong: "nhap", loai_hang: "Than" }))).toBe(khoaDong("nhap", "Than"));
  });
  it("bộ lọc đội xe", () => {
    const r = tuDb("van_tai", { huong: "phuc_vu_cang", loai_xe: "Xe đầu kéo", don_vi: "hoa_phat", tan: 1 });
    expect(khopDoiXe(r, "")).toBe(true);
    expect(khopDoiXe(r, "xe đầu kéo")).toBe(true);
    expect(khopDoiXe(r, "Xe ben")).toBe(false);
  });
});

// ---------- Mục tiêu riêng của quý / năm (SQL 10) ----------
import { chuoiKy, tongTheoNhom, khoangKy as khoangKyTQ } from "./bieuDoSanLuong";
describe("Mục tiêu quý / năm", () => {
  const thang = (m, huong, loai, tan) => ({ thang: `2026-${m}`, huong, loai_hang: loai, tan });
  const du = {
    mucTieu: [thang("10", "nhap", "Than", 3100), thang("11", "nhap", "Than", 3000), thang("12", "nhap", "Than", 3100), thang("11", "xuat", "HRC", 900)],
    thucTe: [],
    mucTieuKy: [{ thang: "2026-Q4", huong: "nhap", loai_hang: "Than", tan: 12000 }],
  };
  const ky = khoangKyTQ("quy", "2026-11-09");
  it("dòng có mục tiêu riêng của quý dùng số của quý, không cộng các tháng; dòng khác vẫn cộng tháng", () => {
    const m = tongTheoNhom(ky, du, "cang", (x) => `${x.huong}|${x.loai}`);
    expect(m.get("nhap|Than").mt).toBe(12000);
    expect(Math.round(m.get("xuat|HRC").mt)).toBe(900);
    const c = chuoiKy(ky, du, "cang");
    expect(Math.round(c.tongMt)).toBe(12900);
  });
  it("chưa nhập mục tiêu quý thì cộng các tháng như trước", () => {
    const m = tongTheoNhom(ky, { ...du, mucTieuKy: [] }, "cang", (x) => `${x.huong}|${x.loai}`);
    expect(Math.round(m.get("nhap|Than").mt)).toBe(9200);
  });
});
