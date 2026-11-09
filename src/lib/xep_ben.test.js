import { describe, it, expect } from "vitest";
import { uocThongSo, thoiGianLam, mocDuKien, viTriHang, khopLoaiHang } from "./xepBen";
import { trangThai, laUoc } from "./linetime";
import { tuXepBen, canTuXep } from "./tuXep";

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
  it("không đủ số mét để cùng lúc thì chờ tàu trước rời + 2 giờ", () => {
    const khac = { id: 2, ben_ma: "B07", loa: 150, etb: iso(T("09T00:00")), etd: iso(T("10T00:00")) };
    const v = { id: 1, eta: iso(T("09T06:00")), loai_hang: "Đá", khoi_luong: 9000, cam_ket: 9000 };
    const r = tuXepBen(v, { berths: BEN, voyages: [khac], now: T("08T00:00") });
    expect(["B07", "B08"]).toContain(r.ben_ma);
    expect(new Date(r.etb).getTime()).toBe(T("10T02:00")); // tàu kia rời 10/11 00:00 + 2 giờ
    expect(new Date(r.etd).getTime() - T("10T02:00")).toBe(H + 24 * H + 2.5 * H);
  });
  it("đủ số mét thì cùng bến cùng lúc: bến B10 dài 410 m, tàu 100 m đang ở bến, tàu 125 m vào ngay theo ETA", () => {
    const khac = { id: 2, ben_ma: "B10", loa: 100, etb: iso(T("09T00:00")), etd: iso(T("11T00:00")) };
    const v = { id: 1, eta: iso(T("09T06:00")), loai_hang: "Than", khoi_luong: 9000, cam_ket: 9000, dwt: 10000, loa: 125, draft: 8 };
    const r = tuXepBen(v, { berths: BEN, voyages: [khac], now: T("08T00:00") });
    expect(r.ben_ma).toBe("B10");
    expect(new Date(r.etb).getTime()).toBe(T("09T06:00"));
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
  const { xepNhieu, tuXepBenGiuMoc } = await import("./tuXep");
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

describe("Hàng chờ và giữ bến đã khai báo (09/11)", async () => {
  const { tuXepBen: xep1, xepLai } = await import("./tuXep");
  const iso = (t) => new Date(t).toISOString();
  const B1 = [{ ma: "B10", dwt_max: 250000, mon_max: 18.5, loa_max: 410, loai_hang: "Than, Quặng", thu_tu: 1 }];
  const now = T("08T00:00");
  const tau = (id, o) => ({ id, loai_hang: "Than", khoi_luong: 20000, cam_ket: 20000, dwt: 60000, loa: 300, draft: 12, eta: iso(T("09T00:00")), ...o });
  it("tàu đến sau xếp lót sau tàu đã xếp (có chỗ trống trước tàu đó cũng không chen)", () => {
    const truoc = tau(2, { ben_ma: "B10", eta: iso(T("09T00:00")), etb: iso(T("12T00:00")), etd: iso(T("13T00:00")) }); // đến trước nhưng cập muộn
    const sau = tau(1, { eta: iso(T("10T00:00")), khoi_luong: 5000, cam_ket: 20000 });
    const r = xep1(sau, { berths: B1, voyages: [truoc], now });
    expect(new Date(r.etb).getTime()).toBeGreaterThanOrEqual(T("12T00:00"));
  });
  it("tàu đến trước tàu đã xếp thì vẫn chen vào chỗ trống trước nó", () => {
    const sau = tau(2, { ben_ma: "B10", eta: iso(T("12T00:00")), etb: iso(T("12T00:00")), etd: iso(T("13T00:00")) });
    const truoc = tau(1, { eta: iso(T("09T00:00")), khoi_luong: 5000, cam_ket: 20000 });
    const r = xep1(truoc, { berths: B1, voyages: [sau], now });
    expect(new Date(r.etb).getTime()).toBe(T("09T00:00"));
  });
  it("tàu ưu tiên ★ đã xếp: tàu thường đến sau không cập trước nó", () => {
    const uu = tau(2, { uu_tien: true, ben_ma: "B10", eta: iso(T("11T00:00")), etb: iso(T("11T00:00")), etd: iso(T("12T00:00")) });
    const thuong = tau(1, { eta: iso(T("09T00:00")), khoi_luong: 5000 });
    expect(new Date(xep1(thuong, { berths: B1, voyages: [uu], now }).etb).getTime()).toBeGreaterThanOrEqual(T("11T00:00"));
  });
  it("chuyến đã khai báo bến: giữ nguyên bến khi xếp lại, chỉ đổi giờ", () => {
    const B2 = [...B1, { ma: "B05", dwt_max: 150000, mon_max: 14.7, loa_max: 300, loai_hang: "Than, Quặng", thu_tu: 2 }];
    const a = tau(1, { ben_ma: "B10", etb: iso(T("09T00:00")), etd: iso(T("10T06:00")) });
    const b = tau(2, { ben_ma: "B10", eta: iso(T("09T06:00")), etb: iso(T("11T00:00")), etd: iso(T("12T06:00")) });
    const kq = xepLai([a, b], { berths: B2, now });
    expect(kq.map((x) => x.r.ben_ma)).toEqual(["B10", "B10"]);
  });
  it("chuyến chưa có bến vẫn được chọn bến", () => {
    const r = xep1(tau(1, {}), { berths: B1, voyages: [], now });
    expect(r.ben_ma).toBe("B10");
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

describe("Xếp lại toàn bộ", async () => {
  const { xepLai } = await import("./tuXep");
  const iso = (t) => new Date(t).toISOString();
  const B1 = [{ ma: "B10", dwt_max: 250000, mon_max: 18.5, loa_max: 410, loai_hang: "Than, Quặng", thu_tu: 1 }];
  const now = T("08T00:00");
  const tau = (id, o) => ({ id, loai_hang: "Than", khoi_luong: 20000, cam_ket: 20000, dwt: 60000, loa: 300, draft: 12, eta: iso(T("09T00:00")), ben_ma: "B10", ...o });
  it("tàu ưu tiên ★ được xếp trước tàu đang xếp trước nó; tàu đã cập thật không bị đụng", () => {
    const cap = tau(9, { atb: iso(T("07T00:00")), etb: iso(T("07T00:00")), etd: iso(T("08T12:00")), eta: iso(T("06T00:00")) });
    const a = tau(1, { etb: iso(T("09T00:00")), etd: iso(T("10T06:00")) });
    const b = tau(2, { uu_tien: true, eta: iso(T("09T06:00")), etb: iso(T("11T00:00")), etd: iso(T("12T06:00")) });
    const kq = xepLai([cap, a, b], { berths: B1, now }), moi = (id) => kq.find((x) => x.v.id === id);
    expect(kq.find((x) => x.v.id === 9)).toBeUndefined();
    expect(new Date(moi(2).r.etb).getTime()).toBeLessThan(new Date(moi(1).r.etb).getTime());
    expect(moi(2).doi).toBe(true);
  });
  it("tick giữ nguyên: chuyến đó giữ chỗ cũ, các chuyến khác xếp quanh", () => {
    const a = tau(1, { etb: iso(T("09T00:00")), etd: iso(T("10T06:00")) });
    const b = tau(2, { eta: iso(T("09T06:00")), etb: iso(T("11T00:00")), etd: iso(T("12T06:00")) });
    const kq = xepLai([a, b], { berths: B1, now }, new Set([1]));
    expect(kq.map((x) => x.v.id)).toEqual([2]);
    expect(new Date(kq[0].r.etb).getTime()).toBeGreaterThanOrEqual(new Date(T("10T06:00")).getTime() + 2 * H);
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
  it("bến TL không làm xỉ thép; B03, B07 có", () => {
    const TL = { loai_hang: "Thép thành phẩm, HRC, Phế bánh, Hàng bao, Phôi vuông" }, B03 = { loai_hang: "HRC, Quặng hồi, Xỉ thép, Thạch cao nhân tạo" };
    const v = { loai_hang: "Xỉ thép", ten_hang: "Xỉ thép cấp phối SS10" };
    expect(viTriHang(v, TL)).toBe(-1);
    expect(viTriHang(v, B03)).toBe(2);
  });
});

describe("Giải trùng bến (10/11): không đủ mét mà chồng giờ thì tàu sau tự lùi", async () => {
  const { giaiTrung, xepNhieu } = await import("./tuXep");
  const { choBenTheoChuyen } = await import("./capBen");
  const iso = (t) => new Date(t).toISOString();
  const now = T("08T00:00");
  const B3 = [
    { ma: "B07", dwt_max: 20000, mon_max: 9, loa_max: 180, loai_hang: "Đá, Xỉ", thu_tu: 8 },
    { ma: "B08", dwt_max: 20000, mon_max: 9, loa_max: 126.5, loai_hang: "Đá, Xỉ", thu_tu: 9 },
    { ma: "B09", dwt_max: 20000, mon_max: 9, loa_max: 126.5, loai_hang: "Đá, Xỉ", thu_tu: 10 },
  ];
  const tau = (id, o) => ({ id, ten_tau: "T" + id, loai_hang: "Đá", khoi_luong: 4000, cam_ket: 4000, dwt: 5000, loa: 110, draft: 6, eta: iso(T("09T00:00")), ben_ma: "B07", ...o });
  const xung = (vs) => [...choBenTheoChuyen(vs, B3, () => [], now).keys()];
  const ap = (vs, doi) => vs.map((v) => { const d = doi.find((x) => x.v.id === v.id); return d ? { ...v, etb: d.etb, etd: d.etd } : v; });
  it("hai tàu 110 m cùng bến B07 (180 m) chồng giờ: tàu đến sau lùi tới sau tàu trước + 2 giờ", () => {
    const a = tau(1, { etb: iso(T("09T00:00")), etd: iso(T("10T00:00")) });
    const b = tau(2, { eta: iso(T("09T06:00")), etb: iso(T("09T12:00")), etd: iso(T("10T12:00")) });
    expect(xung([a, b]).length).toBeGreaterThan(0);
    const doi = giaiTrung([a, b], { berths: B3, now });
    expect(doi.map((x) => x.v.id)).toEqual([2]);
    expect(new Date(doi[0].etb).getTime()).toBeGreaterThanOrEqual(T("10T02:00"));
    expect(new Date(doi[0].etd).getTime() - new Date(doi[0].etb).getTime()).toBe(T("10T12:00") - T("09T12:00")); // giữ thời gian ở bến
    expect(xung(ap([a, b], doi))).toEqual([]);
  });
  it("tàu đã cập thật (ATB) không bị dời, dù đến sau: tàu kia lùi", () => {
    const a = tau(1, { eta: iso(T("09T12:00")), atb: iso(T("09T12:00")), etb: iso(T("09T12:00")), etd: iso(T("10T12:00")) });
    const b = tau(2, { eta: iso(T("09T00:00")), etb: iso(T("09T18:00")), etd: iso(T("10T18:00")) });
    const doi = giaiTrung([a, b], { berths: B3, now });
    expect(doi.map((x) => x.v.id)).toEqual([2]);
  });
  it("đủ mét (hai tàu 60 m ở bến 180 m) thì không lùi", () => {
    const a = tau(1, { loa: 60, etb: iso(T("09T00:00")), etd: iso(T("10T00:00")) });
    const b = tau(2, { loa: 60, etb: iso(T("09T06:00")), etd: iso(T("10T06:00")) });
    expect(xung([a, b])).toEqual([]);
    expect(giaiTrung([a, b], { berths: B3, now })).toEqual([]);
  });
  it("ngẫu nhiên: nhiều tàu nhập tay chồng giờ, sau giải trùng không còn tàu nào thiếu mét", () => {
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let lan = 0; lan < 25; lan++) {
      const vs = Array.from({ length: 12 }, (_, i) => {
        const etb = T("09T00:00") + Math.floor(rnd() * 96) * H, loa = 50 + Math.floor(rnd() * 50);
        return tau(i + 1, { ben_ma: ["B07", "B08", "B09"][Math.floor(rnd() * 3)], loa, eta: iso(etb - Math.floor(rnd() * 20) * H), uu_tien: rnd() < 0.15, etb: iso(etb), etd: iso(etb + (12 + Math.floor(rnd() * 40)) * H) });
      });
      const doi = giaiTrung(vs, { berths: B3, now });
      expect(xung(ap(vs, doi))).toEqual([]);
      expect(giaiTrung(ap(vs, doi), { berths: B3, now })).toEqual([]); // chạy lại không đổi nữa
    }
  });
  it("tự xếp nhiều chuyến chưa bến: kết quả không thiếu mét", () => {
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let lan = 0; lan < 15; lan++) {
      const ds = Array.from({ length: 10 }, (_, i) => tau(i + 1, { ben_ma: null, loa: 50 + Math.floor(rnd() * 50), eta: iso(T("09T00:00") + Math.floor(rnd() * 72) * H), uu_tien: rnd() < 0.2 }));
      const kq = xepNhieu(ds, { berths: B3, voyages: [], now });
      const vs = kq.filter((x) => x.r).map(({ v, r }) => ({ ...v, ben_ma: r.ben_ma, etb: r.etb, etd: r.etd }));
      expect(xung(vs)).toEqual([]);
    }
  });
});
