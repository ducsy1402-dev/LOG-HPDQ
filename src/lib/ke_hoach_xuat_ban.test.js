import { describe, it, expect } from "vitest";
import { tongHopXuatBan, gomXe, dongGhiXe, chiaTheoSucChua } from "./keHoachXuatBan";

const xe = [
  { hang: "Thép cuộn HRC", hinh_thuc: "bo", loai_xe: "Xe đầu kéo", don_vi: "hoa_phat", tan: 6000 },
  { hang: "Thép cuộn HRC", hinh_thuc: "bo", loai_xe: "Xe đầu kéo", don_vi: "nha_thau", tan: 4000 },
  { hang: "thép cuộn hrc", hinh_thuc: "bien", loai_xe: "", don_vi: "hoa_phat", tan: 20000 },
  { hang: "Phôi vuông", hinh_thuc: "bien", loai_xe: "", don_vi: "nha_thau", tan: 7000 },
];
describe("kế hoạch xuất bán", () => {
  it("tổng hợp theo hàng: tổng = đường bộ + đường biển, tách Hòa Phát / Thuê ngoài", () => {
    const m = tongHopXuatBan(xe), h = [...m.values()].find((x) => x.hang === "Thép cuộn HRC");
    expect(m.size).toBe(2);
    expect(h).toMatchObject({ bo: 10000, bien: 20000, tong: 30000, hp: 26000, tn: 4000 });
  });
  it("gom dòng loại xe của một hình thức", () => {
    expect(gomXe(xe, "Thép cuộn HRC", "bo")).toEqual([{ loai: "Xe đầu kéo", hp: 6000, tn: 4000 }]);
    expect(gomXe(xe, "Thép cuộn HRC", "bien")).toEqual([{ loai: "", hp: 20000, tn: 0 }]);
  });
  it("dòng ghi: bỏ ô trống, cùng loại xe cộng dồn", () => {
    const r = dongGhiXe([{ loai: "Xe ben", hp: 100, tn: "" }, { loai: "xe ben", hp: 50.5, tn: 20 }, { loai: "", hp: 0, tn: 0 }]);
    expect(r).toEqual([{ loai_xe: "Xe ben", don_vi: "hoa_phat", tan: 150.5 }, { loai_xe: "Xe ben", don_vi: "nha_thau", tan: 20 }]);
  });
  it("chia theo tỉ lệ sức chứa, tổng luôn khớp", () => {
    const m = chiaTheoSucChua(10000, [{ key: "a", suc: 20000 }, { key: "b", suc: 30000 }, { key: "c", suc: 50000 }]);
    expect([m.get("a"), m.get("b"), m.get("c")]).toEqual([2000, 3000, 5000]);
    const l = chiaTheoSucChua(100, [{ key: "a", suc: 1 }, { key: "b", suc: 1 }, { key: "c", suc: 1 }]);
    expect([...l.values()].reduce((s, v) => s + v, 0)).toBeCloseTo(100, 2);
  });
  it("lô không có sức chứa thì chia đều", () => {
    const m = chiaTheoSucChua(90, [{ key: "a", suc: 0 }, { key: "b", suc: 0 }, { key: "c", suc: 0 }]);
    expect([...m.values()]).toEqual([30, 30, 30]);
  });
});
