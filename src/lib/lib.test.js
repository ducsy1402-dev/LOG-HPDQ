// Kiểm thử công thức bằng số liệu phiếu mẫu MARINE HONESTY / 2026 / 0001 (tài liệu kế hoạch, hình 2)
import { describe, it, expect } from "vitest";
import { duToan, etdKhongKhaThi, mocBatDau } from "./laytime";
import { chiSo, trangThai, maChuyenMoi, mocSaiThuTu, gioDung } from "./linetime";
import { timBen, canhBaoChuyen } from "./checks";
import { docSo, docNgayGio } from "./paste";
import { thoiLuong } from "./format";

const t = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const iso = (...a) => new Date(t(...a)).toISOString();

const MARINE = {
  id: 1, ma_chuyen: "MARINE HONESTY / 2026 / 0001", ten_tau: "MARINE HONESTY", ben_ma: "10",
  khoi_luong: 110680, da_lam: 0, cam_ket: 15000,
  // Hợp đồng NOR + 12h: NOR 19/10 19:36 -> bắt đầu tính 20/10 07:36 (đúng "TG tính thưởng phạt" trên phiếu)
  nor: iso(2026, 10, 19, 19, 36), moc_tinh_tp: "nor_12h", atb: iso(2026, 10, 22, 9, 15), etd: iso(2026, 10, 25, 2, 0),
};
const BEN10 = { ma: "10", ten_khac: ["B10"], dwt_max: 250000, mon_max: 18.5, mon_cung: true, loa_max: 410, loai_hang: "Than, quặng, HRC xuất khẩu" };

