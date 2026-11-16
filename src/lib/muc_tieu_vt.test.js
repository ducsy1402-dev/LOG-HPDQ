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
