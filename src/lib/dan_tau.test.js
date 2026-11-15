import { describe, it, expect } from "vitest";
import { COT_TAU, nhanDienBang, docSoTan, tachDanhSach, docNgayTau, docDongTau, cotThieu } from "./danTau";
import { tachBang } from "./paste";
import { tanK } from "./format";

const berths = [{ ma: "TL", ten_khac: [] }, { ma: "B01", ten_khac: ["1"] }];
const berthOf = (x) => berths.find((b) => [b.ma, ...b.ten_khac].some((t) => t.toLowerCase() === String(x).toLowerCase())) || null;
const ctx = { berthOf, now: new Date(2026, 10, 14).getTime(), nhomCua: (t) => (/hrc/i.test(t) ? "HRC" : null) };
const TD = COT_TAU.map((c) => c.ten).join("\t");
const dong = (o) => { const { cot } = nhanDienBang(tachBang(`${TD}\n`)); const m = Object.fromEntries(COT_TAU.map((c) => [c.k, ""])); Object.assign(m, o); return docDongTau(COT_TAU.map((c) => m[c.k]), cot.length ? cot : COT_TAU.map((c) => c.k), ctx); };
const HOP_LE = { ben: "TL", ten_tau: "PHƯƠNG BÁCH 12", draft: "4.78", loa: "79.96", dwt: "3,558", hang_xuat: "Phôi vuông, thép cuộn", khoi_luong: "3,500", cam_ket: "CQD", eta: "12/11/2026 16:00", etb: "14/11/2026", etd: "15/11/2026" };

describe("Dán nhanh bảng tàu (form mẫu)", () => {
  it("nhận tiêu đề theo bảng mẫu, kể cả Kho-Bãi / PT. Kho Bãi / DEM/day", () => {
    const { coTieuDe, cot } = nhanDienBang([COT_TAU.map((c) => c.ten)]);
    expect(coTieuDe).toBe(true);
    expect(cot).toEqual(COT_TAU.map((c) => c.k));
  });
  it("đọc số kiểu Excel: 3,500 = 3.500; 4.78 là thập phân", () => {
    expect(docSoTan("3,500")).toBe(3500);
    expect(docSoTan("1,234,567")).toBe(1234567);
    expect(docSoTan("4.500")).toBe(4500);
    expect(docSoTan("TBA")).toBeNull();
    expect(docSoTan("")).toBeNull();
  });
  it("tách danh sách theo dấu phẩy / cộng / chấm phẩy; số sau dấu gạch ngang là khối lượng", () => {
    expect(tachDanhSach("Cán 1-1221, Cán 2-1000; Cán 3 - 1000 + HRC")).toEqual([
      { ten: "Cán 1", tenDayDu: "Cán 1-1221", so: 1221, chu: "" }, { ten: "Cán 2", tenDayDu: "Cán 2-1000", so: 1000, chu: "" }, { ten: "Cán 3", tenDayDu: "Cán 3 - 1000", so: 1000, chu: "" }, { ten: "HRC", tenDayDu: "HRC", so: null, chu: "" }]);
    expect(tachDanhSach("Bãi A-hết")[0]).toMatchObject({ ten: "Bãi A", so: null, chu: "hết" });
    expect(tachDanhSach("Bãi B-2k")[0].so).toBe(2000); // 1k = 1000 t
    expect(tachDanhSach("Đá 45-100mm")[0]).toMatchObject({ so: null, chu: "100mm" }); // "100mm" không phải khối lượng
  });
  it("ETA 18-19/11/2026 lấy ngày sau dấu gạch ngang; ngày sai thì báo lỗi", () => {
    const d = docNgayTau("18-19/11/2026", { khoangNgay: true });
    expect(new Date(d.iso).getDate()).toBe(19);
    expect(docNgayTau("18-19/11/2026").loi).toBe(true); // chỉ ETA mới có kiểu khoảng ngày
    expect(docNgayTau("sắp tới").loi).toBe(true);
    expect(docNgayTau("").trong).toBe(true);
  });
  it("dòng hợp lệ: hàng xuất nhiều tên, khối lượng, cam kết CQD", () => {
    const { v, loi } = dong(HOP_LE);
    expect(loi).toEqual([]);
    expect(v).toMatchObject({ ten_tau: "PHƯƠNG BÁCH 12", ben_ma: "TL", huong: "xuat", khoi_luong: 3500, dwt: 3558, draft: 4.78, loa: 79.96, kieu_tp: "cqd", ten_hang: "Phôi vuông; thép cuộn" });
    expect(v.hang_ds).toHaveLength(2);
  });
  it("Kho-Bãi và PT: số sau gạch ngang là khối lượng", () => {
    const { v } = dong({ ...HOP_LE, kho_bai: "Cán 1-1221, Cán 2-1000", pt_van_chuyen: "Toa Tàu", pt_kho_bai: "Cầu trục, cầu bãi" });
    expect(v.bai_kl).toEqual([{ bai: "Cán 1", khu: null, khoi_luong: 1221 }, { bai: "Cán 2", khu: null, khoi_luong: 1000 }]);
    expect(v.pt_van_chuyen).toEqual([{ ten: "Toa Tàu", gia_tri: null }]);
    expect(v.pt_kho_bai).toHaveLength(2);
  });
  it("dòng không có tên tàu bị bỏ qua", () => { expect(dong({ ...HOP_LE, ten_tau: "" })).toBeNull(); });
  it("báo lỗi: vừa nhập vừa xuất, khối lượng chữ, thiếu bến, ETA sai", () => {
    expect(dong({ ...HOP_LE, hang_nhap: "Phế" }).loi).toContain("Vừa có Hàng nhập vừa có Hàng xuất");
    expect(dong({ ...HOP_LE, khoi_luong: "nhiều" }).loi.join()).toContain("không phải số");
    expect(dong({ ...HOP_LE, ben: "" }).loi).toContain("Thiếu BẾN");
    expect(dong({ ...HOP_LE, ben: "XX" }).loi.join()).toContain("Không rõ bến");
    expect(dong({ ...HOP_LE, eta: "abc" }).loi.join()).toContain("ETA");
    expect(dong({ ...HOP_LE, hang_xuat: "" }).loi).toContain("Thiếu Hàng nhập hoặc Hàng xuất");
    expect(dong({ ...HOP_LE, etb: "" }).loi).toContain("Thiếu ETB");
  });
  it("ô chữ để trống ghi vào danh sách trống; DRAFT/LOA/DWT là chữ TBA thì bỏ trống", () => {
    const { v, trong } = dong({ ...HOP_LE, draft: "TBA", loa: "TBA", dwt: "TBA", ben: "1" });
    expect(v.draft).toBeUndefined(); expect(v.ben_ma).toBe("B01");
    expect(trong).toEqual(expect.arrayContaining(["gear", "dem_day", "laytime", "lsd", "ghi_chu", "kho_bai", "pt_van_chuyen", "pt_kho_bai"]));
  });
  it("báo cột bắt buộc thiếu trong cả bảng", () => {
    expect(cotThieu(["ben", "ten_tau", "khoi_luong", "eta", "etb", "etd"])).toEqual(["HÀNG NHẬP hoặc HÀNG XUẤT"]);
    expect(cotThieu(COT_TAU.map((c) => c.k))).toEqual([]);
  });
});