describe("Thưởng phạt (laytime)", () => {
  it("thời gian cho phép = KL ÷ cam kết = 7,379 ngày", () => {
    const dt = duToan(MARINE, [], null, t(2026, 10, 22, 11, 26));
    expect(dt.choPhepNgay).toBeCloseTo(7.3787, 3);
    expect(thoiLuong(dt.choPhepNgay * 24)).toBe("7 ngày 9,09 giờ");
  });
  it("mốc bắt đầu là NOR, hạn không phạt ≈ 16:41 ngày 27/10", () => {
    const dt = duToan(MARINE, [], null, t(2026, 10, 22, 11, 26));
    expect(mocBatDau(MARINE).t).toBe(t(2026, 10, 20, 7, 36));
    const han = new Date(dt.han);
    expect([han.getDate(), han.getHours(), han.getMinutes()]).toEqual([27, 16, 41]);
  });
  it("lúc 11:26 ngày 22/10 còn lại khoảng 5 ngày 5,25 giờ như phiếu", () => {
    const now = t(2026, 10, 22, 11, 26);
    const conGio = (duToan(MARINE, [], null, now).han - now) / 3600e3;
    expect(conGio).toBeCloseTo(5 * 24 + 5.25, 0);
  });
  it("giờ loại trừ (đánh dấu trừ) lùi hạn, khoảng không trừ thì không", () => {
    const stops = [
      { tu: iso(2026, 10, 23, 0, 0), den: iso(2026, 10, 23, 6, 0), tru_tp: true },
      { tu: iso(2026, 10, 23, 8, 0), den: iso(2026, 10, 23, 10, 0), tru_tp: false },
    ];
    const now = t(2026, 10, 24);
    const a = duToan(MARINE, [], null, now), b = duToan(MARINE, stops, null, now);
    expect((b.han - a.han) / 3600e3).toBeCloseTo(6, 5);
  });
  it("xong sớm được thưởng 50% đơn giá, xong muộn bị phạt", () => {
    const tien = { don_gia: 10_000_000 };
    const som = { ...MARINE, bd_lam_hang: iso(2026, 10, 22, 10), kt_lam_hang: iso(2026, 10, 26, 7, 36), da_lam: 110680 };
    const dt1 = duToan(som, [], tien);
    expect(dt1.daDungNgay).toBeCloseTo(6, 5);
    expect(dt1.tien.thuong).toBeCloseTo((7.37867 - 6) * 10_000_000 * 0.5, -2);
    expect(dt1.tien.phat).toBe(0);
    const muon = { ...som, kt_lam_hang: iso(2026, 10, 29, 7, 36) };
    const dt2 = duToan(muon, [], tien);
    expect(dt2.tien.phat).toBeCloseTo((9 - 7.37867) * 10_000_000, -2);
  });
  it("ví dụ công ty: phạt 25.000 USD/ngày, xong sớm 1 ngày -> thưởng 12.500 USD", () => {
    const v = { khoi_luong: 10000, cam_ket: 5000, moc_tinh_tp: "tay", tg_tinh_tp: iso(2026, 10, 1, 8), bd_lam_hang: iso(2026, 10, 1, 8), kt_lam_hang: iso(2026, 10, 2, 8), da_lam: 10000 };
    const dt = duToan(v, [], { don_gia: 25000, don_vi_tien: "USD" });
    expect(dt.chenhNgay).toBeCloseTo(1, 6);
    expect(dt.tien).toEqual({ phat: 0, thuong: 12500, dv: "USD" });
  });
  it("bắt đầu laytime: NOR + 24h, 8h ngày kế tiếp, làm hàng sớm hơn thì tính từ lúc làm hàng", () => {
    const nor = iso(2026, 10, 20, 15, 0);
    expect(mocBatDau({ nor, moc_tinh_tp: "nor_24h" }).t).toBe(t(2026, 10, 21, 15, 0));
    expect(mocBatDau({ nor, moc_tinh_tp: "nor_8h" }).t).toBe(t(2026, 10, 21, 8, 0));
    expect(mocBatDau({ nor: iso(2026, 10, 24, 22, 0), moc_tinh_tp: "nor_8h" }).t).toBe(t(2026, 10, 25, 8, 0)); // Chủ nhật vẫn tính
    expect(mocBatDau({ nor, moc_tinh_tp: "nor_12h", bd_lam_hang: iso(2026, 10, 20, 20, 0) }).t).toBe(t(2026, 10, 20, 20, 0));
    expect(mocBatDau({ nor, moc_tinh_tp: "nor_12h", bd_lam_hang: iso(2026, 10, 21, 9, 0) }).t).toBe(t(2026, 10, 21, 3, 0));
  });
  it("hết laytime thì không trừ thời gian đình trệ nữa", () => {
    const v = { khoi_luong: 5000, cam_ket: 5000, moc_tinh_tp: "tay", tg_tinh_tp: iso(2026, 10, 1, 0), bd_lam_hang: iso(2026, 10, 1, 0), kt_lam_hang: iso(2026, 10, 4, 0), da_lam: 5000 };
    const mua = [{ tu: iso(2026, 10, 3, 0), den: iso(2026, 10, 3, 6), tru_tp: true }]; // mưa sau khi đã hết laytime (hết lúc 2/10 0:00)
    expect(duToan(v, mua).chenhNgay).toBeCloseTo(-2, 6);
    const muaTrong = [{ tu: iso(2026, 10, 1, 12), den: iso(2026, 10, 1, 18), tru_tp: true }]; // mưa trong laytime: lùi hạn 6 giờ
    expect(duToan(v, muaTrong).chenhNgay).toBeCloseTo(-1.75, 6);
  });
  it("CQD: giờ trống máng vượt ngưỡng × đơn giá, không có thưởng", () => {
    const v = { kieu_tp: "cqd", cqd_nguong_gio: 12, khoi_luong: 20000, bd_lam_hang: iso(2026, 10, 1, 0), kt_lam_hang: iso(2026, 10, 4, 0), da_lam: 20000 };
    const stops = [{ tu: iso(2026, 10, 1, 10), den: iso(2026, 10, 1, 20), trong_mang: true }, { tu: iso(2026, 10, 2, 5), den: iso(2026, 10, 2, 10), trong_mang: true }, { tu: iso(2026, 10, 2, 12), den: iso(2026, 10, 2, 18), trong_mang: false }];
    const dt = duToan(v, stops, { don_gia: 24000, don_vi_tien: "USD" });
    expect(dt.trongMangGio).toBe(15);
    expect(dt.vuotGio).toBe(3);
    expect(dt.tien).toEqual({ phat: 3000, thuong: 0, dv: "USD" });
  });
  it("không có quyền xem tiền thì không trả số tiền", () => {
    expect(duToan(MARINE, [], null).tien).toBeNull();
  });
  it("ETD không khả thi: cần ≈ 41.000 t/ngày so với cam kết 15.000", () => {
    const r = etdKhongKhaThi(MARINE, t(2026, 10, 22, 9, 30));
    expect(r).not.toBeNull();
    expect(Math.round(r.can / 1000)).toBe(41);
  });
});

