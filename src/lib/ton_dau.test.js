import { describe, it, expect } from "vitest";
import { tinhTonDau, luotTonDau, deltaLuot, chonTonDauMoiNhat, ngayVN, tonKhoTheoSo } from "./tonDau";

// Một gian "G1" của bãi "B"; gan trả khóa gian
const gan = (bai, hang, khu) => (bai === "B" && (khu === "G1" || !khu) ? "k1" : "x");
const kr = { ten_bai: "B", ten: "G1" };
const g = (id, ngay, loai, sl, o = {}) => ({ id, ngay, loai, ten_bai: "B", ten_khu: "G1", hang: "HRC", so_luong: sl, ...o });
const td = (giaoDich, ngay, tonDau) => tinhTonDau({ gan, giaoDich, key: "k1", hang: "HRC", ngay, tonDau });
const tong = (ds) => ds.reduce((s, x) => s + deltaLuot(x, "k1", "HRC", gan), 0); // tồn theo sổ (giống view kho_ton)

describe("tồn đầu kỳ đặt lại (không cộng dồn)", () => {
  it("ngày 16/11 đặt 500, ngày 17/11 đặt 200 thì tồn là 200 (không phải 700)", () => {
    const sổ = [g(1, "2026-11-16", "dau_ky", 500, { do_thuc_te: 500 })];
    const r = td(sổ, "2026-11-17", 200);
    expect(r.base).toBe(500); expect(r.delta).toBe(-300);
    expect(r.cu).toBe(false); expect(r.trung).toBe(false);
    expect(tong(sổ) + r.delta).toBe(200);
  });
  it("khai báo lại cùng ngày: cảnh báo (trung), số mới thay số cũ", () => {
    const sổ = [g(1, "2026-11-17", "dau_ky", 700, { do_thuc_te: 700 })]; // lần 1: 0 -> 700
    const r = td(sổ, "2026-11-17", 200);
    expect(r.base).toBe(0); expect(r.hienCo).toBe(700); expect(r.delta).toBe(-500);
    expect(r.trung).toBe(true); expect(r.moiNhat).toEqual({ ngay: "2026-11-17", so: 700 });
    expect(tong(sổ) + r.delta).toBe(200);
  });
  it("khai báo ba lần cùng ngày vẫn chỉ lấy số cuối, không cộng dồn", () => {
    let sổ = [];
    let id = 0;
    for (const x of [700, 200, 350]) {
      const r = td(sổ, "2026-11-17", x);
      sổ = [...sổ, g(++id, "2026-11-17", "dau_ky", r.delta, { do_thuc_te: x })];
      expect(tong(sổ)).toBe(x);
    }
    expect(td(sổ, "2026-11-17", 350).moiNhat.so).toBe(350);
  });
  it("khai cho ngày CŨ HƠN ngày đã khai thì bị chặn (cu), chỉ lấy tồn ngày mới nhất", () => {
    const sổ = [g(1, "2026-11-20", "dau_ky", 500, { do_thuc_te: 500 })];
    const r = td(sổ, "2026-11-18", 100);
    expect(r.cu).toBe(true); expect(r.moiNhat.ngay).toBe("2026-11-20");
  });
  it("nhập / xuất từ ngày đó trở đi vẫn cộng lên trên tồn đầu", () => {
    const sổ = [g(1, "2026-11-15", "nhap", 100), g(2, "2026-11-17", "nhap", 50), g(3, "2026-11-17", "xuat", 20)]; // tồn 130
    const r = td(sổ, "2026-11-17", 400);
    expect(r.base).toBe(100); expect(r.delta).toBe(300);
    expect(tong(sổ) + r.delta).toBe(430); // 400 đầu ngày + 50 − 20
  });
  it("tính từ TOÀN BỘ sổ: lượt cũ hơn 35 ngày vẫn nằm trong tồn sổ trước ngày", () => {
    const sổ = [g(1, "2026-08-01", "nhap", 1000), g(2, "2026-11-10", "xuat", 100)];
    const r = td(sổ, "2026-11-17", 300);
    expect(r.base).toBe(900); expect(r.delta).toBe(-600);
  });
  it("tồn đầu kiểu cũ (không có do_thuc_te) không được coi là mốc ngày mới nhất", () => {
    const sổ = [g(1, "2026-11-20", "dau_ky", 500)];
    expect(td(sổ, "2026-11-18", 100).cu).toBe(false);
  });
  it("điều chuyển đến / đi tính đúng", () => {
    const dc = { id: 9, ngay: "2026-11-17", loai: "dieu_chuyen", ten_bai: "B", ten_khu: "G2", den_bai: "B", den_khu: "G1", hang: "HRC", so_luong: 30 };
    expect(deltaLuot(dc, "k1", "HRC", gan)).toBe(30);
  });
  it("lượt ghi: bỏ qua khi số đã khớp, có do_thuc_te / so_sach", () => {
    expect(luotTonDau({ ngay: "2026-11-17", kr, hang: "HRC", tonDau: 200, hienCo: 200, delta: 0 })).toBeNull();
    expect(luotTonDau({ ngay: "2026-11-17", kr, hang: "HRC", tonDau: 0, hienCo: 0, delta: 0, ghiCa: true })).toMatchObject({ loai: "dau_ky", so_luong: 0, do_thuc_te: 0, so_sach: 0 });
    expect(luotTonDau({ ngay: "2026-11-17", kr, hang: "HRC", tonDau: 200, hienCo: 500, delta: -300 })).toMatchObject({ loai: "dau_ky", so_luong: -300, do_thuc_te: 200, so_sach: 500, ten_khu: "G1" });
  });
});

