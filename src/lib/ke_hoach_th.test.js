import { describe, it, expect } from "vitest";
import { dongKeHoach, gomXe, tongPhanXe, dongGhiXe, chiaTheoSucChua, docDanKeHoach } from "./keHoachTH";

const th = [
  { loai: "xuat_ban", hang: "Thép cuộn HRC", bo: 10000, bien: 20000, tong: 0 },
  { loai: "xuat_ban", hang: "Phôi vuông", bo: 0, bien: 7000, tong: 0 },
  { loai: "san_xuat", hang: "Thép cuộn HRC", bo: 0, bien: 0, tong: 35000 },
  { loai: "nhap_mua", hang: "Phế", bo: 4000, bien: 12000, tong: 0 },
];
const xe = [
  { loai: "xuat_ban", hang: "Thép cuộn HRC", hinh_thuc: "bo", loai_xe: "Xe đầu kéo", don_vi: "hoa_phat", tan: 6000 },
  { loai: "xuat_ban", hang: "Thép cuộn HRC", hinh_thuc: "bo", loai_xe: "Xe đầu kéo", don_vi: "nha_thau", tan: 4000 },
  { loai: "nhap_mua", hang: "Phế", hinh_thuc: "bien", loai_xe: "", don_vi: "nha_thau", tan: 12000 },
];
describe("kế hoạch tổng hợp", () => {
  it("các dòng của từng bản kế hoạch: tổng = bộ + biển; sản xuất lấy cột tổng", () => {
    expect(dongKeHoach(th, "xuat_ban").map((x) => [x.hang, x.tong])).toEqual([["Thép cuộn HRC", 30000], ["Phôi vuông", 7000]]);
    expect(dongKeHoach(th, "san_xuat")).toEqual([{ hang: "Thép cuộn HRC", bo: 0, bien: 0, tong: 35000 }]);
    expect(dongKeHoach(th, "nhap_mua")[0]).toMatchObject({ bo: 4000, bien: 12000, tong: 16000 });
  });
  it("phân xe: gom theo loại xe và theo kế hoạch", () => {
    expect(gomXe(xe, "xuat_ban", "Thép cuộn HRC", "bo")).toEqual([{ loai: "Xe đầu kéo", hp: 6000, tn: 4000 }]);
    expect(gomXe(xe, "nhap_mua", "Phế", "bo")).toEqual([]);
    expect(tongPhanXe(xe, "xuat_ban")).toEqual({ hp: 6000, tn: 4000 });
  });
  it("dòng ghi phân xe: bỏ ô trống, cùng loại xe cộng dồn", () => {
    const r = dongGhiXe([{ loai: "Xe ben", hp: 100, tn: "" }, { loai: "xe ben", hp: 50.5, tn: 20 }, { loai: "", hp: 0, tn: 0 }]);
    expect(r).toEqual([{ loai_xe: "Xe ben", don_vi: "hoa_phat", tan: 150.5 }, { loai_xe: "Xe ben", don_vi: "nha_thau", tan: 20 }]);
  });
  it("chia theo tỉ lệ sức chứa, tổng luôn khớp; không có sức chứa thì chia đều", () => {
    const m = chiaTheoSucChua(10000, [{ key: "a", suc: 20000 }, { key: "b", suc: 30000 }, { key: "c", suc: 50000 }]);
    expect([m.get("a"), m.get("b"), m.get("c")]).toEqual([2000, 3000, 5000]);
    const l = chiaTheoSucChua(100, [{ key: "a", suc: 1 }, { key: "b", suc: 1 }, { key: "c", suc: 1 }]);
    expect([...l.values()].reduce((s, v) => s + v, 0)).toBeCloseTo(100, 2);
    expect([...chiaTheoSucChua(90, [{ key: "a", suc: 0 }, { key: "b", suc: 0 }, { key: "c", suc: 0 }]).values()]).toEqual([30, 30, 30]);
  });
});
describe("dán nhanh kế hoạch", () => {
  it("xuất bán / nhập mua: nhận cột theo tên, tổng lấy bộ + biển, cảnh báo khi lệch", () => {
    const r = docDanKeHoach([["Tên hàng", "Tổng", "Đường bộ", "Đường biển"], ["Thép cuộn HRC", "31.000", "10.000", "20.000"], ["Phế", "", "-", "5.000"], ["", "", "", ""]], "xuat_ban");
    expect(r.dong).toHaveLength(2);
    expect(r.dong[0]).toMatchObject({ hang: "Thép cuộn HRC", bo: 10000, bien: 20000, tong: 30000 });
    expect(r.dong[0].canh).toHaveLength(1);
    expect(r.dong[1]).toMatchObject({ bo: 0, bien: 5000, tong: 5000, loi: [] });
  });
  it("không có tiêu đề thì theo thứ tự cột của bảng; sản xuất chỉ cần hàng + tổng", () => {
    expect(docDanKeHoach([["Phế", "9000", "4000", "5000"]], "nhap_mua").dong[0]).toMatchObject({ bo: 4000, bien: 5000, tong: 9000 });
    expect(docDanKeHoach([["Thép thanh", "9.000"]], "san_xuat").dong[0]).toMatchObject({ hang: "Thép thanh", tong: 9000, loi: [] });
  });
  it("dòng lỗi: thiếu hàng, không phải số, không có số", () => {
    const r = docDanKeHoach([["", "", "5", "x"], ["Phế", "", "", ""]], "nhap_mua");
    expect(r.dong[0].loi.join()).toMatch(/Thiếu tên hàng/); expect(r.dong[0].loi.join()).toMatch(/không phải số/);
    expect(r.dong[1].loi.join()).toMatch(/Chưa có số/);
  });
  it("báo thiếu cột khi có tiêu đề mà thiếu cột bắt buộc", () => {
    expect(docDanKeHoach([["Tên hàng", "Đường bộ"], ["Phế", "5"]], "xuat_ban").thieu).toEqual(["Đường biển"]);
  });
});
