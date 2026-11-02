// Kiểm thử quy tắc cập cầu bến theo tuyến bến: d giữa tàu, e chỉ ở hai đầu tuyến (đầu góc vuông dùng hàng b),
// tàu cập hai bến liền nhau (bến phụ), vị trí mét của tàu
import { describe, it, expect } from "vitest";
import DM from "../data/danhMuc.json";
import { timBen } from "./checks";
import { dongThanhChuyen } from "./paste";
import { doanBen } from "./linetime";
import { datThuTuBen, tenBenChuyen, noiHaiBen } from "./tenBen";
import { soMetCan, khoangCachD, khoangCachE, cacTuyen, tuyenCuaBen, benLienKe, laBenLienKe, benTheoViTri, xepTuyen, choBenTheoChuyen, nhanCho, kiemTraXepBen, soDoCauBen } from "./capBen";

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
    expect(m.get("3-5-10")).toMatchObject({ tu: 0, den: 910, dau: "thang", cuoi: "thang" });
    expect(m.get("3-5-10").bens.map((b) => [b.ma, b.tu, b.den])).toEqual([["3", 0, 200], ["5", 200, 500], ["10", 500, 910]]);
    expect(m.get("4-6-11")).toMatchObject({ dau: "vuong_goc", cuoi: "thang", den: 910 });
    expect(m.get("7-8-9")).toMatchObject({ dau: "vuong_goc", cuoi: "thang", den: 433 });
    expect(m.get("HH2-HH3").den).toBe(432); expect(m.get("6CTH-7CTH").den).toBe(500);
    expect(["1A", "1", "2"].map((x) => T(x).bens.length)).toEqual([1, 1, 1]); // ba bến song song, mỗi bến một tuyến
  });
  it("chỉ các cặp 3/5, 5/10, 4/6, 6/11, 7/8, 8/9, HH2/3, 6/7CTH cập được", () => {
    expect(benLienKe(BEN, "5").map((b) => b.ma)).toEqual(["3", "10"]);
    expect(benLienKe(BEN, "7").map((b) => b.ma)).toEqual(["8"]);
    expect(benLienKe(BEN, "2").map((b) => b.ma)).toEqual([]);
    for (const [a, b] of [["3", "5"], ["5", "10"], ["4", "6"], ["6", "11"], ["7", "8"], ["8", "9"], ["HH2", "HH3"], ["6CTH", "7CTH"]]) expect(laBenLienKe(BEN, a, b)).toBe(true);
    for (const [a, b] of [["2", "3"], ["10", "4"], ["11", "7"], ["1A", "1"], ["9", "HH2"], ["3", "4"]]) expect(laBenLienKe(BEN, a, b)).toBe(false);
  });
  it("vị trí mét → bến chiếm", () => {
    expect(benTheoViTri(BEN, "HH2", 20, 190)).toEqual({ ben_ma: "HH2", ben_phu: null });
    expect(benTheoViTri(BEN, "HH2", 230, 167.2)).toEqual({ ben_ma: "HH3", ben_phu: "HH2" }); // vắt HH2/3, phần lớn ở HH3
    expect(benTheoViTri(BEN, "5", 150, 400)).toBe(null); // chiếm ba bến
    expect(benTheoViTri(BEN, "3", -5, 100)).toBe(null); // ra ngoài tuyến
  });
});

