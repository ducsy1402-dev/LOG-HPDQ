import { describe, it, expect } from "vitest";
import { cotCangTrucThuoc, cangCuaChuyen, gomTheoCang, KHONG_CANG } from "./cangTrucThuoc";

const dmCot = [{ bang: "kho", ma: "x1", ten: "Khu vực" }, { bang: "ben", ma: "c1", ten: "Cảng trực thuộc" }];
const berths = [{ ma: "B01", them: { c1: "Dung Quất" } }, { ma: "B02", them: { c1: " Hào Hưng " } }, { ma: "B03", them: {} }, { ma: "B04" }];

describe("Cảng trực thuộc của bến", () => {
  it("tìm đúng cột theo tên, chỉ ở bảng bến", () => {
    expect(cotCangTrucThuoc(dmCot).ma).toBe("c1");
    expect(cotCangTrucThuoc([{ bang: "kho", ten: "Cảng trực thuộc" }])).toBeNull();
    expect(cotCangTrucThuoc(null)).toBeNull();
  });
  it("chuyến thuộc cảng của bến đang cập; bến chưa ghi hoặc chưa có bến thì chưa khai báo", () => {
    const cang = cangCuaChuyen(dmCot, berths);
    expect(cang({ ben_ma: "B01" })).toBe("Dung Quất");
    expect(cang({ ben_ma: "B02" })).toBe("Hào Hưng");
    expect(cang({ ben_ma: "B03" })).toBe(KHONG_CANG);
    expect(cang({ ben_ma: "B04" })).toBe(KHONG_CANG);
    expect(cang({ ben_ma: null })).toBe(KHONG_CANG);
    expect(cangCuaChuyen([], berths)).toBeNull(); // chưa có cột
  });
  it("gom theo cảng: nhiều tàu trước, chưa khai báo cuối", () => {
    const cang = cangCuaChuyen(dmCot, berths);
    const g = gomTheoCang([{ id: 1, ben_ma: "B03" }, { id: 2, ben_ma: "B02" }, { id: 3, ben_ma: "B01" }, { id: 4, ben_ma: "B01" }], cang);
    expect(g.map(([k, ds]) => [k, ds.length])).toEqual([["Dung Quất", 2], ["Hào Hưng", 1], [KHONG_CANG, 1]]);
  });
});
