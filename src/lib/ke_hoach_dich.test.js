import { describe, it, expect } from "vitest";
import { dichNgay, dichKeHoach, canGhiLaiKeHoach, dauMocKH, docMocKH, khoangLamHang } from "./keHoachNgay";
import { viecBaiTheoTau, DAU_BAI_TAU, tenViecBai } from "./tauDaiHan";

// Kế hoạch ngày và việc bãi DỜI THEO LỊCH TÀU (22/11/2026)
const T = (s) => new Date(s).getTime();
const iso = (s) => new Date(s).toISOString();
const NOW = T("2026-11-01T00:00:00");
const tau = (o = {}) => ({ id: 1, huong: "xuat", ten_tau: "T", khoi_luong: 30000, kl_tra: 0, atb: iso("2026-11-10T08:00:00"), bd_lam_hang: iso("2026-11-10T12:00:00"), kt_lam_hang: iso("2026-11-12T12:00:00"), ...o });
const tong = (m) => [...m.values()].reduce((s, x) => s + x, 0);

describe("dichNgay: chia lại khối lượng theo tỉ lệ thời gian", () => {
  const cu = { a: T("2026-11-10T12:00:00"), b: T("2026-11-12T12:00:00") };
  it("dời đúng 2 ngày: các ngày dời nguyên", () => {
    const moi = { a: cu.a + 2 * 864e5, b: cu.b + 2 * 864e5 };
    const m = dichNgay(new Map([["2026-11-10", 7500], ["2026-11-11", 15000], ["2026-11-12", 7500]]), cu, moi);
    expect([...m]).toEqual([["2026-11-12", 7500], ["2026-11-13", 15000], ["2026-11-14", 7500]]);
  });
  it("dời nửa ngày: mỗi ngày chia đôi cho hai ngày kề, tổng giữ nguyên", () => {
    const moi = { a: cu.a + 12 * 36e5, b: cu.b + 12 * 36e5 };
    const m = dichNgay(new Map([["2026-11-11", 15000]]), cu, moi);
    expect(m.get("2026-11-11")).toBe(7500); expect(m.get("2026-11-12")).toBe(7500);
  });
  it("kéo dài gấp đôi: khối lượng trải rộng ra, tổng không đổi", () => {
    const moi = { a: cu.a, b: cu.a + 4 * 864e5 };
    const m = dichNgay(new Map([["2026-11-10", 7500], ["2026-11-11", 15000], ["2026-11-12", 7500]]), cu, moi);
    expect(tong(m)).toBe(30000);
    expect([...m.keys()].length).toBeGreaterThanOrEqual(5);
  });
  it("ngày xuất trước khi cập dời theo giờ bắt đầu", () => {
    const moi = { a: cu.a + 864e5, b: cu.b + 864e5 };
    const m = dichNgay(new Map([["2026-11-09", 4000]]), cu, moi);
    expect([...m]).toEqual([["2026-11-10", 4000]]);
  });
  it("tấn lẻ giữ 2 số lẻ và tổng không lệch", () => {
    const moi = { a: cu.a + 5 * 36e5, b: cu.b + 5 * 36e5 };
    const m = dichNgay(new Map([["2026-11-10", 1000.5], ["2026-11-11", 333.33]]), cu, moi);
    expect(Math.round(tong(m) * 100) / 100).toBe(1333.83);
  });
});

describe("dichKeHoach: dời theo lịch tàu hiện tại", () => {
  const v0 = tau();
  const dau = dauMocKH(v0);
  const rows = [{ voyage_id: 1, ngay: "2026-11-10", khoi_luong: 7500, ghi_chu: dau }, { voyage_id: 1, ngay: "2026-11-11", khoi_luong: 15000, ghi_chu: dau }, { voyage_id: 1, ngay: "2026-11-12", khoi_luong: 7500, ghi_chu: dau }];
  it("dấu mốc đọc lại đúng khoảng làm hàng", () => {
    const k = khoangLamHang(v0), m = docMocKH(dau);
    expect(m.a).toBe(Math.round(k.a)); expect(m.b).toBe(Math.round(k.b));
  });
  it("lịch không đổi: giữ nguyên", () => {
    const { rows: r, doi } = dichKeHoach(rows, new Map([[1, v0]]), NOW);
    expect(doi.size).toBe(0); expect(r.map((x) => x.khoi_luong).sort()).toEqual([15000, 7500, 7500]);
  });
  it("tàu dời 2 ngày: khối lượng dời 2 ngày, tổng không đổi", () => {
    const v1 = tau({ atb: iso("2026-11-12T08:00:00"), bd_lam_hang: iso("2026-11-12T12:00:00"), kt_lam_hang: iso("2026-11-14T12:00:00") });
    const { rows: r, doi } = dichKeHoach(rows, new Map([[1, v1]]), NOW);
    expect(doi.has(1)).toBe(true);
    expect(Object.fromEntries(r.map((x) => [x.ngay, x.khoi_luong]))).toEqual({ "2026-11-12": 7500, "2026-11-13": 15000, "2026-11-14": 7500 });
    expect(r.every((x) => docMocKH(x.ghi_chu).a === T("2026-11-12T12:00:00"))).toBe(true);
  });
  it("tàu đã rời bến: không dời", () => {
    const v1 = tau({ atb: iso("2026-11-12T08:00:00"), bd_lam_hang: iso("2026-11-12T12:00:00"), kt_lam_hang: iso("2026-11-14T12:00:00"), atd: iso("2026-11-15T08:00:00") });
    const { rows: r, doi } = dichKeHoach(rows, new Map([[1, v1]]), NOW);
    expect(doi.size).toBe(0); expect(r.map((x) => x.ngay).sort()).toEqual(["2026-11-10", "2026-11-11", "2026-11-12"]);
  });
  it("dòng chưa có dấu mốc: giữ nguyên, và được gắn dấu khi ghi lại", () => {
    const cu = rows.map((x) => ({ ...x, ghi_chu: null }));
    const { rows: r, doi } = dichKeHoach(cu, new Map([[1, v0]]), NOW);
    expect(doi.size).toBe(0); expect(r.length).toBe(3);
    const { ops } = canGhiLaiKeHoach(cu, new Map([[1, v0]]), NOW);
    expect(ops.length).toBe(3); expect(ops.every((o) => o.ghi_chu === dau)).toBe(true);
  });
  it("ghi lại: xóa ngày cũ không còn, ghi các ngày mới kèm dấu mốc mới", () => {
    const v1 = tau({ atb: iso("2026-11-12T08:00:00"), bd_lam_hang: iso("2026-11-12T12:00:00"), kt_lam_hang: iso("2026-11-14T12:00:00") });
    const { ops } = canGhiLaiKeHoach(rows, new Map([[1, v1]]), NOW);
    const xoa = ops.filter((o) => o.khoi_luong == null).map((o) => o.ngay), ghi = ops.filter((o) => o.khoi_luong != null).map((o) => o.ngay);
    expect(xoa.sort()).toEqual(["2026-11-10", "2026-11-11"]); // 12/11 còn dùng nên chỉ ghi đè, không xóa
    expect(ghi.sort()).toEqual(["2026-11-12", "2026-11-13", "2026-11-14"]);
    expect(ops.filter((o) => o.khoi_luong != null).every((o) => o.ghi_chu === dauMocKH(v1))).toBe(true);
  });
});

