import { describe, it, expect } from "vitest";
import { tonTheoLoaiHang, duBaoDay, duBaoTonDiem } from "./tonLoaiHang";

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

describe("dự báo tồn các điểm còn lại của kỳ (Diễn biến tồn)", () => {
  const ngays = ["2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25"];
  const kyInfo = { ngays, buoc: "ngay", homNay: "2026-11-22" };
  const c = { diem: ngays.map((dau) => ({ dau })), ds: [{ k: "hrc", ten: "HRC", hienTai: 500, ton: [450, 500, null, null, null] }] };
  const nomOfHRC = () => "HRC";
  it("theo kế hoạch: nhập / xuất mỗi ngày chia đều theo kỳ kế hoạch, nối với điểm thực tế cuối", () => {
    const keHoach = [{ khu_key: "k1", huong: "nhap", khoi_luong: 200, hang: "HRC 1", loai_ky: "ngay", ky: "2026-11-23" }, { khu_key: "k1", huong: "xuat", khoi_luong: 50, hang: "HRC 1", loai_ky: "ngay", ky: "2026-11-24" }];
    const r = duBaoTonDiem(kyInfo, { c, kho, loai: "thanh_pham", nhomOf: nomOfHRC, keHoach, che: "kh", now: NOW });
    expect(r.theo.get("hrc")).toEqual([null, 500, 700, 650, 650]);
    expect(r.tongNhap).toBe(200); expect(r.tongXuat).toBe(50); expect(r.coSo).toBe(true);
  });
  it("theo trung bình thực tế 30 ngày: nhập / xuất bình quân mỗi ngày cộng dồn", () => {
    const gd = [{ ngay: "2026-11-10", loai: "nhap", ten_bai: "Bk1", hang: "HRC 1", so_luong: 300 }, { ngay: "2026-11-12", loai: "xuat", ten_bai: "Bk1", hang: "HRC 1", so_luong: 60 }]; // nhập 10 / ngày, xuất 2 / ngày
    const r = duBaoTonDiem(kyInfo, { c, kho, loai: "thanh_pham", nhomOf: nomOfHRC, giaoDich: gd, che: "bq", now: NOW });
    expect(r.theo.get("hrc")).toEqual([null, 500, 508, 516, 524]);
  });
  it("tự chọn nguồn từng hàng: có kế hoạch còn hiệu lực thì theo kế hoạch, không có thì trung bình thực tế", () => {
    const keHoach = [{ khu_key: "k1", huong: "nhap", khoi_luong: 200, hang: "HRC 1", loai_ky: "ngay", ky: "2026-11-23" }];
    const gd = [{ ngay: "2026-11-10", loai: "nhap", ten_bai: "Bk1", hang: "HRC 1", so_luong: 300 }];
    const r = duBaoTonDiem(kyInfo, { c, kho, loai: "thanh_pham", nhomOf: nomOfHRC, keHoach, giaoDich: gd, now: NOW });
    expect(r.nguon.get("hrc")).toBe("kh"); expect(r.theo.get("hrc")).toEqual([null, 500, 700, 700, 700]);
    const r2 = duBaoTonDiem(kyInfo, { c, kho, loai: "thanh_pham", nhomOf: nomOfHRC, keHoach: [], giaoDich: gd, now: NOW }); // không kế hoạch -> trung bình 30 ngày (nhập 10 / ngày)
    expect(r2.nguon.get("hrc")).toBe("bq"); expect(r2.theo.get("hrc")).toEqual([null, 500, 510, 520, 530]);
    const cu = [{ khu_key: "k1", huong: "nhap", khoi_luong: 200, hang: "HRC 1", loai_ky: "ngay", ky: "2026-11-20" }]; // kế hoạch đã qua hết -> coi như không có
    expect(duBaoTonDiem(kyInfo, { c, kho, loai: "thanh_pham", nhomOf: nomOfHRC, keHoach: cu, giaoDich: gd, now: NOW }).nguon.get("hrc")).toBe("bq");
  });
  it("không xuống dưới 0 và kỳ đã qua thì không dự báo", () => {
    const keHoach = [{ khu_key: "k1", huong: "xuat", khoi_luong: 900, hang: "HRC 1", loai_ky: "ngay", ky: "2026-11-23" }];
    expect(duBaoTonDiem(kyInfo, { c, kho, loai: "thanh_pham", nhomOf: nomOfHRC, keHoach, che: "kh", now: NOW }).theo.get("hrc")).toEqual([null, 500, 0, 0, 0]);
    expect(duBaoTonDiem({ ...kyInfo, homNay: "2026-11-25" }, { c, kho, loai: "thanh_pham", nhomOf: nomOfHRC, keHoach, che: "kh", now: NOW }).theo.size).toBe(0);
  });
});
