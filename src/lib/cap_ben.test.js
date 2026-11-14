// Kiểm thử quy tắc cập cầu bến theo tuyến bến: d giữa tàu, e chỉ ở hai đầu tuyến (đầu góc vuông dùng hàng b),
// tàu cập hai bến liền nhau (bến phụ), vị trí mét của tàu
import { describe, it, expect } from "vitest";
import DM from "../data/danhMuc.json";
import { timBen } from "./checks";
import { docDongTau } from "./danTau";
import { doanBen } from "./linetime";
import { datThuTuBen, tenBenChuyen, noiHaiBen } from "./tenBen";
import { soMetCan, khoangCachD, khoangCachE, cacTuyen, tuyenCuaBen, benLienKe, laBenLienKe, benTheoViTri, xepTuyen } from "./capBen";

const t = (d, h = 0) => new Date(2026, 10, d, h).getTime();
const iso = (d, h = 0) => new Date(t(d, h)).toISOString();
const BEN = DM.berths;
const T = (ma) => tuyenCuaBen(BEN, ma);
// Tàu trên tuyến của bến ma: bến (hoặc "a/b") → { L, k, vat, x }
const tau = (ma, L, x = null) => {
  const [a, b] = ma.split("/"), tu = T(a), k0 = tu.bens.findIndex((z) => z.ma === a), k1 = b ? tu.bens.findIndex((z) => z.ma === b) : k0;
  return { L, k: Math.min(k0, k1), vat: k0 !== k1, x };
};

describe("Bảng khoảng cách", () => {
  it("d theo tàu lớn hơn, e theo hình đầu tuyến", () => {
    expect(khoangCachD(200, 50)).toBe(20);
    expect(khoangCachD(50, 80)).toBe(10);
    expect(khoangCachE(250)).toBe(15); expect(khoangCachE(250, "vuong_goc")).toBe(30);
    expect(khoangCachE(350, "vuong_goc")).toBe(45);
    expect(soMetCan([200, 50]).can).toBe(10 + 50 + 20 + 200 + 15);
  });
});

describe("Tuyến bến và mốc mét", () => {
  it("các tuyến theo sơ đồ cầu bến", () => {
    const m = cacTuyen(BEN);
    expect(m.get("B03-B05-B10")).toMatchObject({ tu: 0, den: 910, dau: "thang", cuoi: "thang" });
    expect(m.get("B03-B05-B10").bens.map((b) => [b.ma, b.tu, b.den])).toEqual([["B03", 0, 200], ["B05", 200, 500], ["B10", 500, 910]]);
    expect(m.get("B04-B06-B11")).toMatchObject({ dau: "vuong_goc", cuoi: "thang", den: 910 });
    expect(m.get("B07-B08-B09")).toMatchObject({ dau: "vuong_goc", cuoi: "thang", den: 433 });
    expect(m.get("HH2-HH3").den).toBe(432); expect(m.get("6CTH-7CTH").den).toBe(490); expect(m.get("6CTH-7CTH").bens.map((b) => [b.ma, b.tu, b.den])).toEqual([["7CTH", 0, 250], ["6CTH", 250, 490]]);
    expect(["TL", "B01", "B02"].map((x) => T(x).bens.length)).toEqual([1, 1, 1]); // ba bến song song, mỗi bến một tuyến
  });
  it("chỉ các cặp 3/5, 5/10, 4/6, 6/11, 7/8, 8/9, HH2/3, 6/7CTH cập được", () => {
    expect(benLienKe(BEN, "B05").map((b) => b.ma)).toEqual(["B03", "B10"]);
    expect(benLienKe(BEN, "B07").map((b) => b.ma)).toEqual(["B08"]);
    expect(benLienKe(BEN, "B02").map((b) => b.ma)).toEqual([]);
    for (const [a, b] of [["B03", "B05"], ["B05", "B10"], ["B04", "B06"], ["B06", "B11"], ["B07", "B08"], ["B08", "B09"], ["HH2", "HH3"], ["6CTH", "7CTH"]]) expect(laBenLienKe(BEN, a, b)).toBe(true);
    for (const [a, b] of [["B02", "B03"], ["B10", "B04"], ["B11", "B07"], ["TL", "B01"], ["B09", "HH2"], ["B03", "B04"]]) expect(laBenLienKe(BEN, a, b)).toBe(false);
  });
  it("vị trí mét → bến chiếm", () => {
    expect(benTheoViTri(BEN, "HH2", 20, 190)).toEqual({ ben_ma: "HH2", ben_phu: null });
    expect(benTheoViTri(BEN, "HH2", 230, 167.2)).toEqual({ ben_ma: "HH3", ben_phu: "HH2" }); // vắt HH2/3, phần lớn ở HH3
    expect(benTheoViTri(BEN, "B05", 150, 400)).toBe(null); // chiếm ba bến
    expect(benTheoViTri(BEN, "B03", -5, 100)).toBe(null); // ra ngoài tuyến
  });
});

