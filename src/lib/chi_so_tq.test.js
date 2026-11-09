// Kiểm thử bộ chỉ số Tổng quan (chiSoTQ.js)
import { describe, it, expect } from "vitest";
import { tienDoSanLuong, chiSoCauBen, tauTheoNgay, chiSoThietBi, taoVanDe, doiSoVoi, tone } from "./chiSoTQ";
import { khoangKy, kyTruoc, kySau } from "./bieuDoSanLuong";

const T = (s) => new Date(`2026-11-${s}:00+07:00`).getTime();
const iso = (t) => new Date(t).toISOString();
const H = 36e5;

describe("Kỳ xem", () => {
  it("kỳ trước / sau cùng loại, có tu / den", () => {
    const k = khoangKy("thang", "2026-11-09", "2026-11-09");
    expect(k.ngays.length).toBe(30);
    expect(kyTruoc(k).ngays[0]).toBe("2026-10-01"); expect(kyTruoc(k).ngays.length).toBe(31);
    expect(kySau(k).ngays[0]).toBe("2026-12-01");
    expect(k.den - k.tu).toBe(30 * 864e5);
    const q = khoangKy("quy", "2026-11-09"); expect(kyTruoc(q).nhan).toBe("Quý 3/2026");
    expect(kyTruoc(khoangKy("nam", "2026-11-09")).ngays.length).toBe(365);
    // hôm nay giữ nguyên khi lùi kỳ
    expect(kyTruoc(k).homNay).toBe("2026-11-09");
  });
});

describe("Sản lượng", () => {
  const k = khoangKy("thang", "2026-11-10", "2026-11-11"); // 30 ngày, đã khép sổ 10 ngày (hôm nay 11/11)
  it("tiến độ, cần đạt mỗi ngày, dự báo", () => {
    const td = tienDoSanLuong({ tongMt: 300000, tongTt: 80000 }, k);
    expect(td.mtDen).toBe(100000); expect(td.lech).toBe(-20000); expect(td.tienDo).toBeCloseTo(0.8);
    expect(td.duBao).toBe(240000); expect(td.duBaoDat).toBeCloseTo(0.8);
    expect(td.canMoiNgay).toBe(11000); expect(td.nangSuat).toBe(8000);
    expect(td.tone).toBe("bad");
  });
  it("kịp tiến độ thì xanh; chưa bắt đầu không tô; kỳ xong xét % đạt", () => {
    expect(tienDoSanLuong({ tongMt: 300000, tongTt: 100000 }, k).tone).toBe("ok");
    expect(tienDoSanLuong({ tongMt: 300000, tongTt: 0 }, khoangKy("thang", "2026-12-05", "2026-11-10")).tone).toBeNull();
    // hôm nay là ngày đầu kỳ: chưa có ngày nào khép sổ nên chưa tô màu
    expect(tienDoSanLuong({ tongMt: 300000, tongTt: 0 }, khoangKy("tuan", "2026-11-09", "2026-11-09")).tone).toBeNull();
    // nhập dở hôm nay không làm sai nhịp: 10 ngày đã khép 80.000 t, hôm nay mới nhập thêm 5.000 t
    const dd = tienDoSanLuong({ tongMt: 300000, tongTt: 85000 }, k, 80000);
    expect(dd.nangSuat).toBe(8000); expect(dd.duBao).toBe(240000); expect(dd.canMoiNgay).toBe(10750);
    const xong = tienDoSanLuong({ tongMt: 1000, tongTt: 950 }, khoangKy("thang", "2026-10-05", "2026-11-10"));
    expect(xong.xong).toBe(true); expect(xong.tone).toBe("warn"); expect(xong.canMoiNgay).toBeNull();
  });
  it("so với kỳ trước", () => { expect(doiSoVoi(120, 100)).toBeCloseTo(0.2); expect(doiSoVoi(5, 0)).toBeNull(); });
  it("tone theo ngưỡng cao / thấp", () => { expect(tone(0.8, 0.85, 0.7)).toBe("warn"); expect(tone(30, 12, 24, false)).toBe("bad"); });
});

