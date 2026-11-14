import { describe, it, expect } from "vitest";
import { uocThongSo, thoiGianLam, mocDuKien, khopLoaiHang } from "./xepBen";
import { trangThai, laUoc } from "./linetime";

const T = (s) => new Date(`2026-11-${s}:00+07:00`).getTime();
const H = 36e5;
const BEN = [
  { ma: "B07", dwt_max: 20000, mon_max: 9, loa_max: 180, loai_hang: "Đá, Xỉ, Quặng hồi", thu_tu: 8 },
  { ma: "B08", dwt_max: 10000, mon_max: 8.5, loa_max: 126.5, loai_hang: "Đá, Xỉ", thu_tu: 9 },
  { ma: "B10", dwt_max: 250000, mon_max: 18.5, loa_max: 410, loai_hang: "Than, Quặng", thu_tu: 11 },
];

describe("Ước tính thông số tàu", () => {
  it("chỉ có khối lượng: ước DWT, LOA, mớn", () => {
    const t = uocThongSo({ khoi_luong: 9000 });
    expect(t.dwt).toBe(10000); expect(t.loa).toBe(125); expect(t.draft).toBe(8);
    expect([...t.uoc].sort()).toEqual(["draft", "dwt", "loa"]);
  });
  it("có DWT thì giữ, ước LOA / mớn / khối lượng", () => {
    const t = uocThongSo({ dwt: 75000 });
    expect(t).toMatchObject({ dwt: 75000, loa: 225, draft: 14, khoi_luong: 67500 });
  });
});

describe("Thời gian làm hàng và mốc dự kiến", () => {
  it("cam kết: khối lượng ÷ cam kết; không có thì định mức cẩu của bến × 20 giờ", () => {
    expect(thoiGianLam({ khoi_luong: 10000, cam_ket: 5000 })).toBe(48 * H);
    const ctx = { cranes: [{ model: "SC-32T", ben_phuc_vu: ["B07"] }, { model: "SC-32T", ben_phuc_vu: ["B07"] }], dinhMuc: [{ loai: "SC-32T", hang_hoa: "Đá", tan_gio: 250 }] };
    expect(thoiGianLam({ khoi_luong: 10000, loai_hang: "Đá" }, "B07", ctx)).toBe((10000 / (500 * 20)) * 24 * H);
  });
  it("thủ tục = kết thúc làm hàng + 2 giờ, rời = thủ tục + 30 phút", () => {
    const m = mocDuKien({ etb: new Date(T("10T06:00")).toISOString(), khoi_luong: 10000, cam_ket: 5000 });
    expect(m.bd - T("10T06:00")).toBe(H);
    expect(m.kt - m.bd).toBe(48 * H);
    expect(m.thuTuc - m.kt).toBe(2 * H);
    expect(m.roi - m.thuTuc).toBe(0.5 * H);
  });
});

describe("Trạng thái tự chạy theo giờ dự kiến", () => {
  const v = { eta: new Date(T("09T00:00")).toISOString(), etb: new Date(T("09T06:00")).toISOString(), khoi_luong: 10000, cam_ket: 5000 };
  it("qua ETA: đã đến neo; qua ETB: đã cập / làm hàng; qua giờ xong hàng: xong hàng", () => {
    expect(trangThai(v, T("08T00:00"))).toBe("du_kien");
    expect(trangThai(v, T("09T01:00"))).toBe("cho_neo");
    expect(trangThai(v, T("09T06:30"))).toBe("cap_ben"); // đã cập, chờ làm hàng
    expect(trangThai(v, T("10T00:00"))).toBe("lam_hang"); // bắt đầu làm hàng dự kiến = ETB + 1 giờ
    expect(trangThai(v, T("11T07:00"))).toBe("xong_hang");
    expect(laUoc(v, T("10T00:00"))).toBe(true);
    expect(laUoc({ ...v, atb: v.etb, bd_lam_hang: v.etb }, T("10T00:00"))).toBe(false);
  });
});

describe("Khớp loại hàng với danh sách của bến", () => {
  it("so cả cụm từ, không so từng từ lẻ", () => {
    expect(khopLoaiHang("Xỉ thép", "Xỉ thép")).toBe(true);
    expect(khopLoaiHang("Xỉ thép cấp phối SS10", "Xỉ thép")).toBe(true);
    expect(khopLoaiHang("Xỉ", "Xỉ thép")).toBe(true);
    expect(khopLoaiHang("Xỉ thép", "Thép thành phẩm")).toBe(false); // chỉ chung chữ "thép"
    expect(khopLoaiHang("Xỉ thép cấp phối SS10", "Phôi vuông")).toBe(false); // "phối" khác "phôi" nhưng bỏ dấu giống nhau: không so từng từ
    expect(khopLoaiHang("Phôi vuông", "Thép thành phẩm Phôi vuông")).toBe(true);
  });
});