describe("nhiều dòng tồn đầu trong một lần dán", () => {
  it("mỗi gian / lô + hàng chỉ lấy ngày mới nhất; cùng ngày thì dòng cuối", () => {
    const ds = [{ khoa: "a", ngay: "2026-11-16", v: 1 }, { khoa: "a", ngay: "2026-11-18", v: 2 }, { khoa: "b", ngay: "2026-11-16", v: 3 }, { khoa: "a", ngay: "2026-11-18", v: 4 }, { khoa: "a", ngay: "2026-11-17", v: 5 }];
    const { giu, bo } = chonTonDauMoiNhat(ds);
    expect(giu.map((x) => x.v)).toEqual([3, 4]);
    expect(bo.map((x) => [x.y.v, x.lyDo])).toEqual([[1, "cu"], [2, "trung"], [5, "cu"]]);
  });
  it("hai ngày của cùng gian / lô: chỉ ngày mới nhất được ghi nên tồn cuối đúng, không cộng dồn", () => {
    const { giu } = chonTonDauMoiNhat([{ khoa: "k1|hrc", ngay: "2026-11-16", so: 500 }, { khoa: "k1|hrc", ngay: "2026-11-17", so: 200 }]);
    const r = td([], giu[0].ngay, giu[0].so);
    expect(r.delta).toBe(200);
  });
  it("định dạng ngày", () => { expect(ngayVN("2026-11-05")).toBe("05/11/2026"); });
});

describe("quy tắc tồn: số khai của ngày khai mới nhất, không cộng dồn, từ đó nhập / xuất cộng trừ", () => {
  const b = "Kho nóng HRC1", k = "KHO HRC1", h = "THÉP CUỘN HRC";
  const L = (id, ngay, loai, so_luong, ex = {}) => ({ id, ngay, loai, ten_bai: b, ten_khu: k, hang: h, so_luong, so_lo: null, ...ex });
  const ton = (gd, bai = b) => Math.round(tonKhoTheoSo(gd).filter((r) => r.ten_bai === bai).reduce((s, r) => s + r.ton, 0) * 100) / 100;
  it("chưa khai tồn đầu kiểu đặt lại: cộng dồn sổ như thường", () => {
    expect(ton([L(1, "2026-11-05", "nhap", 100), L(2, "2026-11-06", "xuat", 30)])).toBe(70);
  });
  it("khai tồn đầu: tồn = số khai, bỏ qua lượt nhập / xuất ghi ngày trước ngày khai (kể cả ghi bổ sung sau)", () => {
    const gd = [L(1, "2026-11-05", "nhap", 44926), L(2, "2026-11-19", "dau_ky", -3269.52, { do_thuc_te: 41656.48 }), L(3, "2026-11-15", "xuat", 47236.49)]; // lượt 3 ghi sau, ngày cũ
    expect(ton(gd)).toBe(41656.48);
  });
  it("từ ngày khai trở đi cộng trừ bình thường, cùng ngày khai tính sau tồn đầu", () => {
    const gd = [L(1, "2026-11-19", "dau_ky", 0, { do_thuc_te: 1000 }), L(2, "2026-11-19", "xuat", 100), L(3, "2026-11-20", "nhap", 50), L(4, "2026-11-21", "xuat", 20)];
    expect(ton(gd)).toBe(930);
  });
  it("khai nhiều lần: chỉ lần khai ngày mới nhất, không cộng dồn; cùng ngày lấy lượt ghi sau", () => {
    const gd = [L(1, "2026-11-10", "dau_ky", 500, { do_thuc_te: 500 }), L(2, "2026-11-15", "dau_ky", 100, { do_thuc_te: 600 }), L(3, "2026-11-15", "dau_ky", 50, { do_thuc_te: 650 }), L(4, "2026-11-16", "nhap", 10)];
    expect(ton(gd)).toBe(660);
  });
  it("điều chuyển: gian đi trừ, gian đến cộng; mỗi gian theo ngày khai riêng", () => {
    const den = { ten_bai: "Kho nóng HRC2", ten_khu: "KHO HRC2" };
    const gd = [L(1, "2026-11-19", "dau_ky", 0, { do_thuc_te: 1000 }), { ...L(2, "2026-11-20", "dieu_chuyen", 200), den_bai: den.ten_bai, den_khu: den.ten_khu },
      { ...L(3, "2026-11-10", "nhap", 777), ten_bai: den.ten_bai, ten_khu: den.ten_khu }, { ...L(4, "2026-11-19", "dau_ky", 0, { do_thuc_te: 300 }), ten_bai: den.ten_bai, ten_khu: den.ten_khu }];
    expect(ton(gd, b)).toBe(800); expect(ton(gd, den.ten_bai)).toBe(500);
  });
  it("kiểm kê (cũng có do_thuc_te) vẫn cộng chênh lệch, không phải số khai tồn đầu", () => {
    expect(ton([L(1, "2026-11-19", "dau_ky", 0, { do_thuc_te: 1000 }), L(2, "2026-11-20", "kiem_ke", -15, { do_thuc_te: 985 })])).toBe(985);
  });
});