describe("Xếp tàu trên tuyến", () => {
  it("ranh giới bến không phải đầu tuyến: tàu 300 m một mình ở bến 5 vừa", () => {
    expect(xepTuyen(T("5"), [tau("5", 290)]).vua).toBe(true);
    expect(xepTuyen(T("5"), [tau("5", 300)]).vua).toBe(true);
  });
  it("bến ở đầu tuyến phải chừa e: tàu 190 m ở bến 3 → 15 + 190 = 205 > 200", () => {
    const r = xepTuyen(T("3"), [tau("3", 190)]);
    expect(r.vua).toBe(false); expect(r.thieuM).toBe(5); expect(r.viPham.loai).toBe("ngoai_ben");
    expect(xepTuyen(T("3"), [tau("3", 185)]).vua).toBe(true);
  });
  it("bến 4: chỉ đầu mét 0 là góc vuông (hàng b)", () => {
    expect(xepTuyen(T("4"), [tau("4", 150)]).x).toEqual([20]); // e góc vuông 20, đầu mét 200 thẳng nối bến 6
    expect(xepTuyen(T("4"), [tau("4", 175)]).vua).toBe(true); // 25 + 175 = 200
    expect(xepTuyen(T("4"), [tau("4", 190)]).thieuM).toBe(15); // 25 + 190 = 215
  });
  it("bến 11 ở mũi cầu: chừa e ở mét 910", () => {
    expect(xepTuyen(T("11"), [tau("11", 380)]).vua).toBe(true); // tàu > 300 m, đầu thẳng e = 20: 500 + 380 = 880 ≤ 890
    expect(xepTuyen(T("11"), [tau("11", 395)])).toMatchObject({ vua: false, thieuM: 5, viPham: { loai: "cuoi_tuyen" } }); // 500 + 395 = 895 > 910 − 20
  });
  it("tàu bến 3 và bến 5 cạnh nhau chỉ cần d", () => {
    const r = xepTuyen(T("3"), [tau("3", 180), tau("5", 200)]);
    expect(r.vua).toBe(true); expect(r.x).toEqual([15, 215]); // A 15–195, B cách d 20 → 215–415
  });
  it("vị trí cố định: kiểm tra đúng chỗ tàu nằm", () => {
    expect(xepTuyen(T("3"), [tau("3", 180, 5)])).toMatchObject({ vua: false, thieuM: 10, viPham: { loai: "dau_tuyen" } });
    expect(xepTuyen(T("3"), [tau("3", 180, 15), tau("5", 200, 205)])).toMatchObject({ vua: false, thieuM: 10, viPham: { loai: "gan_tau" } });
    expect(xepTuyen(T("3"), [tau("3", 180, 15), tau("5", 200, 220)]).vua).toBe(true);
    expect(xepTuyen(T("3"), [tau("5", 200, 150)]).viPham.loai).toBe("ngoai_ben"); // ghi bến 5 nhưng nằm từ mét 150
  });
  it("bảng kế hoạch Cảng Tổng hợp: HH2 (20-210) và HH2/3 (230-397) cùng lúc là vừa", () => {
    const r = xepTuyen(T("HH2"), [tau("HH2", 189.99, 20), tau("HH2/HH3", 167.2, 230)]);
    expect(r.vua).toBe(true); // e 15 ≤ 20; 210 + d 20 = 230; tàu vắt qua mét 242
    expect(xepTuyen(T("HH2"), [tau("HH2", 189.99, 20), tau("HH2/HH3", 167.2, 225)]).viPham.loai).toBe("gan_tau");
  });
  it("tàu 7/8 và tàu ở bến 8", () => {
    expect(xepTuyen(T("7"), [tau("7/8", 118)]).x).toEqual([62]); // phải chạm qua ranh giới mét 180
    const r2 = xepTuyen(T("7"), [tau("7/8", 118), tau("8", 120)]); // 180 + 15 + 120 = 315 > 306,5 (bến 9 nối tiếp nên không tính e ở 306,5)
    expect(r2).toMatchObject({ vua: false, viPham: { loai: "ngoai_ben", ben: "8" } }); expect(r2.thieuM).toBeCloseTo(8.5, 6);
    expect(xepTuyen(T("7"), [tau("7/8", 118), tau("8", 111)]).vua).toBe(true);
  });
  it("tàu bến 3 dài làm tàu 3/5 không vắt qua được ranh giới", () => {
    const r = xepTuyen(T("3"), [tau("3", 170), tau("3/5", 50)]); // 15 + 170 = 185, + d 20 = 205 > 200
    expect(r).toMatchObject({ vua: false, thieuM: 5, viPham: { loai: "khong_vat" } });
  });
  it("hai tàu cùng vắt một ranh giới", () => {
    expect(xepTuyen(T("3"), [tau("3/5", 60), tau("3/5", 60)]).viPham.loai).toBe("hai_vat");
  });
});

