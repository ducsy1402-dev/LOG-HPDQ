import { describe, it, expect } from "vitest";
import { trangThai, chiSo, TRANG_THAI } from "./linetime";
import { canhBaoChuyen } from "./checks";

const T = (s) => new Date(`2026-11-${s}:00+07:00`).toISOString();
const H = 36e5;

describe("Trạng thái và màu", () => {
  it("chưa có NOR: chưa đến neo (cam); có NOR chưa cập: đã đến neo (xanh dương); làm hàng: vàng", () => {
    const now = new Date(T("02T06:00")).getTime();
    expect(trangThai({ eta: T("05T00:00") }, now)).toBe("du_kien");
    expect(trangThai({ nor: T("01T00:00") }, now)).toBe("cho_neo");
    expect(trangThai({ nor: T("01T00:00"), atb: T("02T00:00") }, new Date(T("02T00:30")).getTime())).toBe("cap_ben");
    expect(trangThai({ atb: T("02T00:00"), bd_lam_hang: T("02T05:00") }, now)).toBe("lam_hang");
    expect(TRANG_THAI.du_kien.mau).toBe("#f97316");
    expect(TRANG_THAI.cho_neo.mau).toBe("#3b82f6");
    expect(TRANG_THAI.lam_hang.mau).toBe("#eab308");
  });
  it("chờ bến tính từ NOR đến cập bến", () => {
    const v = { nor: T("01T00:00"), atb: T("02T12:00") };
    expect(chiSo(v, [], 0).choNeo).toBe(36);
  });
});

describe("Cảnh báo đã bỏ", () => {
  it("không còn cảnh báo chờ neo, thiếu số máng, ETD không khả thi, dự báo bị phạt", () => {
    const now = new Date(T("05T00:00")).getTime();
    const v = { id: 1, ben_ma: "3", nor: T("01T00:00"), eta: T("01T00:00"), etb: T("05T12:00"), etd: T("05T20:00"), khoi_luong: 165000, cam_ket: 25000, kieu_tp: "laytime", moc_tinh_tp: "nor_12h" };
    const ma = canhBaoChuyen(v, { berths: [], now, stops: [] }).map((c) => c.ma);
    for (const x of ["cho_neo", "kb_cau_ben", "kb_pa", "etd", "phat"]) expect(ma).not.toContain(x);
  });
});

import { laChoHang } from "./linetime";
describe("Chờ cập bến do chưa đủ hàng / chưa có bãi", () => {
  it("nhận diện lý do và không tính vào giờ dừng làm hàng", () => {
    expect(laChoHang({ ly_do: "Chờ cập bến: chưa có bãi nhập" })).toBe(true);
    expect(laChoHang({ ly_do: "Chờ hàng" })).toBe(false); // chờ hàng khi đang làm hàng vẫn là khoảng dừng thường
    const v = { atb: T("02T00:00"), bd_lam_hang: T("02T02:00"), kt_lam_hang: T("03T02:00"), khoi_luong: 1000 };
    const cho = { tu: T("01T00:00"), den: T("02T00:00"), ly_do: "Chờ cập bến: chưa đủ hàng" };
    expect(chiSo(v, [cho], 0).dung).toBe(chiSo(v, [], 0).dung);
  });
});
