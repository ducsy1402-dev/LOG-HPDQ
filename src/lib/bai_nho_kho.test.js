import { describe, it, expect } from "vitest";
import { tongHopKho, khuChoPhepHang } from "./kho";
import { chiaNhanh, chiaDeu } from "../pages/kho/SoDoKhoBai.jsx";

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

describe("sơ đồ: chia nhánh theo tên, chia đều các hàng", () => {
  const ds = (...t) => t.map((ten) => ({ ten }));
  const dem = (n) => Array.from({ length: n }, (_, i) => i);
  it("GA1..GA3 và GB1..GB3 thành hai nhánh GA, GB", () => {
    const n = chiaNhanh(ds("GA1", "GA2", "GA3", "GB1", "GB2", "GB3"));
    expect(n.map((g) => g.ten)).toEqual(["GA", "GB"]);
    expect(n[0].ds.length).toBe(3);
  });
  it("một nhánh, tên không có số, nhánh chỉ có một bãi nhỏ, tên không đều: không chia nhánh", () => {
    expect(chiaNhanh(ds("Gian A", "Gian B", "Gian C"))).toBeNull();
    expect(chiaNhanh(ds("Bãi 1", "Bãi 2", "Bãi 3"))).toBeNull();
    expect(chiaNhanh(ds("GA1", "GB1", "Kho phụ"))).toBeNull();
    expect(chiaNhanh(ds("GA1", "GA2", "GB1"))).toBeNull();
    // tên kiểu thật: "Gian CD khu 1/F01" … mỗi tên một tiền tố riêng
    expect(chiaNhanh(ds("Gian CD khu 1/F01", "Gian CD khu 2/F02", "Gian DE khu 1/F01", "Gian DE khu 2/F02"))).toBeNull();
  });
  it("chia đều các hàng, tối đa 5 ô một hàng", () => {
    const sz = (n) => chiaDeu(dem(n)).map((h) => h.length);
    expect(sz(1)).toEqual([1]);
    expect(sz(5)).toEqual([5]);
    expect(sz(6)).toEqual([3, 3]);
    expect(sz(7)).toEqual([4, 3]);
    expect(sz(10)).toEqual([5, 5]);
    expect(sz(11)).toEqual([4, 4, 3]);
    expect(sz(17)).toEqual([5, 4, 4, 4]);
  });
  it("chia đều giữ nguyên thứ tự", () => {
    expect(chiaDeu(dem(7)).flat()).toEqual(dem(7));
  });
});
