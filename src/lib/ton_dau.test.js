import { describe, it, expect } from "vitest";
import { tinhTonDau, luotTonDau, deltaLuot } from "./tonDau";

// Một gian "G1" của bãi "B"; gan trả khóa gian
const gan = (bai, hang, khu) => (bai === "B" && (khu === "G1" || !khu) ? "k1" : "x");
const kr = { ten_bai: "B", ten: "G1" };
const moi = (tonSo) => ({ gan, cap: [{ key: "k1", hang: "HRC", ton: tonSo }] });
const g = (id, ngay, loai, sl, o = {}) => ({ id, ngay, loai, ten_bai: "B", ten_khu: "G1", hang: "HRC", so_luong: sl, ...o });

describe("tồn đầu kỳ đặt lại (không cộng dồn)", () => {
  it("ngày 16/11 đặt 500, ngày 17/11 đặt 200 thì tồn là 200 (không phải 700)", () => {
    // sổ sau khi nhập 16/11: lượt Tồn đầu kỳ +500, tồn 500
    const sổ = [g(1, "2026-11-16", "dau_ky", 500, { do_thuc_te: 500 })];
    const r = tinhTonDau({ kho: moi(500), giaoDich: sổ, key: "k1", hang: "HRC", ngay: "2026-11-17", tonDau: 200 });
    expect(r.base).toBe(500); expect(r.delta).toBe(-300);
    expect(500 + r.delta).toBe(200);
  });
  it("khai báo lại cùng ngày thì ghi thêm lượt bù, tồn đầu ngày đúng bằng số mới", () => {
    const sổ = [g(1, "2026-11-17", "dau_ky", 700, { do_thuc_te: 700 })]; // lần 1: 0 -> 700
    const r = tinhTonDau({ kho: moi(700), giaoDich: sổ, key: "k1", hang: "HRC", ngay: "2026-11-17", tonDau: 200 });
    expect(r.base).toBe(0); expect(r.hienCo).toBe(700); expect(r.delta).toBe(-500); // 700 − 500 = 200
  });
  it("nhập / xuất từ ngày đó trở đi vẫn cộng lên trên tồn đầu", () => {
    const sổ = [g(1, "2026-11-15", "nhap", 100), g(2, "2026-11-17", "nhap", 50), g(3, "2026-11-17", "xuat", 20)]; // tồn 130
    const r = tinhTonDau({ kho: moi(130), giaoDich: sổ, key: "k1", hang: "HRC", ngay: "2026-11-17", tonDau: 400 });
    expect(r.base).toBe(100); expect(r.delta).toBe(300); // tồn mới = 130 + 300 = 430 = 400 đầu ngày + 50 − 20
  });
  it("điều chuyển đến / đi tính đúng", () => {
    const dc = { id: 9, ngay: "2026-11-17", loai: "dieu_chuyen", ten_bai: "B", ten_khu: "G2", den_bai: "B", den_khu: "G1", hang: "HRC", so_luong: 30 };
    expect(deltaLuot(dc, "k1", "HRC", gan)).toBe(30);
  });
  it("lượt ghi: bỏ qua khi số đã khớp, có do_thuc_te / so_sach", () => {
    expect(luotTonDau({ ngay: "2026-11-17", kr, hang: "HRC", tonDau: 200, hienCo: 200, delta: 0 })).toBeNull();
    // khai tồn đầu 0 khi tồn đang 0 (ghiCa): vẫn ghi một lượt chênh lệch 0 để web nhận số 0
    expect(luotTonDau({ ngay: "2026-11-17", kr, hang: "HRC", tonDau: 0, hienCo: 0, delta: 0, ghiCa: true })).toMatchObject({ loai: "dau_ky", so_luong: 0, do_thuc_te: 0, so_sach: 0 });
    expect(luotTonDau({ ngay: "2026-11-17", kr, hang: "HRC", tonDau: 200, hienCo: 500, delta: -300 })).toMatchObject({ loai: "dau_ky", so_luong: -300, do_thuc_te: 200, so_sach: 500, ten_khu: "G1" });
  });
});
