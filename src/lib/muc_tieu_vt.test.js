import { describe, it, expect } from "vitest";
import { nhomDongVT, khoaDong } from "./sanLuongTT";

describe("nhomDongVT (mục tiêu vận tải theo dòng Hòa Phát / Thuê ngoài)", () => {
  const r = (huong, loai, donVi, hang, tan) => [khoaDong(huong, loai, donVi, hang), { huong, loai, donVi, hang, tan }];
  it("gộp hai đơn vị của cùng (hàng, hướng, loại xe) vào một dòng", () => {
    const dong = Object.fromEntries([r("phuc_vu_cang", "Xe ben", "hoa_phat", "HRC", "10"), r("phuc_vu_cang", "Xe ben", "nha_thau", "HRC", "20"), r("phuc_vu_cang", "Đầu kéo", "nha_thau", "HRC", "5")]);
    const ds = nhomDongVT(dong, ["phuc_vu_cang", "phuc_vu_san_xuat"]);
    expect(ds.length).toBe(2);
    const ben = ds.find((x) => x.loai === "Xe ben");
    expect(ben.hp).toBe(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat", "HRC"));
    expect(ben.tn).toBe(khoaDong("phuc_vu_cang", "Xe ben", "nha_thau", "HRC"));
    expect(ds.find((x) => x.loai === "Đầu kéo").hp).toBeNull();
  });
  it("sắp theo hướng rồi loại hàng; dòng thuê ngoài cũ theo nhà thầu không bị mất", () => {
    const dong = Object.fromEntries([r("phuc_vu_san_xuat", "Xe ben", "hoa_phat", "Đá", "1"), r("phuc_vu_cang", "Xe ben", "nt:ABC", "Quặng", "2"), r("phuc_vu_cang", "Xe ben", "nha_thau", "Quặng", "3")]);
    const ds = nhomDongVT(dong, ["phuc_vu_cang", "phuc_vu_san_xuat"]);
    expect(ds.map((x) => x.huong)).toEqual(["phuc_vu_cang", "phuc_vu_san_xuat"]);
    const q = ds[0];
    expect(q.tn).toBe(khoaDong("phuc_vu_cang", "Xe ben", "nha_thau", "Quặng"));
    expect(q.khac).toEqual([khoaDong("phuc_vu_cang", "Xe ben", "nt:ABC", "Quặng")]);
  });
});

import { docNghiepVu, khoaCot, khoaCua, NGHIEP_VU } from "./sanLuongTT";
import { docBangMucTieuVT, gopDongDonVi, thanhDongDonVi } from "./mucTieuVT";
describe("nghiệp vụ của kế hoạch vận tải", () => {
  it("6 nghiệp vụ; đọc không phân biệt dấu / hoa thường; trống = trống; lạ = null", () => {
    expect(NGHIEP_VU).toEqual(["Nhập tàu", "Xuất tàu", "Trung chuyển", "Thu hồi", "Cấp sản xuất", "Chuyển bãi"]);
    expect(docNghiepVu("chuyen bai")).toBe("Chuyển bãi");
    expect(docNghiepVu("nhap tau")).toBe("Nhập tàu");
    expect(docNghiepVu(" CẤP SẢN XUẤT ")).toBe("Cấp sản xuất");
    expect(docNghiepVu("")).toBe("");
    expect(docNghiepVu("xyz")).toBeNull();
  });
  it("khóa dòng có nghiệp vụ, khóa cột thì không; dòng cũ (không nghiệp vụ) giữ nguyên khóa", () => {
    expect(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat", "HRC", "Nhập tàu")).not.toBe(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat", "HRC", "Xuất tàu"));
    expect(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat", "HRC", "")).toBe(khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat", "HRC"));
    const r = { huong: "phuc_vu_cang", loai: "Băng tải", donVi: "hoa_phat", hang: "HRC", nv: "Nhập tàu" };
    expect(khoaCot(r)).toBe(khoaDong("phuc_vu_cang", "Băng tải", "hoa_phat", "HRC"));
    expect(khoaCua(r)).toBe(khoaDong("phuc_vu_cang", "Băng tải", "hoa_phat", "HRC", "Nhập tàu"));
  });
  it("nhomDongVT tách theo nghiệp vụ", () => {
    const r = (nv, tan) => [khoaDong("phuc_vu_cang", "Xe ben", "hoa_phat", "HRC", nv), { huong: "phuc_vu_cang", loai: "Xe ben", donVi: "hoa_phat", hang: "HRC", nv, tan }];
    const ds = nhomDongVT(Object.fromEntries([r("Nhập tàu", "1"), r("Xuất tàu", "2")]), ["phuc_vu_cang"]);
    expect(ds.map((o) => o.nv).sort()).toEqual(["Nhập tàu", "Xuất tàu"]);
  });
  it("dán nhanh: cột Nghiệp vụ, dòng khác nghiệp vụ không bị cộng gộp, nghiệp vụ lạ báo lỗi", () => {
    const kq = docBangMucTieuVT([["Loại hàng", "Hướng", "Nghiệp vụ", "Loại xe", "Hòa Phát"], ["HRC", "PVC", "Nhập tàu", "Xe ben", "100"], ["HRC", "PVC", "Xuất tàu", "Xe ben", "50"], ["HRC", "PVC", "Lạ", "Xe ben", "5"]]);
    expect(kq.ds[0]).toMatchObject({ nv: "Nhập tàu", hp: 100, loi: [] });
    expect(kq.ds[2].loi.join()).toMatch(/Nghiệp vụ/);
    const g = gopDongDonVi(thanhDongDonVi(kq.ds.filter((x) => !x.loi.length)));
    expect(g.ds).toHaveLength(2); expect(g.trung).toBe(0);
  });
});
