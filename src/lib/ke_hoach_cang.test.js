// Kiểm thử kế hoạch điều động tàu cập / rời cảng theo biểu mẫu 3 cảng
import { describe, it, expect } from "vitest";
import { datThuTuBen } from "./tenBen";
import { duLieuKeHoachCang, cangCuaBen, nhanBenIn, docPdfKeHoachCang, bookExcelKeHoachCang, CANG } from "./keHoachCang";

const t = (d, h = 0, mi = 0) => new Date(2026, 9, d, h, mi).getTime();
const iso = (...a) => new Date(t(...a)).toISOString();
const TU = t(24, 17), DEN = t(25, 17);

describe("Kế hoạch điều động tàu cập / rời cảng", () => {
  const vs = [
    { id: 1, ten_tau: "HOÀNG PHÚC 36", ben_ma: "2", huong: "xuat", ten_hang: "HRC", draft: 5.78, loa: 79.86, dwt: 4442.8, atb: iso(23, 10), etd: iso(24, 20) },
    { id: 2, ten_tau: "VIỆT THUẬN QN-02", ben_ma: "2", huong: "xuat", ten_hang: "xỉ", draft: 3.5, loa: 79.98, dwt: 6071, etb: iso(24, 20, 30), den_neo: iso(24, 10), etd: iso(26, 8) },
    { id: 3, ten_tau: "TÀU HH", ben_ma: "HH2", huong: "nhap", ten_hang: "đá", draft: 8.2, loa: 149.79, dwt: 23830, etb: iso(25, 4), etd: iso(28, 4) },
    { id: 4, ten_tau: "QUANG VINH 189", ben_ma: "6CTH", huong: "xuat", ten_hang: "HRC", draft: 3.6, loa: 119.9, dwt: 11168, etb: iso(25, 2, 30), etd: iso(27, 4) },
    { id: 5, ten_tau: "NGOÀI KHOẢNG", ben_ma: "5", etb: iso(20, 1), etd: iso(21, 1) },
    { id: 6, ten_tau: "CHƯA XẾP BẾN", ben_ma: null, etb: iso(25, 1), etd: iso(30, 1) },
    { id: 7, ten_tau: "HỦY", ben_ma: "5", etb: iso(25, 1), huy: true },
  ];
  const stopsOf = (id) => (id === 2 ? [{ loai: "shifting", tu: iso(25, 14, 30), den: iso(25, 16), ben_cu: "2", ben_moi: "7" }] : []);
  const du = duLieuKeHoachCang({ voyages: vs, stopsOf, tu: TU, den: DEN });
  it("chia theo cảng của bến", () => {
    expect(cangCuaBen("2")).toBe("hpdq"); expect(cangCuaBen("1A")).toBe("hpdq"); expect(cangCuaBen("HH3")).toBe("hh"); expect(cangCuaBen("7CTH")).toBe("cth"); expect(cangCuaBen(null)).toBe(null);
    expect(nhanBenIn("1A", "hpdq")).toBe("TL"); expect(nhanBenIn("6CTH", "cth")).toBe("6"); expect(nhanBenIn("HH2", "hh")).toBe("HH2");
  });
  it("tàu rời, tàu cập, shifting trong khoảng 17h – 17h", () => {
    const h = du.theoCang.hpdq;
    expect(h.roi.map((r) => [r.ten, r.gio, r.tu, r.den])).toEqual([["HOÀNG PHÚC 36", "24/10/2026 20:00", "2", "PS"]]);
    expect(h.cap.map((r) => [r.ten, r.gio, r.tu, r.den, r.ghiChu])).toEqual([["VIỆT THUẬN QN-02", "24/10/2026 20:30", "NEO", "2", "Xuất xỉ"]]);
    expect(h.shifting.map((r) => [r.ten, r.gio, r.tu, r.den])).toEqual([["VIỆT THUẬN QN-02", "25/10/2026 14:30", "2", "7"]]);
    expect(du.theoCang.hh.cap.map((r) => [r.ten, r.tu, r.den])).toEqual([["TÀU HH", "PS", "HH2"]]);
    expect(du.theoCang.cth.cap.map((r) => [r.ten, r.tu, r.den])).toEqual([["QUANG VINH 189", "PS", "6"]]);
    expect(du.chuaXep).toBe(1);
  });
  it("tàu cập hai bến ghi như mẫu: 7/8, HH2/3", () => {
    const hai = [
      { id: 21, ten_tau: "HAI BẾN", ben_ma: "8", ben_phu: "7", huong: "nhap", ten_hang: "đá", etb: iso(25, 6), etd: iso(28, 6) },
      { id: 22, ten_tau: "HH HAI BẾN", ben_ma: "HH2", ben_phu: "HH3", huong: "xuat", ten_hang: "xỉ", atb: iso(23, 6), etd: iso(25, 2) },
    ];
    datThuTuBen([{ ma: "7", thu_tu: 10 }, { ma: "8", thu_tu: 11 }, { ma: "HH2", thu_tu: 13 }, { ma: "HH3", thu_tu: 14 }]);
    const x = duLieuKeHoachCang({ voyages: hai, tu: TU, den: DEN });
    expect(x.theoCang.hpdq.cap.map((r) => r.den)).toEqual(["7/8"]);
    expect(x.theoCang.hh.roi.map((r) => r.tu)).toEqual(["HH2/3"]);
  });
  it("số liệu định dạng như phiếu mẫu (mớn, dài, trọng tải)", () => {
    const r = du.theoCang.hpdq.roi[0];
    expect([r.mon, r.dai, r.trongTai]).toEqual(["5,78", "79,86", "4.442,80"]);
  });
  it("PDF: mỗi cảng một trang có tiêu đề, ba phần và chỗ ký", () => {
    const doc = docPdfKeHoachCang(du, CANG, "data:image/png;base64,AAAA");
    const chu = JSON.stringify(doc.content);
    expect(chu).toMatch(/KẾ HOẠCH ĐIỀU ĐỘNG TÀU CẬP\/RỜI CẢNG/);
    expect(chu).toMatch(/KẾ HOẠCH ĐIỀU ĐỘNG TÀU CẬP, RỜI CẢNG HÀO HƯNG/);
    expect(chu).toMatch(/I\. TÀU RỜI CẢNG.*II\. TÀU CẬP CẢNG.*III\. TÀU SHIFTING VÀ CẬP MẠN/);
    expect(chu).toMatch(/KT\. GIÁM ĐỐC BP\. LOGISTICS/);
    expect(doc.content.filter((c) => c.pageBreak === "before")).toHaveLength(2);
  });
  it("Excel: mỗi cảng một sheet, đủ dòng", async () => {
    const wb = await bookExcelKeHoachCang(du, CANG, null);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["HPDQ", "HH", "CTH"]);
    const ws = wb.getWorksheet("HPDQ");
    const dong = []; ws.eachRow((r) => dong.push(r.getCell(2).value));
    expect(dong).toContain("HOÀNG PHÚC 36");
    expect(dong.filter((x) => x === "VIỆT THUẬN QN-02")).toHaveLength(2);
  });
});
