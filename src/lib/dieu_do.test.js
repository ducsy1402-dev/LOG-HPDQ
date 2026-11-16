// Kiểm thử: quân số theo tổ (SQL 14) cộng lên đội, và số liệu trang Điều độ
import { describe, it, expect } from "vitest";
import { derive } from "../thietbi/lib/compute";
import { tinhDieuDo } from "../thietbi/lib/dieuDo";

const NOW = new Date(2026, 10, 15, 10, 0); // 15/11/2026 10:00: CA 1 đang diễn ra (08h–20h)
const HOM_NAY = "2026-11-15";

const xe = (ma, doi, to, che_do = "Đi ca") => ({ ma, doi, to_xe: to, che_do, model: "X" });
const raw = (them = {}) => ({
  meta: { doi: ["Xe ben", "Xúc đào"], to: ["Tổ 1", "Tổ 2", "Tổ 3"] },
  today: HOM_NAY,
  vehicles: [xe("B1", "Xe ben", "Tổ 1"), xe("B2", "Xe ben", "Tổ 1"), xe("B3", "Xe ben", "Tổ 2"), xe("B4", "Xe ben", "Tổ 2"), xe("X1", "Xúc đào", "Tổ 3")],
  staff: [
    ...["a", "b", "c"].map((k) => ({ ma: "S" + k, ho_ten: k, doi: "Xe ben", to_xe: "Tổ 1", kip: "A", nhom: "Lái xe" })),
    ...["d", "e"].map((k) => ({ ma: "S" + k, ho_ten: k, doi: "Xe ben", to_xe: "Tổ 2", kip: "A", nhom: "Lái xe" })),
  ],
  events: [], cakip: [{ ngay: HOM_NAY, ca: "CA 1 (08h–20h)", kip: "A" }], headcount: [], headcountTo: [], specs: [], plan: null,
  ...them,
});
const caNay = (D) => D.upcomingShifts(NOW).find((x) => x.dangChay && !x.hc);

describe("Quân số theo tổ", () => {
  it("chưa chạy SQL 14 (headcountTo = null): coSql14 = false, đội lấy số nhập theo đội cũ", () => {
    const D = derive(raw({ headcountTo: null, headcount: [{ ngay: HOM_NAY, ca: "CA 1 (08h–20h)", doi: "Xe ben", thuc_te: 3 }] }));
    expect(D.coSql14).toBe(false);
    const r = D.shiftRows(caNay(D)).find((x) => x.doi === "Xe ben");
    expect(r.thucTe).toBe(3);
    expect(r.theoTo).toBe(false);
  });
  it("thực tế của đội = cộng các tổ đã nhập, ưu tiên hơn số nhập theo đội cũ", () => {
    const ca = "CA 1 (08h–20h)";
    const D = derive(raw({
      headcount: [{ ngay: HOM_NAY, ca, doi: "Xe ben", thuc_te: 9 }],
      headcountTo: [{ ngay: HOM_NAY, ca, to_xe: "Tổ 1", thuc_te: 2 }, { ngay: HOM_NAY, ca, to_xe: "Tổ 2", thuc_te: 1 }],
    }));
    expect(D.coSql14).toBe(true);
    const r = D.shiftRows(caNay(D)).find((x) => x.doi === "Xe ben");
    expect(r.thucTe).toBe(3);
    expect(r.xeCan).toBe(4);
    expect(r.chenh).toBe(-1);
    expect(r.theoTo).toBe(true);
    const to = D.shiftByTo(caNay(D));
    expect(to.find((x) => x.to === "Tổ 1")).toMatchObject({ thucTe: 2, xeCan: 2, chenh: 0, dinhBien: 3, doiChinh: "Xe ben" });
    expect(to.find((x) => x.to === "Tổ 2")).toMatchObject({ thucTe: 1, chenh: -1 });
    expect(to.find((x) => x.to === "Tổ 3").thucTe).toBe(null);
  });
  it("tổ dùng chung nhiều đội: mỗi đội một dòng, chỉ đếm xe của đội đó, quân số nhập riêng từng đội", () => {
    const ca = "CA 1 (08h–20h)";
    const D = derive(raw({
      vehicles: [xe("D1", "Xúc đào", "PVC"), xe("D2", "Xúc đào", "PVC"), xe("D3", "Xúc đào", "PVC"), xe("L1", "Xúc lật", "PVC"), xe("L2", "Xúc lật", "PVC")],
      staff: [], meta: { doi: ["Xúc đào", "Xúc lật"], to: ["PVC"] },
      headcountTo: [{ ngay: HOM_NAY, ca, to_xe: "PVC", doi: "Xúc đào", thuc_te: 3 }, { ngay: HOM_NAY, ca, to_xe: "PVC", doi: "Xúc lật", thuc_te: 1 }],
    }));
    const to = D.shiftByTo(caNay(D));
    expect(to.length).toBe(2);
    expect(to.find((x) => x.doi === "Xúc đào")).toMatchObject({ to: "PVC", xeTong: 3, xeCan: 3, thucTe: 3, chenh: 0 });
    expect(to.find((x) => x.doi === "Xúc lật")).toMatchObject({ to: "PVC", xeTong: 2, xeCan: 2, thucTe: 1, chenh: -1 });
    const r = D.shiftRows(caNay(D));
    expect(r.find((x) => x.doi === "Xúc đào")).toMatchObject({ thucTe: 3, chenh: 0 });
    expect(r.find((x) => x.doi === "Xúc lật")).toMatchObject({ thucTe: 1, chenh: -1 });
  });
  it("dòng quân số tổ cũ chưa ghi đội tính cho đội chính của tổ", () => {
    const ca = "CA 1 (08h–20h)";
    const D = derive(raw({
      vehicles: [xe("D1", "Xúc đào", "PVC"), xe("D2", "Xúc đào", "PVC"), xe("L1", "Xúc lật", "PVC")], staff: [], meta: { doi: ["Xúc đào", "Xúc lật"], to: ["PVC"] },
      headcountTo: [{ ngay: HOM_NAY, ca, to_xe: "PVC", doi: "", thuc_te: 2 }],
    }));
    const to = D.shiftByTo(caNay(D));
    expect(to.find((x) => x.doi === "Xúc đào").thucTe).toBe(2);
    expect(to.find((x) => x.doi === "Xúc lật").thucTe).toBe(null);
  });
  it("tổ nhập 0 người vẫn tính là đã nhập (thiếu), khác tổ chưa nhập", () => {
    const ca = "CA 1 (08h–20h)";
    const D = derive(raw({ headcountTo: [{ ngay: HOM_NAY, ca, to_xe: "Tổ 1", thuc_te: 0 }] }));
    const r = D.shiftRows(caNay(D)).find((x) => x.doi === "Xe ben");
    expect(r.thucTe).toBe(0);
    expect(r.chenh).toBe(-2); // chỉ tính Tổ 1 (cần 2); Tổ 2 chưa nhập không bị coi là thiếu
    expect(r.toChua).toBe(1);
  });
});