describe("Cầu bến", () => {
  const berths = [{ ma: "B07" }, { ma: "B08" }];
  const tu = T("01T00:00"), den = T("11T00:00"), now = T("06T00:00");
  const vs = [
    { id: 1, ten_tau: "A", ben_ma: "B07", eta: iso(T("01T00:00")), nor: iso(T("01T00:00")), atb: iso(T("01T12:00")), atd: iso(T("03T12:00")), etb: iso(T("01T12:00")), etd: iso(T("03T12:00")) },
    { id: 2, ten_tau: "B", ben_ma: "B07", eta: iso(T("04T00:00")), nor: iso(T("04T00:00")), atb: iso(T("04T06:00")), etb: iso(T("04T06:00")), etd: iso(T("08T06:00")), bd_lam_hang: iso(T("04T08:00")) },
    { id: 3, ten_tau: "C", eta: iso(T("05T00:00")), nor: iso(T("05T00:00")), etb: iso(T("07T00:00")), etd: iso(T("09T00:00")) },
    { id: 4, ten_tau: "D", eta: iso(T("08T00:00")) },
  ];
  it("BOR = giờ chiếm bến / (số bến × giờ đã qua); chờ bến, tàu ở bến", () => {
    const c = chiSoCauBen({ voyages: vs, berths, tu, den, now });
    // B07: A 01T12→03T12 (48h) + B 04T06→06T00 (42h) = 90h / 120h; B08: 0
    expect(c.theoBen[0].bor).toBeCloseTo(90 / 120, 3); expect(c.theoBen[1].bor).toBeCloseTo(0);
    expect(c.bor).toBeCloseTo(90 / 240, 3);
    expect(c.choTB).toBeCloseTo((12 + 6) / 2); expect(c.choMax).toBe(12);
    expect(c.oBenTB).toBe(48); expect(c.soTauRoi).toBe(1);
    expect(c.dangO).toBe(1); expect(c.dangCho).toBe(1); expect(c.choLau[0].v.ten_tau).toBe("C"); expect(Math.round(c.choLau[0].gio)).toBe(24);
    expect(c.sapDen).toBe(1); expect(c.capTrongKy).toBe(3); expect(c.roiTrongKy).toBe(3);
    expect(c.capDen).toBe(2); expect(c.roiDen).toBe(1); // chỉ tính đến hiện tại (06/11)
  });
  it("hai tàu chồng giờ cùng bến chỉ tính một lần (hợp đoạn)", () => {
    const hai = [{ id: 1, ben_ma: "B07", eta: iso(T("01T00:00")), etb: iso(T("01T00:00")), etd: iso(T("03T00:00")) }, { id: 2, ben_ma: "B07", eta: iso(T("02T00:00")), etb: iso(T("02T00:00")), etd: iso(T("04T00:00")) }];
    const c = chiSoCauBen({ voyages: hai, berths, tu, den, now });
    expect(c.theoBen[0].bor).toBeCloseTo(72 / 120, 3);
  });
  it("kỳ chưa bắt đầu: BOR thực tế rỗng, có BOR cả kỳ theo kế hoạch", () => {
    const c = chiSoCauBen({ voyages: vs, berths, tu: T("20T00:00"), den: T("30T00:00"), now });
    expect(c.bor).toBeNull();
  });
  it("xu hướng tàu theo ngày", () => {
    const r = tauTheoNgay({ voyages: vs, ngays: ["2026-11-02", "2026-11-05"], now });
    expect(r[0].oBen).toBe(1); expect(r[1].oBen).toBe(1); expect(r[1].cho).toBe(1);
  });
});

describe("Thiết bị", () => {
  const xe = [{ ma: "X1" }, { ma: "X2" }, { ma: "X3" }, { ma: "X4" }];
  const events = [
    { ma_xe: "X1", loai: "Hỏng", ngay_vao: "2026-11-02", ngay_xong: "2026-11-05" },
    { ma_xe: "X2", loai: "Hỏng", ngay_vao: "2026-11-04", ngay_xong: null },
    { ma_xe: "X3", loai: "BD định kỳ", ngay_vao: "2026-11-03", ngay_xong: "2026-11-04" },
    { ma_xe: "X9", loai: "Hỏng", ngay_vao: "2026-11-03", ngay_xong: null },
  ];
  const ngays = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
  it("sẵn sàng bình quân kỳ, số lần hỏng, MTTR, xe-ngày dừng", () => {
    const m = chiSoThietBi({ vehicles: xe, events, ngays, homNay: "2026-11-07" });
    // đến 07/11: X1 dừng 02–04 (3 ngày; 05 đã xong), X2 dừng 04–07 (4 ngày) => 7 xe-ngày / 7 ngày
    expect(m.dungXeNgay).toBe(7); expect(m.rateTB).toBeCloseTo(1 - 7 / 28, 4);
    expect(m.rateHT).toBeCloseTo(0.75);
    expect(m.soLanHong).toBe(2); expect(m.mttr).toBe(3); expect(m.soDaSua).toBe(1);
  });
});

describe("Vấn đề cần xử lý", () => {
  it("xếp đỏ trước vàng, bỏ chỉ số tốt", () => {
    const k = khoangKy("thang", "2026-11-10", "2026-11-11");
    const ds = taoVanDe({
      sl: [{ ten: "Cảng", td: tienDoSanLuong({ tongMt: 300000, tongTt: 95000 }, k) }, { ten: "Vận tải", td: tienDoSanLuong({ tongMt: 100000, tongTt: 40000 }, k) }],
      cb: { bor: 0.9, choTB: 30, choMax: 40, choLau: [{ v: { id: 9, ten_tau: "X" }, gio: 60 }] },
      kho: { lap: 0.96, baiVuot: 1, ngayCapThap: 0, tonLau: 0, tong: 100 },
      tbi: [{ ten: "Xe", m: { rateHT: 0.6, n: 10 } }],
    });
    expect(ds[0].muc).toBe("bad");
    expect(ds.findIndex((x) => x.muc === "warn")).toBeGreaterThan(ds.map((x) => x.muc).lastIndexOf("bad"));
    expect(ds.some((x) => x.nd.includes("Vận tải"))).toBe(false);
    expect(ds.some((x) => x.dich?.voyage === 9)).toBe(true);
  });
});