describe("Xếp tàu trên tuyến", () => {
  it("ranh giới bến không phải đầu tuyến: tàu 300 m một mình ở bến 5 vừa", () => {
    expect(xepTuyen(T("B05"), [tau("B05", 290)]).vua).toBe(true);
    expect(xepTuyen(T("B05"), [tau("B05", 300)]).vua).toBe(true);
  });
  it("bến ở đầu tuyến phải chừa e: tàu 190 m ở bến 3 → 15 + 190 = 205 > 200", () => {
    const r = xepTuyen(T("B03"), [tau("B03", 190)]);
    expect(r.vua).toBe(false); expect(r.thieuM).toBe(5); expect(r.viPham.loai).toBe("ngoai_ben");
    expect(xepTuyen(T("B03"), [tau("B03", 185)]).vua).toBe(true);
  });
  it("bến 4: chỉ đầu mét 0 là góc vuông (hàng b)", () => {
    expect(xepTuyen(T("B04"), [tau("B04", 150)]).x).toEqual([20]); // e góc vuông 20, đầu mét 200 thẳng nối bến 6
    expect(xepTuyen(T("B04"), [tau("B04", 175)]).vua).toBe(true); // 25 + 175 = 200
    expect(xepTuyen(T("B04"), [tau("B04", 190)]).thieuM).toBe(15); // 25 + 190 = 215
  });
  it("bến 11 ở mũi cầu: chừa e ở mét 910", () => {
    expect(xepTuyen(T("B11"), [tau("B11", 380)]).vua).toBe(true); // tàu > 300 m, đầu thẳng e = 20: 500 + 380 = 880 ≤ 890
    expect(xepTuyen(T("B11"), [tau("B11", 395)])).toMatchObject({ vua: false, thieuM: 5, viPham: { loai: "cuoi_tuyen" } }); // 500 + 395 = 895 > 910 − 20
  });
  it("tàu bến 3 và bến 5 cạnh nhau chỉ cần d", () => {
    const r = xepTuyen(T("B03"), [tau("B03", 180), tau("B05", 200)]);
    expect(r.vua).toBe(true); expect(r.x).toEqual([15, 215]); // A 15–195, B cách d 20 → 215–415
  });
  it("vị trí cố định: kiểm tra đúng chỗ tàu nằm", () => {
    expect(xepTuyen(T("B03"), [tau("B03", 180, 5)])).toMatchObject({ vua: false, thieuM: 10, viPham: { loai: "dau_tuyen" } });
    expect(xepTuyen(T("B03"), [tau("B03", 180, 15), tau("B05", 200, 205)])).toMatchObject({ vua: false, thieuM: 10, viPham: { loai: "gan_tau" } });
    expect(xepTuyen(T("B03"), [tau("B03", 180, 15), tau("B05", 200, 220)]).vua).toBe(true);
    expect(xepTuyen(T("B03"), [tau("B05", 200, 150)]).viPham.loai).toBe("ngoai_ben"); // ghi bến 5 nhưng nằm từ mét 150
  });
  it("bảng kế hoạch Cảng Tổng hợp: HH2 (20-210) và HH2/3 (230-397) cùng lúc là vừa", () => {
    const r = xepTuyen(T("HH2"), [tau("HH2", 189.99, 20), tau("HH2/HH3", 167.2, 230)]);
    expect(r.vua).toBe(true); // e 15 ≤ 20; 210 + d 20 = 230; tàu vắt qua mét 242
    expect(xepTuyen(T("HH2"), [tau("HH2", 189.99, 20), tau("HH2/HH3", 167.2, 225)]).viPham.loai).toBe("gan_tau");
  });
  it("tàu 7/8 và tàu ở bến 8", () => {
    expect(xepTuyen(T("B07"), [tau("B07/B08", 118)]).x).toEqual([62]); // phải chạm qua ranh giới mét 180
    const r2 = xepTuyen(T("B07"), [tau("B07/B08", 118), tau("B08", 120)]); // 180 + 15 + 120 = 315 > 306,5 (bến 9 nối tiếp nên không tính e ở 306,5)
    expect(r2).toMatchObject({ vua: false, viPham: { loai: "ngoai_ben", ben: "B08" } }); expect(r2.thieuM).toBeCloseTo(8.5, 6);
    expect(xepTuyen(T("B07"), [tau("B07/B08", 118), tau("B08", 111)]).vua).toBe(true);
  });
  it("tàu bến 3 dài làm tàu 3/5 không vắt qua được ranh giới", () => {
    const r = xepTuyen(T("B03"), [tau("B03", 170), tau("B03/B05", 50)]); // 15 + 170 = 185, + d 20 = 205 > 200
    expect(r).toMatchObject({ vua: false, thieuM: 5, viPham: { loai: "khong_vat" } });
  });
  it("hai tàu cùng vắt một ranh giới", () => {
    expect(xepTuyen(T("B03"), [tau("B03/B05", 60), tau("B03/B05", 60)]).viPham.loai).toBe("hai_vat");
  });
});