describe("Số ngày làm hàng, hàng trống, khối lượng gọn", () => {
  it("ETD trống thì ETD = ETB + số ngày; '3-4' lấy số 4; có ETD thì giữ ETD", () => {
    const a = dong({ ...HOP_LE, etd: "", so_ngay: "3-4" });
    expect(a.loi).toEqual([]);
    expect(new Date(a.v.etd).getTime() - new Date(a.v.etb).getTime()).toBe(4 * 864e5);
    expect(a.ghiChu[0]).toMatch(/ETB \+ 4 ngày/);
    expect(dong({ ...HOP_LE, etd: "", so_ngay: "2" }).v.etd).toBeDefined();
    const b = dong({ ...HOP_LE, so_ngay: "5" }); // có ETD: giữ nguyên
    expect(new Date(b.v.etd).getDate()).toBe(15);
  });
  it("số ngày không phải số thì báo lỗi; không có ETD lẫn số ngày thì báo thiếu", () => {
    expect(dong({ ...HOP_LE, so_ngay: "vài" }).loi.join()).toContain("SỐ NGÀY LÀM HÀNG");
    expect(dong({ ...HOP_LE, etd: "" }).loi).toContain("Thiếu ETD (hoặc SỐ NGÀY LÀM HÀNG)");
    expect(cotThieu(["ben", "ten_tau", "hang_nhap", "khoi_luong", "eta", "etb"])).toEqual(["ETD (hoặc SỐ NGÀY LÀM HÀNG)"]);
    expect(cotThieu(["ben", "ten_tau", "hang_nhap", "khoi_luong", "eta", "etb", "so_ngay"])).toEqual([]);
  });
  it("cả hai cột hàng trống (kể cả chỉ có dấu gạch) thì báo lỗi", () => {
    expect(dong({ ...HOP_LE, hang_xuat: "" }).loi).toContain("Thiếu Hàng nhập hoặc Hàng xuất");
    expect(dong({ ...HOP_LE, hang_xuat: "-", hang_nhap: " - " }).loi).toContain("Thiếu Hàng nhập hoặc Hàng xuất");
    expect(dong({ ...HOP_LE, hang_xuat: "-", hang_nhap: "Phế" }).loi).toEqual([]);
  });
  it("tanK: nghìn tấn viết k, dưới nghìn viết nguyên", () => {
    expect(tanK(3200)).toBe("3,2k t"); expect(tanK(1221)).toBe("1,221k t"); expect(tanK(850)).toBe("850 t"); expect(tanK(0)).toBe("0 t"); expect(tanK(null)).toBe("");
  });
});

describe("Tên hàng có dấu gạch ngang", () => {
  it("chữ sau dấu gạch là phần của tên hàng, không báo lỗi khối lượng (Xỉ hạt lò cao nghiền mịn - S95)", () => {
    const { v, loi } = dong({ ...HOP_LE, hang_xuat: "Xỉ hạt lò cao nghiền mịn - S95", khoi_luong: "5950" });
    expect(loi).toEqual([]);
    expect(v.ten_hang).toBe("Xỉ hạt lò cao nghiền mịn - S95");
    expect(v.hang_ds).toEqual([{ ten_hang: "Xỉ hạt lò cao nghiền mịn - S95", loai_hang: "Xỉ hạt lò cao nghiền mịn - S95", khoi_luong: null }]);
    expect(v.khoi_luong).toBe(5950);
  });
  it("vẫn tách khối lượng khi sau dấu gạch là số: Phế - 1.200, Than-800", () => {
    const { v } = dong({ ...HOP_LE, hang_xuat: "", hang_nhap: "Phế - 1.200, Than-800, Xỉ S95-1k" });
    expect(v.hang_ds.map((h) => [h.ten_hang, h.khoi_luong])).toEqual([["Phế", 1200], ["Than", 800], ["Xỉ S95", 1000]]);
  });
});