describe("Linetime", () => {
  it("trạng thái theo mốc (mốc đã qua so với hôm nay)", () => {
    const qua = iso(2026, 10, 1), now = new Date(qua).getTime() + 18e5; // 30 phút sau mốc: chưa tới các mốc dự kiến sau
    expect(trangThai({}, now)).toBe("du_kien");
    expect(trangThai({ nor: qua }, now)).toBe("cho_neo");
    expect(trangThai({ atb: qua }, now)).toBe("cap_ben");
    expect(trangThai({ atb: qua, bd_lam_hang: qua }, now)).toBe("lam_hang");
    expect(trangThai({ atd: qua }, now)).toBe("da_roi");
    expect(trangThai({ atd: qua, huy: true }, now)).toBe("huy");
    expect(trangThai({ nor: iso(2026, 10, 9) }, now)).toBe("du_kien");
    expect(trangThai({ atb: qua }, now + 5 * 864e5)).toBe("xong_hang"); // đã cập thật, chưa ghi ATD: dự kiến dừng ở xong hàng // mốc nhập trước cho tương lai: chưa tính
  });
  it("chỉ số: chờ bến (từ NOR), làm hàng thực trừ dừng, năng suất, % hoàn tất vượt 100%", () => {
    const v = { nor: iso(2026, 10, 1, 0), atb: iso(2026, 10, 2, 12), bd_lam_hang: iso(2026, 10, 2, 14), kt_lam_hang: iso(2026, 10, 4, 14), khoi_luong: 10000, da_lam: 10135, cam_ket: 5000 };
    const stops = [{ tu: iso(2026, 10, 3, 0), den: iso(2026, 10, 3, 12), tru_tp: true }];
    const cs = chiSo(v, stops);
    expect(cs.choNeo).toBe(36);
    expect(cs.lamHang).toBe(48);
    expect(cs.lamHangThuc).toBe(36);
    expect(cs.nangSuat).toBeCloseTo((10135 / 36) * 24, 5);
    expect(cs.hoanTat).toBeCloseTo(1.0135, 5);
  });
  it("giờ dừng chỉ tính phần nằm trong khoảng", () => {
    expect(gioDung([{ tu: iso(2026, 1, 1, 0), den: iso(2026, 1, 1, 10) }], t(2026, 1, 1, 5), t(2026, 1, 1, 8))).toBe(3);
  });
  it("mã chuyến tự tăng theo tàu và năm", () => {
    expect(maChuyenMoi("Marine Honesty", 2026, [MARINE])).toBe("MARINE HONESTY / 2026 / 0002");
    expect(maChuyenMoi("ABC", 2026, [MARINE])).toBe("ABC / 2026 / 0001");
  });
  it("phát hiện mốc sai thứ tự", () => {
    expect(mocSaiThuTu({ atb: iso(2026, 1, 2), bd_lam_hang: iso(2026, 1, 1) })).toHaveLength(1);
  });
});

describe("Kiểm tra tàu - bến", () => {
  it("tìm bến theo tên khác", () => {
    const ds = [BEN10, { ma: "1A", ten_khac: ["TL", "BTL"] }];
    expect(timBen(ds, "B10")?.ma).toBe("10");
    expect(timBen(ds, "BTL")?.ma).toBe("1A");
    expect(timBen(ds, "b 10")?.ma).toBe("10");
  });
  it("chuyến mẫu không còn cảnh báo ETD không khả thi (đã bỏ)", () => {
    const c = canhBaoChuyen(MARINE, { berths: [BEN10], now: t(2026, 10, 22, 11, 26) });
    expect(c.some((x) => x.ma === "etd")).toBe(false);
  });
});

describe("Dán nhanh", () => {
  it("đọc số kiểu Việt Nam", () => {
    expect(docSo("110.680")).toBe(110680);
    expect(docSo("110,680")).toBe(110.68); expect(docSo("667,756 tấn")).toBe(667.756); expect(docSo("1,234,567")).toBe(1234567); expect(docSo("12.5")).toBe(12.5);
    expect(docSo("7,2")).toBe(7.2);
    expect(docSo("1.234,5")).toBe(1234.5);
    expect(docSo("15.000 t/ngày")).toBe(15000);
    expect(docSo("CQD")).toBeNull();
    expect(docSo("10tr")).toBeNull();
  });
  it("đọc ngày giờ", () => {
    const now = t(2026, 10, 22);
    expect(new Date(docNgayGio("22/10 09:15", now)).getTime()).toBe(t(2026, 10, 22, 9, 15));
    expect(new Date(docNgayGio("20/10/2026 7h36", now)).getTime()).toBe(t(2026, 10, 20, 7, 36));
    expect(new Date(docNgayGio("2026-10-25 02:00", now)).getTime()).toBe(t(2026, 10, 25, 2, 0));
    expect(new Date(docNgayGio("02/01 08:00", t(2026, 12, 28))).getFullYear()).toBe(2027);
    expect(docNgayGio("TBA", now)).toBeNull();
  });
});
