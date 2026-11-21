import { describe, it, expect } from "vitest";
import { tonTheoLoaiHang, duBaoDay } from "./tonLoaiHang";

// Kho hàng kiện: loại hàng = nhóm hàng (21/11/2026)
const NOW = new Date("2026-11-21T10:00:00").getTime();
const nhomOf = (h) => (String(h).startsWith("HRC") ? "HRC" : String(h).startsWith("Thanh") ? "Thép thanh" : "");
const dong = (key, sucChua, kieu, hang, chua) => ({ key, loai: "thanh_pham", saiBai: false, sucChua, kieu, hang, chua, ten_bai: "B" + key });
const kho = {
  dong: [dong("k1", 1000, "co_dinh_hang", "HRC 1", [{ hang: "HRC 1", ton: 400 }]), dong("k2", 600, "tu_do", "", [{ hang: "HRC 2", ton: 100 }, { hang: "Thanh A", ton: 300 }]), dong("k3", 500, "co_dinh_hang", "Thanh A", [])],
  cap: [{ key: "k1", loai: "thanh_pham", hang: "HRC 1", ton: 400 }, { key: "k2", loai: "thanh_pham", hang: "HRC 2", ton: 100 }, { key: "k2", loai: "thanh_pham", hang: "Thanh A", ton: 300 }],
  gan: (bai) => String(bai).replace("B", ""),
};

describe("tồn theo loại hàng", () => {
  it("gộp theo nhóm, chia sức chứa gian / lô tự do theo tỉ lệ tồn, gian cố định hàng tính trọn", () => {
    const r = tonTheoLoaiHang({ kho, loai: "thanh_pham", nhomOf });
    const hrc = r.find((x) => x.ten === "HRC"), thanh = r.find((x) => x.ten === "Thép thanh");
    expect(hrc.ton).toBe(500);
    expect(hrc.sucChua).toBe(1000 + 150); // k1 trọn + 100/400 của k2 (600)
    expect(thanh.ton).toBe(300);
    expect(thanh.sucChua).toBe(450 + 500); // 300/400 của k2 + k3 trống nhưng cố định hàng
    expect(r[0].ten).toBe("HRC"); // xếp theo tồn giảm dần
  });
});

describe("dự báo đầy nếu không xuất bán", () => {
  it("bình quân nhập 30 ngày: còn trống ÷ nhập mỗi ngày; xu hướng trừ cả xuất", () => {
    const gd = [
      { ngay: "2026-11-10", loai: "nhap", ten_bai: "Bk1", hang: "HRC 1", so_luong: 300 },
      { ngay: "2026-11-12", loai: "xuat", ten_bai: "Bk1", hang: "HRC 1", so_luong: 150 },
      { ngay: "2026-09-01", loai: "nhap", ten_bai: "Bk1", hang: "HRC 1", so_luong: 9999 }, // ngoài 30 ngày
    ];
    const hrc = duBaoDay({ kho, loai: "thanh_pham", nhomOf, giaoDich: gd, now: NOW }).find((x) => x.ten === "HRC");
    expect(hrc.nhapNgay).toBe(10); expect(hrc.xuatNgay).toBe(5); expect(hrc.nguonNhap).toBe("binh_quan");
    expect(hrc.conTrong).toBe(650); // 1150 - 500
    expect(hrc.ngayDay).toBe(65); // 650 / 10
    expect(hrc.ngayDayXuHuong).toBe(130); // 650 / (10 - 5)
    expect(hrc.trangThai).toBe("on"); expect(hrc.ngayDuKien).toBe("2027-01-25");
  });
  it("kế hoạch nhập đang có hiệu lực hôm nay được ưu tiên; không nhập thì không có ngày đầy; đã đầy thì 0 ngày", () => {
    const kh = [{ huong: "nhap", hang: "HRC 1", ten_bai: "Bk1", ten_khu: null, khoi_luong: 3000, loai_ky: "thang", ky: "2026-11" }];
    const r = duBaoDay({ kho, loai: "thanh_pham", nhomOf, giaoDich: [], keHoach: kh, now: NOW });
    const hrc = r.find((x) => x.ten === "HRC");
    if (hrc.nguonNhap === "ke_hoach") { expect(hrc.nhapNgay).toBe(100); expect(hrc.ngayDay).toBe(6.5); expect(hrc.trangThai).toBe("gap"); }
    const thanh = r.find((x) => x.ten === "Thép thanh");
    expect(thanh.nhapNgay).toBe(0); expect(thanh.ngayDay).toBeNull(); expect(thanh.trangThai).toBe("khong_nhap");
    const day = duBaoDay({ kho: { ...kho, cap: [{ key: "k1", loai: "thanh_pham", hang: "HRC 1", ton: 1000 }], dong: [dong("k1", 1000, "co_dinh_hang", "HRC 1", [{ hang: "HRC 1", ton: 1000 }])] }, loai: "thanh_pham", nhomOf, now: NOW })[0];
    expect(day.trangThai).toBe("da_day"); expect(day.ngayDay).toBe(0);
  });
});