describe("Cảnh báo theo chuyến, thử xếp, sơ đồ", () => {
  const NOW = t(3);
  const s = { id: 11, ten_tau: "S", loa: 118, ben_ma: "7", ben_phu: "8", atb: iso(1), etd: iso(5) };
  const c = { id: 13, ten_tau: "C", loa: 120, ben_ma: "8", atb: iso(2), etd: iso(4) };
  it("tàu 7/8 cùng lúc tàu bến 8 120 m: thiếu 8,5 m", () => {
    const m = choBenTheoChuyen([s, c], BEN, () => [], NOW);
    expect(m.size).toBe(2);
    expect(nhanCho(m.get(11)[0], s)).toMatch(/S 118 m \(bến 7\/8\).*tàu C ra ngoài bến 8, thiếu 9 m/);
    expect(choBenTheoChuyen([s, { ...c, loa: 111 }], BEN, () => [], NOW).size).toBe(0);
  });
  it("tàu dài hơn bến không báo ở đây (đã có cảnh báo LOA); tàu một mình thiếu e đầu tuyến thì báo", () => {
    expect(choBenTheoChuyen([{ ...c, loa: 140 }], BEN, () => [], NOW).size).toBe(0);
    const m = choBenTheoChuyen([{ id: 5, ten_tau: "D", loa: 190, ben_ma: "4", atb: iso(1), etd: iso(3) }], BEN, () => [], NOW);
    expect(nhanCho(m.get(5)[0], { loa: 190 })).toMatch(/Bến 4: tàu D ra ngoài bến 4, thiếu 15 m/);
  });
  it("thử xếp chuyến có vị trí mét", () => {
    // S tự xếp ở 62–180; X 100 m ở bến 8 cần cách d 15 → từ mét 195
    expect(kiemTraXepBen({ id: 99, ten_tau: "X", loa: 100, vi_tri: 190 }, "8", t(2), t(3), { voyages: [s], berths: BEN, now: NOW })).toHaveLength(1);
    expect(kiemTraXepBen({ id: 99, ten_tau: "X", loa: 100, vi_tri: 195 }, "8", t(2), t(3), { voyages: [s], berths: BEN, now: NOW })).toHaveLength(0);
  });
  it("sơ đồ cầu bến: vị trí tự xếp và tàu thêm tối đa từng bến", () => {
    const r = soDoCauBen([s], BEN, () => [], t(3), NOW).find((x) => x.tuyen.ma === "7-8-9");
    expect(r.tau[0]).toMatchObject({ x: 62, coDinh: false, ben: "7", phu: "8" });
    expect(r.themTheoBen.find((x) => x.ma === "8").them).toBe(111); // 180 + 15 + 111 = 306
    expect(r.themTheoBen.find((x) => x.ma === "9").them).toBe(116); // bến 9 306,5–433, cuối tuyến e 10: 433 − 10 − 306,5
  });
  it("đoạn chiếm bến lấy vị trí mét ở chuyến / khoảng dừng chuyển bến", () => {
    const v = { id: 1, ben_ma: "5", vi_tri: 300, loa: 150, atb: iso(1), etd: iso(5) };
    expect(doanBen(v, [], NOW)[0]).toMatchObject({ ben: "5", viTri: 300, cuoi: true });
    const st = [{ id: 7, loai: "shifting", tu: iso(2), den: iso(2, 3), ben_cu: "3", vi_tri_cu: 20, ben_moi: "5", ben_phu_moi: "10", vi_tri_moi: 400 }];
    const d = doanBen(v, st, NOW);
    expect(d.map((x) => [x.ben, x.phu, x.viTri, x.nguon?.phia, x.cuoi])).toEqual([["3", "", 20, "cu", false], ["5", "10", 400, "moi", true]]);
  });
});

describe("Dán nhanh và tên bến hai bến", () => {
  const berthOf = (x) => timBen(BEN, x);
  const dan = (ben) => dongThanhChuyen(["T", ben], ["ten_tau", "ben"], { berthOf }).v;
  it("đọc 7/8, B07/08, HH2/3, 3/5", () => {
    expect(dan("7/8")).toMatchObject({ ben_ma: "7", ben_phu: "8" });
    expect(dan("B07/08")).toMatchObject({ ben_ma: "7", ben_phu: "8" });
    expect(dan("HH2/3")).toMatchObject({ ben_ma: "HH2", ben_phu: "HH3" });
    expect(dan("3/5")).toMatchObject({ ben_ma: "3", ben_phu: "5" });
    expect(dan("5")).toMatchObject({ ben_ma: "5", ben_phu: null });
  });
  it("tên bến theo chiều tuyến", () => {
    datThuTuBen(BEN);
    expect(tenBenChuyen({ ben_ma: "8", ben_phu: "7" })).toBe("B07/08");
    expect(tenBenChuyen({ ben_ma: "HH3", ben_phu: "HH2" })).toBe("HH2/3");
    expect(noiHaiBen("5", "3", (x) => x)).toBe("3/5");
  });
});