describe("viecBaiTheoTau: việc bãi chạy theo tàu", () => {
  // Tàu ở bến từ 10/11 08:00 đến 12/11 20:00; doanBen giả lập trả đúng khoảng đó
  const khoang = (a, b) => (v) => (v.id === 7 ? [{ a: T(a), b: T(b) }] : []);
  const job = (o = {}) => ({ id: 5, loai: "bai", ten: "TÀU A - HRC - 30.000 t", doi: "Xúc đào", xe_ngay: 6, xe_dem: 6, tu: iso("2026-11-10T08:00:00"), den: iso("2026-11-12T20:00:00"), tu_ngay: "2026-11-10", den_ngay: "2026-11-12", ghi_chu: DAU_BAI_TAU + "7", ...o });
  const ctx = (a, b) => ({ voyages: [{ id: 7 }], now: NOW, tauLT: [], caMs: 12 * 36e5, doanBen: khoang(a, b) });
  it("tàu dời 1 ngày: mốc giờ việc bãi dời theo", () => {
    const r = viecBaiTheoTau(job(), ctx("2026-11-11T08:00:00", "2026-11-13T20:00:00"));
    expect(new Date(r.tu).getTime()).toBe(T("2026-11-11T08:00:00")); expect(new Date(r.den).getTime()).toBe(T("2026-11-13T20:00:00"));
    expect(r.tu_ngay).toBe("2026-11-11"); expect(r.theoTau).toBe("7"); expect(r.daDoi).toBe(true);
  });
  it("số xe sửa tay từng ca dời đúng số ca", () => {
    const ca = { [iso("2026-11-10T08:00:00")]: 3, [iso("2026-11-10T20:00:00")]: 4 };
    const r = viecBaiTheoTau(job({ so_xe_doi: { ca } }), ctx("2026-11-11T08:00:00", "2026-11-13T20:00:00")); // dời 2 ca
    expect(r.so_xe_doi.ca[iso("2026-11-11T08:00:00")]).toBe(3); expect(r.so_xe_doi.ca[iso("2026-11-11T20:00:00")]).toBe(4);
  });
  it("lịch tàu không đổi: không dời", () => {
    const r = viecBaiTheoTau(job(), ctx("2026-11-10T08:00:00", "2026-11-12T20:00:00"));
    expect(r.daDoi).toBe(false); expect(r.tu).toBe(iso("2026-11-10T08:00:00"));
  });
  it("việc không gắn tàu thì giữ nguyên", () => {
    const j = job({ ghi_chu: null, ten: "Việc khác" });
    expect(viecBaiTheoTau(j, ctx("2026-11-11T08:00:00", "2026-11-13T20:00:00"))).toBe(j);
  });
  it("việc cũ chưa có dấu: nhận lại theo tên tàu - hàng - khối lượng", () => {
    const ten = tenViecBai("TÀU A", "HRC", 30000);
    const c = { ...ctx("2026-11-11T08:00:00", "2026-11-13T20:00:00"), tauLT: [{ lt: 7, ten: "TÀU A", hang: "HRC", khoi_luong: 30000 }] };
    const r = viecBaiTheoTau(job({ ghi_chu: null, ten }), c);
    expect(r.theoTau).toBe("7"); expect(r.tu_ngay).toBe("2026-11-11");
  });
  it("tàu không có mốc ở bến: giữ nguyên", () => {
    const j = job();
    expect(viecBaiTheoTau(j, { ...ctx("2026-11-11T08:00:00", "2026-11-13T20:00:00"), doanBen: () => [] })).toBe(j);
  });
});