describe("Điều độ", () => {
  it("báo thiếu người theo tổ, xe hỏng làm đội mất xe sẵn sàng", () => {
    const ca = "CA 1 (08h–20h)";
    const D = derive(raw({
      events: [{ id: 1, ma_xe: "B1", loai: "Hỏng", nhom: "Máy", ngay_vao: "2026-11-01", ngay_du_kien: null, ngay_xong: null }],
      headcountTo: [{ ngay: HOM_NAY, ca, to_xe: "Tổ 1", thuc_te: 0 }, { ngay: HOM_NAY, ca, to_xe: "Tổ 2", thuc_te: 2 }],
    }));
    const X = tinhDieuDo(D, NOW);
    expect(X.caNay.dangChay).toBe(true);
    const ben = X.doiBang.find((d) => d.doi === "Xe ben");
    expect(ben).toMatchObject({ tong: 4, ready: 3, hong: 1, xeCan: 3, thucTe: 2, chenh: -1 });
    expect(ben.daGan).toBe(null); // chưa có kế hoạch ngày
    const thieu = X.canhBao.find((a) => a.tab === "quan-so" && /thiếu/.test(a.nd));
    expect(thieu.muc).toBe("bad");
    expect(thieu.nd).toMatch(/Tổ 1 −1/);
    expect(X.canhBao.some((a) => a.xe === "B1" && a.muc === "bad")).toBe(true); // hỏng lâu (14 ngày > 7)
    expect(X.dung.map((e) => e.ma_xe)).toEqual(["B1"]);
    expect(X.sXe.tong).toBe(5);
  });
  it("việc bad xếp trước warn, warn trước info", () => {
    const D = derive(raw({ headcountTo: [{ ngay: HOM_NAY, ca: "CA 1 (08h–20h)", to_xe: "Tổ 1", thuc_te: 0 }] }));
    const th = tinhDieuDo(D, NOW).canhBao.map((a) => ["bad", "warn", "info"].indexOf(a.muc));
    expect(th).toEqual([...th].sort((a, b) => a - b));
  });
});