describe("Cảnh báo theo chuyến, thử xếp, sơ đồ", () => {
  const NOW = t(3);
  const s = { id: 11, ten_tau: "S", loa: 118, ben_ma: "B07", ben_phu: "B08", atb: iso(1), etd: iso(5) };
  const c = { id: 13, ten_tau: "C", loa: 120, ben_ma: "B08", atb: iso(2), etd: iso(4) };
  it("đoạn chiếm bến lấy vị trí mét ở chuyến / khoảng dừng chuyển bến", () => {
    const v = { id: 1, ben_ma: "B05", vi_tri: 300, loa: 150, atb: iso(1), etd: iso(5) };
    expect(doanBen(v, [], NOW)[0]).toMatchObject({ ben: "B05", viTri: 300, cuoi: true });
    const st = [{ id: 7, loai: "shifting", tu: iso(2), den: iso(2, 3), ben_cu: "B03", vi_tri_cu: 20, ben_moi: "B05", ben_phu_moi: "B10", vi_tri_moi: 400 }];
    const d = doanBen(v, st, NOW);
    expect(d.map((x) => [x.ben, x.phu, x.viTri, x.nguon?.phia, x.cuoi])).toEqual([["B03", "", 20, "cu", false], ["B05", "B10", 400, "moi", true]]);
  });
});

describe("Dán nhanh và tên bến hai bến", () => {
  const berthOf = (x) => timBen(BEN, x);
  const dan = (ben) => docDongTau(["T", ben], ["ten_tau", "ben"], { berthOf }).v;
  it("đọc 7/8, B07/08, HH2/3, 3/5", () => {
    expect(dan("7/8")).toMatchObject({ ben_ma: "B07", ben_phu: "B08" });
    expect(dan("B07/08")).toMatchObject({ ben_ma: "B07", ben_phu: "B08" });
    expect(dan("HH2/3")).toMatchObject({ ben_ma: "HH2", ben_phu: "HH3" });
    expect(dan("3/5")).toMatchObject({ ben_ma: "B03", ben_phu: "B05" });
    expect(dan("B05")).toMatchObject({ ben_ma: "B05" }); expect(dan("B05").ben_phu).toBeUndefined();
  });
  it("tên bến theo chiều tuyến", () => {
    datThuTuBen(BEN);
    expect(tenBenChuyen({ ben_ma: "B08", ben_phu: "B07" })).toBe("B07/08");
    expect(tenBenChuyen({ ben_ma: "HH3", ben_phu: "HH2" })).toBe("HH2/3");
    expect(noiHaiBen("B05", "B03", (x) => x)).toBe("B03/05");
  });
});
