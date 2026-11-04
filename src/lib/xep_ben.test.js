import { describe, it, expect } from "vitest";
import { uocThongSo, thoiGianLam, mocDuKien, viTriHang } from "./xepBen";
import { tuXepBen, canTuXep, trangThai, laUoc } from "./linetime";

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

describe("Tự xếp bến", () => {
  const iso = (t) => new Date(t).toISOString();
  it("chọn bến hợp kích thước và loại hàng, ETB sau tàu trước 2 giờ", () => {
    const khac = { id: 2, ben_ma: "B07", etb: iso(T("09T00:00")), etd: iso(T("10T00:00")) };
    const v = { id: 1, eta: iso(T("09T06:00")), loai_hang: "Đá", khoi_luong: 9000, cam_ket: 9000 };
    expect(canTuXep(v)).toBe(true);
    const r = tuXepBen(v, { berths: BEN, voyages: [khac], now: T("08T00:00") });
    // B08 (10 000 DWT, mớn 8,5 m, 126,5 m) hợp tàu ước 10 000 DWT / mớn 8 m / 125 m, trống ngay lúc ETA; B07 phải chờ tới 10/11 02:00
    expect(r.ben_ma).toBe("B08");
    expect(new Date(r.etb).getTime()).toBe(T("09T06:00"));
    expect(new Date(r.etd).getTime() - T("09T06:00")).toBe(H + 24 * H + 2.5 * H);
  });
  it("tàu lớn chỉ vào được bến sâu", () => {
    const r = tuXepBen({ id: 1, eta: iso(T("09T00:00")), loai_hang: "Than", khoi_luong: 150000 }, { berths: BEN, voyages: [], now: T("08T00:00") });
    expect(r.ben_ma).toBe("B10");
  });
  it("loại hàng ở vị trí ưu tiên", () => {
    expect(viTriHang({ loai_hang: "Xỉ" }, BEN[0])).toBe(1);
    expect(viTriHang({ loai_hang: "Than" }, BEN[0])).toBe(-1);
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

describe("Xếp nhiều chuyến: ưu tiên và giữ ETB", async () => {
  const { xepNhieu, tuXepBenGiuMoc } = await import("./linetime");
  const iso = (t) => new Date(t).toISOString();
  const B1 = [{ ma: "B10", dwt_max: 250000, mon_max: 18.5, loa_max: 410, loai_hang: "Than, Quặng", thu_tu: 1 }];
  const now = T("08T00:00");
  const tau = (id, o) => ({ id, loai_hang: "Than", khoi_luong: 20000, cam_ket: 20000, dwt: 60000, loa: 200, draft: 12, eta: iso(T("09T00:00")), ...o });
  it("một bến: tàu ưu tiên (★) xếp trước tàu có ETA sớm hơn; tàu đến sau xếp lót sau", () => {
    const ds = [tau(1, { eta: iso(T("09T00:00")) }), tau(2, { eta: iso(T("09T06:00")), uu_tien: true }), tau(3, { eta: iso(T("10T00:00")) })];
    const kq = xepNhieu(ds, { berths: B1, voyages: [], now }), etb = (id) => new Date(kq.find((x) => x.v.id === id).r.etb).getTime();
    expect(etb(2)).toBeLessThan(etb(1));
    expect(etb(1)).toBeLessThan(etb(3));
    expect(etb(1) - etb(2)).toBeGreaterThanOrEqual(2 * H); // cách tàu trước ≥ 2 giờ
  });
  it("tàu đã chờ lâu (NOR sớm) xếp trước tàu ETA muộn hơn", () => {
    const ds = [tau(1, { eta: iso(T("07T12:00")) }), tau(2, { eta: iso(T("07T20:00")), nor: iso(T("06T00:00")) })];
    const kq = xepNhieu(ds, { berths: B1, voyages: [], now });
    expect(new Date(kq.find((x) => x.v.id === 2).r.etb).getTime()).toBeLessThan(new Date(kq.find((x) => x.v.id === 1).r.etb).getTime());
  });
  it("tàu không bến nào hợp (mớn quá giới hạn) thì r = null, không xếp bừa", () => {
    const kq = xepNhieu([tau(1, { draft: 18.9, dwt: 180000 })], { berths: B1, voyages: [], now });
    expect(kq[0].r).toBeNull();
  });
  it("đã nhập ETB / ETD: giữ nếu bến trống đúng giờ đó", () => {
    const v = tau(1, { etb: iso(T("11T06:00")), etd: iso(T("12T06:00")) });
    const r = tuXepBenGiuMoc(v, { berths: B1, voyages: [], now, doanBen: undefined });
    expect(r.etb).toBe(v.etb); expect(r.etd).toBe(v.etd);
  });
});

describe("Dán nhanh: tàu không bến, không LOA, có cột Loại hàng (Nhóm hàng)", async () => {
  const { tachBang, nhanDienTieuDe, dongThanhChuyen } = await import("./paste");
  it("đọc đúng cột; ô bến / LOA trống thì bỏ qua (để web tự xếp và ước tính)", () => {
    const bang = tachBang("Tên tàu\tBến\tLOA (m)\tDWT\tLoại hàng (Nhóm hàng)\tKhối lượng\tETA\nSEA STAR\t\t\t\tQuặng\t50000\t06/11/2026 08:00");
    const { cot } = nhanDienTieuDe(bang);
    expect(cot).toEqual(["ten_tau", "ben", "loa", "dwt", "loai_hang", "khoi_luong", "eta"]);
    const { v, loi } = dongThanhChuyen(bang[1], cot, { berthOf: () => null, now: T("01T00:00") });
    expect(loi).toEqual([]);
    expect(v).toMatchObject({ ten_tau: "SEA STAR", loai_hang: "Quặng", khoi_luong: 50000 });
    expect(v.ben_ma).toBeUndefined(); expect(v.loa).toBeUndefined();
  });
});
