import { describe, it, expect } from "vitest";
import { docBangMucTieuVT, thanhDongDonVi, docTan } from "./mucTieuVT";
import { tachBang } from "./paste";

const TD = "Stt\tLoại hàng\tHướng\tLoại xe\tĐVT\tTổng\tHòa Phát\tThuê ngoài\tGhi chú";
describe("dán nhanh mục tiêu vận tải theo form Excel", () => {
  it("bỏ cột Stt, đọc đủ cột, '-' là không có số", () => {
    const b = tachBang([TD, "1\tĐá vôi\tPVC\tXe ben\tTấn\t60.000\t-\t60.000\t", "2\tTHÉP\tPVC\tTàu hỏa\tTấn\t66.200\t66.200\t-\tghi"].join("\n"));
    const { ds } = docBangMucTieuVT(b);
    expect(ds.map((x) => x.loi.length)).toEqual([0, 0]);
    expect(ds[0]).toMatchObject({ hang: "Đá vôi", huong: "phuc_vu_cang", loai: "Xe ben", hp: null, tn: 60000 });
    expect(thanhDongDonVi(ds).map((x) => [x.donVi, x.tan, x.loai])).toEqual([["nha_thau", 60000, "Xe ben"], ["hoa_phat", 66200, "Tàu hỏa"]]);
  });
  it("PVSX, tổng lệch chỉ cảnh báo, tổng không chia thì báo lỗi", () => {
    const { ds } = docBangMucTieuVT(tachBang([TD, "1\tQuặng\tPVSX\tXe ben\tTấn\t100\t30\t60\t", "2\tQuặng\tPVSX\tĐầu kéo\tTấn\t100\t\t\t"].join("\n")));
    expect(ds[0].huong).toBe("phuc_vu_san_xuat"); expect(ds[0].loi).toEqual([]); expect(ds[0].canh.length).toBe(1);
    expect(ds[1].loi[0]).toMatch(/chưa chia/);
  });
  it("thiếu cột bắt buộc, hướng sai, số sai", () => {
    expect(docBangMucTieuVT([["Loại hàng", "Tổng"], ["a", "1"]]).loiCot).toMatch(/Chưa thấy cột/);
    const { ds } = docBangMucTieuVT(tachBang([TD, "1\tX\tabc\tXe ben\tTấn\t1\t1\t\t", "2\tX\tPVC\tXe ben\tTấn\t1\tabc\t\t"].join("\n")));
    expect(ds[0].loi[0]).toMatch(/Hướng/); expect(ds[1].loi[0]).toMatch(/Hòa Phát/);
  });
  it("docTan", () => { expect(docTan("60.000")).toBe(60000); expect(docTan("-")).toBeNull(); expect(docTan("")).toBeNull(); expect(docTan(5)).toBe(5); expect(docTan("x")).toBeNaN(); });
});
