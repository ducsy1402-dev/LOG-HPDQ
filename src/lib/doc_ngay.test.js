// Kiểm thử: đọc ngày giờ nhận mọi định dạng (dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd, chữ, Excel…)
import { describe, it, expect } from "vitest";
import { docNgayGio, doanThuTuNgay } from "./paste";

const NOW = new Date(2026, 10, 15, 10, 0).getTime();
const p2 = (n) => String(n).padStart(2, "0");
// "yyyy-mm-dd hh:mm" theo giờ máy, hoặc null
const dk = (s, opts) => { const iso = docNgayGio(s, NOW, opts); if (!iso) return null; const d = new Date(iso); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };

describe("docNgayGio", () => {
  it("dd/mm/yyyy (Việt Nam) như cũ", () => {
    expect(dk("15/11/2026")).toBe("2026-11-15 00:00");
    expect(dk("22/10/2026 9h15")).toBe("2026-10-22 09:15");
    expect(dk("22-10-26 09:15")).toBe("2026-10-22 09:15");
    expect(dk("22.10.2026")).toBe("2026-10-22 00:00");
    expect(dk("09:15 22/10")).toBe("2026-10-22 09:15"); // thiếu năm: năm gần "now" nhất
    expect(dk("22/10")).toBe("2026-10-22 00:00");
  });
  it("mm/dd/yyyy (Mỹ) tự nhận khi phần thứ hai > 12 (ảnh anh Sỹ gửi: 11/15/2026)", () => {
    expect(dk("11/15/2026")).toBe("2026-11-15 00:00");
    expect(dk("11-15-26")).toBe("2026-11-15 00:00");
    expect(dk("11/15/2026 3:30 PM")).toBe("2026-11-15 15:30");
    expect(dk("12/31/2026")).toBe("2026-12-31 00:00");
  });
  it("nhập nhằng (cả hai ≤ 12): mặc định ngày trước, chọn được thuTu mdy", () => {
    expect(dk("03/04/2026")).toBe("2026-04-03 00:00");
    expect(dk("03/04/2026", { thuTu: "mdy" })).toBe("2026-03-04 00:00");
    expect(doanThuTuNgay(["03/04/2026", "11/15/2026"])).toBe("mdy");
    expect(doanThuTuNgay(["03/04/2026", "15/11/2026"])).toBe("dmy");
    expect(doanThuTuNgay(["03/04/2026"])).toBe("dmy");
    expect(doanThuTuNgay(["2026-11-15", 46341, ""])).toBe("dmy");
  });
  it("năm đứng đầu, dạng gộp, có chữ tháng", () => {
    expect(dk("2026-11-15 09:15")).toBe("2026-11-15 09:15");
    expect(dk("2026-11-15T09:15:30")).toBe("2026-11-15 09:15");
    expect(dk("2026/11/15")).toBe("2026-11-15 00:00");
    expect(dk("20261115")).toBe("2026-11-15 00:00");
    expect(dk("15112026")).toBe("2026-11-15 00:00");
    expect(dk("Nov 15, 2026")).toBe("2026-11-15 00:00");
    expect(dk("15 Nov 2026 9:30 PM")).toBe("2026-11-15 21:30");
    expect(dk("15-Nov-26")).toBe("2026-11-15 00:00");
    expect(dk("15 tháng 11 năm 2026")).toBe("2026-11-15 00:00");
    expect(dk("Ngày 15 tháng 11")).toBe("2026-11-15 00:00");
    expect(dk("12:00 AM 15/11/2026")).toBe("2026-11-15 00:00");
  });
  it("số ngày kiểu Excel, đối tượng Date; không đọc được / ngày không có thật thì null", () => {
    expect(dk(46341)).toBe("2026-11-15 00:00");
    expect(dk("46341")).toBe("2026-11-15 00:00");
    expect(docNgayGio(new Date(2026, 10, 15, 8, 5))).toBe(new Date(2026, 10, 15, 8, 5).toISOString());
    expect(dk("31/02/2026")).toBe(null);
    expect(dk("13/13/2026")).toBe(null);
    expect(dk("abc")).toBe(null);
    expect(dk("")).toBe(null);
    expect(dk("-")).toBe(null);
  });
});

describe("Áp vào các hộp dán", () => {
  it("bảng tàu: cả cột ETA / ETB / ETD theo mm/dd khi có ngày > 12 ở phần thứ hai", async () => {
    const { thuTuNgayBangTau, docNgayTau } = await import("./danTau");
    const cot = ["ten_tau", "eta", "etb", "etd"];
    const dong = [["A", "03/04/2026", "03/05/2026", "03/09/2026"], ["B", "11/15/2026", "11/16/2026", "11/20/2026"]];
    const thuTu = thuTuNgayBangTau(dong, cot);
    expect(thuTu).toBe("mdy");
    const d = (x) => { const t = new Date(docNgayTau(x, { thuTu, now: NOW }).iso); return `${t.getMonth() + 1}/${t.getDate()}`; };
    expect(d("03/04/2026")).toBe("3/4"); // dòng nhập nhằng cũng theo mm/dd như cả cột
    expect(d("11/15/2026")).toBe("11/15");
    expect(docNgayTau("03/04/2026", { now: NOW }).iso && new Date(docNgayTau("03/04/2026", { now: NOW }).iso).getMonth()).toBe(3); // không có gợi ý: dd/mm
  });
  it("file nhu cầu thiết bị (parseDT) nhận thêm mm/dd/yyyy", async () => {
    const { parseDT } = await import("../thietbi/lib/plan");
    const x = new Date(parseDT("11/15/2026 14:30"));
    expect([x.getMonth() + 1, x.getDate(), x.getHours(), x.getMinutes()]).toEqual([11, 15, 14, 30]);
    const y = new Date(parseDT("15/11/2026 14:30"));
    expect([y.getMonth() + 1, y.getDate()]).toEqual([11, 15]);
  });
});
