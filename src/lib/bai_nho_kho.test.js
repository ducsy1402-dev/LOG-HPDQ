import { describe, it, expect } from "vitest";
import { tongHopKho, khuChoPhepHang } from "./kho";
import { chiaNhanh } from "../pages/kho/SoDoKhoBai.jsx";

// Bãi nhỏ trong sổ nhập – xuất (SQL 12, 13/11/2026)
const HH = [{ loai_hang: "Thép cuộn HRC", nhom: "HRC", ti_trong: 1 }, { loai_hang: "Thép thanh", nhom: "Thép thanh", ti_trong: 1 }];
const khoBai = [
  { id: 1, ten_bai: "Kho G", ten_khu: "GA1", hang: "Thép cuộn HRC", kieu_bai: "tu_do", loai_kho: "thanh_pham", suc_chua_tay: 1000 },
  { id: 2, ten_bai: "Kho G", ten_khu: "GA2", hang: "Thép cuộn HRC", kieu_bai: "tu_do", loai_kho: "thanh_pham", suc_chua_tay: 1000 },
  { id: 3, ten_bai: "Kho H", ten_khu: "Gian A", hang: "Thép thanh", kieu_bai: "co_dinh_hang", loai_kho: "thanh_pham", suc_chua_tay: 500 },
];
const tonDong = (th, ten) => th.dong.find((d) => d.ten === ten).ton;

describe("tồn theo bãi nhỏ", () => {
  it("lượt ghi bãi nhỏ GA2 thì tồn vào GA2, không dồn vào khu tự do đầu tiên", () => {
    const th = tongHopKho({ khoBai, khoTon: [{ ten_bai: "Kho G", ten_khu: "GA2", hang: "Thép cuộn HRC", so_lo: "", ton: 100 }], hangHoa: HH });
    expect(tonDong(th, "GA2")).toBe(100);
    expect(tonDong(th, "GA1")).toBe(0);
  });
  it("sổ cũ không ghi bãi nhỏ: xếp theo hàng như trước (khu tự do đầu tiên)", () => {
    const th = tongHopKho({ khoBai, khoTon: [{ ten_bai: "Kho G", hang: "Thép cuộn HRC", so_lo: "", ton: 70 }], hangHoa: HH });
    expect(tonDong(th, "GA1")).toBe(70);
    expect(tonDong(th, "GA2")).toBe(0);
  });
  it("cộng cả sổ cũ và mới của cùng một bãi nhỏ", () => {
    const th = tongHopKho({ khoBai, khoTon: [{ ten_bai: "Kho G", hang: "Thép cuộn HRC", so_lo: "", ton: 70 }, { ten_bai: "Kho G", ten_khu: "GA1", hang: "Thép cuộn HRC", so_lo: "", ton: 30 }], hangHoa: HH });
    expect(tonDong(th, "GA1")).toBe(100);
    expect(th.dong.find((d) => d.ten === "GA1").chua.length).toBe(1);
  });
  it("gan(bãi, hàng, bãi nhỏ) trả khóa đúng bãi nhỏ", () => {
    const th = tongHopKho({ khoBai, khoTon: [], hangHoa: HH });
    expect(th.gan("Kho G", "Thép cuộn HRC", "GA2")).toBe(th.dong.find((d) => d.ten === "GA2").key);
    expect(th.gan("Kho G", "Thép cuộn HRC")).toBe(th.dong.find((d) => d.ten === "GA1").key);
  });
  it("bãi nhỏ cố định hàng chỉ nhận đúng hàng; tự do nhận mọi hàng", () => {
    const th = tongHopKho({ khoBai, khoTon: [], hangHoa: HH });
    const a = th.dong.find((d) => d.ten === "Gian A"), g = th.dong.find((d) => d.ten === "GA1");
    expect(khuChoPhepHang(a, "Thép thanh", HH)).toBe(true);
    expect(khuChoPhepHang(a, "Thép cuộn HRC", HH)).toBe(false);
    expect(khuChoPhepHang(g, "Thép thanh", HH)).toBe(true);
  });
});

describe("sơ đồ chia nhánh theo tên bãi nhỏ", () => {
  const ds = (...t) => t.map((ten) => ({ ten }));
  it("GA1..GA5 và GB1..GB5 thành hai nhánh GA, GB", () => {
    const n = chiaNhanh(ds("GA1", "GA2", "GA3", "GB1", "GB2", "GB3"));
    expect(n.map((g) => g.ten)).toEqual(["GA", "GB"]);
    expect(n[0].ds.length).toBe(3);
  });
  it("một nhánh hoặc tên không có số: không chia", () => {
    expect(chiaNhanh(ds("Gian A", "Gian B", "Gian C"))).toBeNull();
    expect(chiaNhanh(ds("Bãi 1", "Bãi 2", "Bãi 3"))).toBeNull();
  });
  it("tên không có số cuối đi chung nhánh không tên ở cuối", () => {
    const n = chiaNhanh(ds("GA1", "GB1", "Kho phụ"));
    expect(n.map((g) => g.ten)).toEqual(["GA", "GB", ""]);
  });
});
