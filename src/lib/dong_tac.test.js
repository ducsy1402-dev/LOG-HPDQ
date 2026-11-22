import { describe, it, expect } from "vitest";
import { phanTich, dinhDang } from "../khung/dongTac";

// Đếm số (SoDem): đọc số trong chuỗi đã định dạng kiểu Việt Nam, giữ chữ trước / sau và số chữ số thập phân
describe("phanTich / dinhDang (đếm số)", () => {
  it("số phần trăm có phẩy thập phân", () => {
    const p = phanTich("67,53%");
    expect(p).toMatchObject({ truoc: "", sau: "%", n: 67.53, thapPhan: 2, nhom: false });
    expect(dinhDang(p.n, p)).toBe("67,53");
  });
  it("số có dấu chấm ngăn nghìn và hậu tố", () => {
    const p = phanTich("1.258,58k t");
    expect(p).toMatchObject({ sau: "k t", n: 1258.58, thapPhan: 2, nhom: true });
    expect(dinhDang(p.n, p)).toBe("1.258,58");
    expect(dinhDang(0, p)).toBe("0,00");
  });
  it("số nguyên và chữ đứng trước", () => {
    const p = phanTich("Tồn 226 xe");
    expect(p).toMatchObject({ truoc: "Tồn ", sau: " xe", n: 226, thapPhan: 0 });
  });
  it("không có số thì để nguyên", () => {
    expect(phanTich("—")).toBeNull();
    expect(phanTich("")).toBeNull();
  });
});
