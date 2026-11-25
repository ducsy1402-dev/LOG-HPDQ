import { describe, it, expect } from "vitest";
import { taoNhomHang } from "./sanLuong";
import { tenHangChuaNhom } from "../pages/cang/QuyNhomHang";

const HH = [{ loai_hang: "Phế HMS", nhom: "Phế" }, { loai_hang: "Than cám", nhom: "Than" }];
const v = (ten_hang, khoi_luong, o = {}) => ({ id: Math.random(), ten_hang, loai_hang: "", khoi_luong, huong: "nhap", ...o });

describe("Quy tên hàng của chuyến tàu về nhóm", () => {
  it("liệt kê tên chưa có nhóm, gộp 'bonus' và 'Bonus', tách tên nhiều hàng theo ;", () => {
    const nhom = taoNhomHang(HH);
    const ds = tenHangChuaNhom([v("bonus", 1000), v("Bonus", 500), v("Phế HMS; 4k", 800), v("Than cám 2A", 300), v("Thép phế >= 3mm", 200)], nhom);
    expect(ds.map((x) => x.ten.toLowerCase())).toEqual(["bonus", "4k", "thép phế >= 3mm"]);
    expect(ds[0].tau).toBe(2); expect(Math.round(ds[0].kl)).toBe(1500);
  });
  it("sau khi thêm vào danh mục kèm nhóm thì không còn trong danh sách", () => {
    const nhom = taoNhomHang([...HH, { loai_hang: "bonus", nhom: "Phế" }]);
    expect(tenHangChuaNhom([v("Bonus", 1000)], nhom)).toEqual([]);
  });
  it("bỏ qua tàu hủy", () => {
    expect(tenHangChuaNhom([v("lạ", 10, { huy: true })], taoNhomHang(HH))).toEqual([]);
  });
});
