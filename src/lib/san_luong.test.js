// Kiểm thử thống kê khối lượng theo nhóm hàng (cột Nhóm trong Danh mục › Hàng hóa)
import { describe, it, expect } from "vitest";
import { taoNhomHang, dongHang, tinhThang, hangChuaCoNhom } from "./sanLuong";

const HH = [
  { loai_hang: "HMS 1/2 (80:20). Shredded . Bonus", nhom: "Phế" },
  { loai_hang: "Đá 45-100mm", nhom: "Đá" },
  { loai_hang: "HBI", nhom: "Quặng" },
  { loai_hang: "Than PCI LV", nhom: "Than" },
  { loai_hang: "Quặng sắt", nhom: "Quặng" },
  { loai_hang: "HRC", nhom: "HRC" },
];
const t = (d) => new Date(2026, 9, d, 8).toISOString();

describe("Nhóm hàng theo danh mục hàng hóa", () => {
  const nhom = taoNhomHang(HH);
  it("tra theo tên hàng, không phân biệt hoa thường và dấu", () => {
    expect(nhom("Đá 45-100mm", null)).toBe("Đá");
    expect(nhom("da 45-100MM", "Đá 45-100mm")).toBe("Đá");
    expect(nhom("HMS 1/2 (80:20). Shredded . Bonus", "HMS 1/2 (80:20). Shredded . Bonus")).toBe("Phế");
  });
  it("nhiều tên hàng cách nhau dấu ;: lấy tên đầu có trong danh mục", () => {
    expect(nhom("Thép thanh; HBI", "Thép")).toBe("Quặng");
  });
  it("loại hàng ghi ở chuyến đã là nhóm thì dùng luôn; không có trong danh mục thì giữ như ghi", () => {
    expect(nhom("Quặng Brazil", "quặng")).toBe("Quặng");
    expect(nhom("Thép thanh vằn", "Thép thành phẩm")).toBe("Thép thành phẩm");
    expect(nhom(null, null)).toBe("(chưa ghi)");
  });
  it("chưa có danh mục: như cũ (loại hàng, rồi tên hàng)", () => {
    expect(taoNhomHang([])("HBI", "HBI")).toBe("HBI");
    expect(dongHang({ ten_hang: "HBI", loai_hang: null, khoi_luong: 100, da_lam: 50 })[0].loai).toBe("HBI");
  });
  it("thống kê tháng gom theo nhóm", () => {
    const vs = [
      { id: 1, huong: "nhap", ten_hang: "HBI", loai_hang: "HBI", khoi_luong: 3000, da_lam: 1000, atb: t(2) },
      { id: 2, huong: "nhap", ten_hang: "Quặng sắt", loai_hang: "Quặng sắt", khoi_luong: 7000, da_lam: 7000, atb: t(5) },
      { id: 3, huong: "nhap", ten_hang: "Đá 45-100mm", loai_hang: "Đá 45-100mm", khoi_luong: 10500, da_lam: 500, atb: t(6) },
      { id: 4, huong: "xuat", ten_hang: "HRC", loai_hang: "HRC", khoi_luong: 6000, da_lam: 6000, atb: t(7) },
    ];
    const D = { voyages: vs, now: new Date(2026, 9, 28).getTime(), mucTieu: [], giaoDich: null };
    const k = tinhThang(D, "2026-10", nhom);
    const ten = (huong) => [...k.theoLoai.values()].filter((r) => r.huong === huong).map((r) => [r.loai, r.th, r.tau]).sort();
    expect(ten("nhap")).toEqual([["Quặng", 8000, 10000], ["Đá", 500, 10500]].sort());
    expect(ten("xuat")).toEqual([["HRC", 6000, 6000]]);
  });
  it("hai dòng hàng cùng nhóm trong một chuyến cộng dồn", () => {
    const v = { id: 5, huong: "nhap", khoi_luong: 10000, da_lam: 5000, hang_ds: [{ ten_hang: "HBI", khoi_luong: 4000 }, { ten_hang: "Quặng sắt", khoi_luong: 6000 }] };
    const d = dongHang(v, nhom);
    expect(d.map((x) => x.loai)).toEqual(["Quặng", "Quặng"]);
    expect(d.reduce((s, x) => s + x.lam, 0)).toBeCloseTo(5000, 6);
  });
});

describe("Nhận ra nhóm khi tên hàng chưa có trong danh mục", () => {
  const nhom = taoNhomHang([...HH, { loai_hang: "Xỉ hạt lò cao", nhom: "Xỉ" }, { loai_hang: "Than cám 2A", nhom: "Than" }, { loai_hang: "Phế HMS", nhom: "Phế" }]);
  it("tên bắt đầu bằng tên nhóm thì vào nhóm đó", () => {
    expect(nhom("Quặng cỡ Khumani", "Quặng cỡ Khumani")).toBe("Quặng");
    expect(nhom("Quặng He BRBF", "Quặng He BRBF")).toBe("Quặng");
    expect(nhom("Than PCI MV", "Than PCI MV")).toBe("Than");
    expect(nhom("Xỉ hạt lò cao nghiền mịn - S95", "Xỉ hạt lò cao nghiền mịn - S95")).toBe("Xỉ");
    expect(nhom("Đá 40-90mm", "Đá 40-90mm")).toBe("Đá");
    expect(nhom("Phế đóng bánh", "Phế đóng bánh")).toBe("Phế");
    expect(nhom("Than cám 3( HP Hải Bình)", null)).toBe("Than");
  });
  it("không nhầm khi chỉ giống chữ đầu", () => {
    expect(nhom("Thanh vằn", "Thanh vằn")).toBe("Thanh vằn");
    expect(nhom("Đất sét", "Đất sét")).toBe("Đất sét");
  });
  it("hàng chưa nhận ra được báo để thêm vào danh mục", () => {
    const vs = [
      { id: 1, ten_hang: "Quặng cỡ Khumani", loai_hang: "Quặng cỡ Khumani", khoi_luong: 1000 },
      { id: 2, ten_hang: "Chờ thông tin", loai_hang: "Chờ thông tin", khoi_luong: 500 },
      { id: 3, ten_hang: "HRC", loai_hang: "HRC", khoi_luong: 200 },
    ];
    expect(nhom.co("Chờ thông tin", "Chờ thông tin")).toBe(false);
    expect(hangChuaCoNhom(vs, nhom)).toEqual([{ ten: "Chờ thông tin", kl: 500 }]);
  });
});
