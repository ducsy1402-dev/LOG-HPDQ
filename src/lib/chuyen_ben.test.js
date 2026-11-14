// Kiểm thử: chuyển bến (shifting) / ra neo cắt đoạn chiếm bến, trả hàng trừ khối lượng cần làm
import { describe, it, expect } from "vitest";
import { doanBen, chiSo, klCanLam, daLam } from "./linetime";
import { tinhPhuongAn } from "./phuongAn";
import { tinhThang } from "./sanLuong";

const t = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const iso = (...a) => new Date(t(...a)).toISOString();
const NOW = t(2026, 10, 30, 12);

describe("Chuyển bến / ra neo", () => {
  const v = { id: 1, ten_tau: "A", ben_ma: "6", atb: iso(2026, 10, 28, 8), etd: iso(2026, 10, 31, 8), khoi_luong: 10000 };
  const shift = { loai: "shifting", tu: iso(2026, 10, 29, 8), den: iso(2026, 10, 29, 10), ben_cu: "5", ben_moi: "6" }; // tàu cập bến 5 trước, shifting sang 6
  it("không có chuyển bến: một đoạn theo bến của chuyến", () => {
    const d = doanBen(v, [], NOW);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ ben: "6", a: t(2026, 10, 28, 8), b: t(2026, 10, 31, 8) });
  });
  it("shifting: hai đoạn, giữa hai đoạn tàu không chiếm bến", () => {
    const d = doanBen(v, [shift], NOW);
    expect(d.map((x) => [x.ben, x.a, x.b])).toEqual([["5", t(2026, 10, 28, 8), t(2026, 10, 29, 8)], ["6", t(2026, 10, 29, 10), t(2026, 10, 31, 8)]]);
  });
  it("ra neo rồi về lại bến cũ (không ghi bến mới); đang ở neo thì chưa có đoạn sau", () => {
    const neo = { loai: "ra_neo", tu: iso(2026, 10, 29, 8), den: iso(2026, 10, 29, 20), ben_cu: "6", ben_moi: null };
    expect(doanBen(v, [neo], NOW).map((x) => x.ben)).toEqual(["6", "6"]);
    expect(doanBen(v, [{ ...neo, den: null }], NOW).map((x) => x.ben)).toEqual(["6"]);
  });
  it("khoảng dừng thường không cắt đoạn", () => {
    expect(doanBen(v, [{ loai: "dung", tu: iso(2026, 10, 29, 8), den: iso(2026, 10, 29, 10) }], NOW)).toHaveLength(1);
  });
});

describe("Trả hàng", () => {
  const v = { id: 3, ten_tau: "C", huong: "nhap", loai_hang: "Quặng", khoi_luong: 10000, da_lam: 6000, kl_tra: 1500, bd_lam_hang: iso(2026, 10, 28), atb: iso(2026, 10, 28), etb: iso(2026, 10, 28), etd: iso(2026, 11, 2), ben_ma: "5", cam_ket: 5000 };
  it("khối lượng cần làm, còn lại, tiến độ tính sau khi trừ hàng trả", () => {
    expect(klCanLam(v)).toBe(8500);
    const cs = chiSo(v, [], NOW);
    expect(cs.conLai).toBe(2500);
    expect(cs.hoanTat).toBeCloseTo(6000 / 8500, 6);
  });
  it("xong hàng chưa ghi đã làm: coi như đủ phần cần làm (không tính hàng trả)", () => {
    expect(daLam({ khoi_luong: 10000, kl_tra: 1500, kt_lam_hang: iso(2026, 10, 30) })).toBe(8500);
  });
  it("phương án: phần còn lại sau khi trừ hàng trả", () => {
    const kq = tinhPhuongAn(v, { toc_do: 2500, khoi_dong: false, xe: [] }, { now: NOW });
    expect(kq.conLai).toBeCloseTo(2500, 6);
  });
  it("khối lượng xếp dỡ trong tháng không tính hàng trả", () => {
    const D = { voyages: [v], now: NOW, mucTieu: [], giaoDich: null };
    const k = tinhThang(D, "2026-10");
    expect(k.klTau).toBe(8500);
    expect(k.thucHien).toBe(6000);
  });
});
