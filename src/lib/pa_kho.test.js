// Kiểm thử phương án làm hàng và kho bãi
import { describe, it, expect } from "vitest";
import { tocDoGoiY, thoiGianLam, tinhPhuongAn, caTrongKhoang, thietBiChuyen, giaiDoanMau } from "./phuongAn";
import { sucChua, tiTrong, loaiKhoTuHang, tongHopKho, canhBaoKho, choTrongBai, tonTheoNgay, ngayStr, luuLuongKho, kieuBai, goiYBai, khuNhan } from "./kho";

const t = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const iso = (...a) => new Date(t(...a)).toISOString();
const CRANES = [{ ma: "QC06", nang_suat: "2000" }, { ma: "QC07", nang_suat: "2000t/h" }, { ma: "QC08", nang_suat: null }];

describe("Phương án làm hàng", () => {
  it("tốc độ gợi ý = tổng năng suất cẩu × giờ làm / ngày × hệ số", () => {
    const g = tocDoGoiY(CRANES, { cau: ["QC06", "QC07", "QC08"], gio_lam_ngay: 20, he_so: 0.5 });
    expect(g.tph).toBe(4000);
    expect(g.tanNgay).toBe(40000);
    expect(g.thieu).toEqual(["QC08"]);
  });
  it("khởi động: ca đầu 60%, ca hai 85%", () => {
    // 24.000 t/ngày = 1.000 t/giờ: ca 1 làm 7.200 t, ca 2 làm 10.200 t, ca 3 trở đi 12.000 t
    expect(thoiGianLam(7200, 24000, true)).toBeCloseTo(12, 6);
    expect(thoiGianLam(17400, 24000, true)).toBeCloseTo(24, 6);
    expect(thoiGianLam(17400 + 6000, 24000, true)).toBeCloseTo(30, 6);
    expect(thoiGianLam(24000, 24000, false)).toBeCloseTo(24, 6);
  });
  it("giờ hoàn tất, so hạn laytime và số xe gợi ý mỗi ca", () => {
    const v = { khoi_luong: 48000, cam_ket: 24000, moc_tinh_tp: "tay", tg_tinh_tp: iso(2026, 11, 1, 0), etb: iso(2026, 11, 1, 0), etd: iso(2026, 11, 4, 0) };
    const plan = { toc_do: 24000, khoi_dong: false, gio_dung_tt: 6, gio_dung_khac: 0, xe: [{ loai: "Xe ben", tai_trong: 30, chuyen_ca: 10, don_vi: "hoa_phat" }] };
    const kq = tinhPhuongAn(v, plan, { now: t(2026, 10, 30) });
    expect(kq.ketThuc).toBe(t(2026, 11, 3, 6)); // 48 giờ làm + 6 giờ thời tiết
    expect(kq.dt.chenhNgay).toBeCloseTo(0, 6); // thời tiết được trừ laytime: xong đúng hạn
    expect(kq.etdGio).toBeCloseTo(18, 6);
    expect(kq.tanCa).toBe(12000);
    expect(kq.xe[0].goiY).toBe(40); // 12.000 ÷ (30 × 10)
  });
  it("bãi nhận thiếu chỗ thì cảnh báo", () => {
    const v = { khoi_luong: 50000, cam_ket: 20000, etb: iso(2026, 11, 1) };
    const kq = tinhPhuongAn(v, { toc_do: 20000, bai_hang: "Bãi A", xe: [] }, { choTrong: () => 30000, now: t(2026, 10, 30) });
    expect(kq.canh.some((c) => c.muc === "bad" && /thiếu chỗ/.test(c.nd))).toBe(true);
  });
  it("hệ số khởi động sửa được theo phương án", () => {
    // ca 1: 50% × 12.000 = 6.000 t; ca 2: 80% = 9.600 t; còn 2.400 t ở 100% (1.000 t/giờ) = 2,4 giờ
    expect(thoiGianLam(18000, 24000, [0.5, 0.8])).toBeCloseTo(26.4, 6);
    const v = { khoi_luong: 18000, etb: iso(2026, 11, 1) };
    const kq = tinhPhuongAn(v, { toc_do: 24000, khoi_dong: true, khoi_dong_hs: [0.5, 0.8], bat_dau: iso(2026, 11, 1, 8), xe: [] }, { now: t(2026, 10, 30) });
    expect(kq.lamGio).toBeCloseTo(26.4, 6);
    expect(tinhPhuongAn(v, { toc_do: 24000, khoi_dong: false, khoi_dong_hs: [0.5, 0.8], xe: [] }, { now: t(2026, 10, 30) }).lamGio).toBeCloseTo(18, 6);
  });
  it("nhiều điểm hạ hàng: kiểm tra chỗ trống từng bãi, thiết bị Hòa Phát so với số sẵn sàng", () => {
    const v = { khoi_luong: 50000, etb: iso(2026, 11, 1) };
    const plan = { toc_do: 20000, xe: [], diem: [{ bai: "Bãi A", khoi_luong: 30000, tb: [{ loai: "Xúc lật", so: 2, don_vi: "hoa_phat" }] }, { bai: "Bãi B", khoi_luong: 20000, tb: [{ loai: "Xúc lật", so: 2, don_vi: "hoa_phat" }] }],
      tb_khac: [{ viec: "be_ham", loai: "Xúc đào", so: 2, don_vi: "nha_thau" }] };
    const kq = tinhPhuongAn(v, plan, { choTrong: (b) => (b === "Bãi A" ? 40000 : 10000), xeSanSang: () => 3, now: t(2026, 10, 30) });
    expect(kq.canh.filter((c) => /thiếu chỗ/.test(c.nd)).map((c) => c.nd.split(" ")[0] + " " + c.nd.split(" ")[1])).toEqual(["Bãi B"]);
    expect(kq.canh.some((c) => /Xúc lật: cần 4\/ca/.test(c.nd))).toBe(true); // 2 + 2 xúc lật Hòa Phát, đội có 3
    expect(kq.canh.some((c) => /Xúc đào/.test(c.nd))).toBe(false); // nhà thầu: không so
  });
  it("chia ca 08–20 / 20–08", () => {
    const ca = caTrongKhoang(t(2026, 11, 1, 10), t(2026, 11, 2, 9));
    expect(ca.map((c) => [new Date(c.s).getDate(), new Date(c.s).getHours(), c.so])).toEqual([[1, 8, 1], [1, 20, 2], [2, 8, 1]]);
  });
});

describe("Kho bãi", () => {
  const HH = [{ loai_hang: "Phế HMS", nhom: "Phế", ti_trong: 0.6 }, { loai_hang: "Phế HS", nhom: "Phế", ti_trong: 0.8 }, { loai_hang: "Quặng vê viên", nhom: "Quặng", ti_trong: 2.2 }, { loai_hang: "Thép cuộn HRC", nhom: "Thép", ti_trong: 1.5 }];
  it("tỉ trọng theo tên, không có thì bình quân nhóm", () => {
    expect(tiTrong("Quặng vê viên", HH)).toBe(2.2);
    expect(tiTrong("Phế", HH)).toBeCloseTo(0.7, 6);
  });
  it("sức chứa = diện tích × cao × tỉ trọng; nhập tay thì dùng số nhập", () => {
    expect(sucChua({ dien_tich: 10000, chieu_cao: 5, hang: "Quặng vê viên" }, HH).tan).toBeCloseTo(110000, 6);
    expect(sucChua({ dien_tich: 10000, chieu_cao: 5, hang: "X", suc_chua_tay: 1234 }, HH).tan).toBe(1234);
    expect(sucChua({ dien_tich: 10000, hang: "Quặng vê viên" }, HH).tan).toBeNull();
  });
  it("tự phân loại kho theo nhóm hàng", () => {
    expect(loaiKhoTuHang("Thép cuộn HRC", HH)).toBe("thanh_pham");
    expect(loaiKhoTuHang("Phế HMS", HH)).toBe("nguyen_lieu");
    expect(loaiKhoTuHang("Thép phế >= 3mm", HH)).toBe("nguyen_lieu");
  });
  it("tồn, lấp đầy, số ngày cấp, cảnh báo bãi đầy và tàu thiếu chỗ", () => {
    const now = t(2026, 11, 1, 12);
    const khoBai = [{ id: 1, ten_bai: "Bãi A", dien_tich: 10000, chieu_cao: 5, hang: "Quặng vê viên" }];
    const khoTon = [{ ten_bai: "Bãi A", hang: "Quặng vê viên", so_lo: "", ton: 100000 }];
    const giaoDich = Array.from({ length: 30 }, (_, i) => ({ ngay: ngayStr(t(2026, 11, 1) - i * 864e5), loai: "xuat", ten_bai: "Bãi A", hang: "Quặng vê viên", so_luong: 20000 }));
    const th = tongHopKho({ khoBai, khoTon, giaoDich, hangHoa: HH, now });
    expect(th.bai[0].lapDay).toBeCloseTo(100000 / 110000, 6);
    expect(th.dong[0].ngayCap).toBeCloseTo(5, 6);
    expect(choTrongBai(th, "Bãi A")).toBeCloseTo(10000, 6);
    const cb = canhBaoKho(th, { voyages: [{ id: 9, ten_tau: "T", huong: "nhap", bai_hang: "Bãi A", khoi_luong: 30000, etb: iso(2026, 11, 3) }], now });
    expect(cb.map((c) => c.ma).sort()).toEqual(["day", "tau_thieu_cho", "ton_thap"]);
  });
  it("tồn theo ngày đi lùi từ tồn hiện tại", () => {
    const gd = [{ ngay: "2026-11-01", loai: "nhap", ten_bai: "A", hang: "H", so_luong: 100 }, { ngay: "2026-10-31", loai: "xuat", ten_bai: "A", hang: "H", so_luong: 30 }];
    const s = tonTheoNgay(500, gd, (b) => b === "A", 3, t(2026, 11, 1, 12));
    expect(s.map((x) => x[1])).toEqual([430, 400, 500]);
  });
  it("lưu lượng bãi: nhập / xuất bình quân, dự kiến đầy, lưu bãi, năng lực thông qua", () => {
    const now = t(2026, 11, 30, 12), ng = (lui) => ngayStr(now - lui * 864e5);
    const khoBai = [{ id: 1, ten_bai: "Bãi A", hang: "Đá", suc_chua_tay: 20000 }];
    // đầu kỳ 9 ngày trước 6.000 t; 9 ngày qua mỗi ngày nhập 1.000, xuất 500 -> tồn 10.500
    const gd = [{ ngay: ng(9), loai: "dau_ky", ten_bai: "Bãi A", hang: "Đá", so_luong: 6000 }];
    for (let i = 8; i >= 0; i--) gd.push({ ngay: ng(i), loai: "nhap", ten_bai: "Bãi A", hang: "Đá", so_luong: 1000 }, { ngay: ng(i), loai: "xuat", ten_bai: "Bãi A", hang: "Đá", so_luong: 500 });
    const th = tongHopKho({ khoBai, khoTon: [{ ten_bai: "Bãi A", hang: "Đá", so_lo: null, ton: 10500 }], giaoDich: gd, now });
    const l = luuLuongKho(th, { giaoDich: gd, now }).bai.get("Bãi A");
    expect(luuLuongKho(th, { giaoDich: gd, now }).khu.get("k1").nhap).toBeCloseTo(900, 6);
    expect(l.soNgay).toBe(10);
    expect(l.nhap).toBeCloseTo(900, 6); // 9.000 t / 10 ngày (tính cả ngày đầu kỳ)
    expect(l.xuat).toBeCloseTo(450, 6);
    expect(l.ngayDay).toBeCloseTo(9500 / 450, 6);
    expect(l.trangThaiDay).toBe("tang");
    expect(l.luuBai).toBeCloseTo(l.tonTB / 450, 6);
    expect(l.nangLuc).toBeCloseTo((20000 * 0.8) / l.luuBai, 6);
  });
  it("bãi nhỏ cố định 1 hàng / cố định nhóm / tự do: xếp tồn, sai bãi, gợi ý bãi", () => {
    const hh = [{ loai_hang: "Đá vôi 1", nhom: "Đá", ti_trong: 1.5 }, { loai_hang: "Đá vôi 2", nhom: "Đá", ti_trong: 1.5 }, { loai_hang: "Phế HMS", nhom: "Phế", ti_trong: 1 }, { loai_hang: "Quặng X", nhom: "Quặng", ti_trong: 2.5 }];
    const khoBai = [
      { id: 1, ten_bai: "Bãi A", hang: "Đá vôi 1", dien_tich: 1000, chieu_cao: 4 },
      { id: 2, ten_bai: "Bãi A", hang: "Đá vôi 2", kieu_bai: "co_dinh_nhom", dien_tich: 1000, chieu_cao: 4 },
      { id: 3, ten_bai: "Bãi B", hang: "Phế HMS", dien_tich: 1000, chieu_cao: 4 },
      { id: 4, ten_bai: "Bãi C", ten_khu: "Khu tự do", hang: null, kieu_bai: "tu_do", dien_tich: 1000, chieu_cao: 4 },
    ];
    const khoTon = [
      { ten_bai: "Bãi A", hang: "Đá vôi 1", ton: 100 }, { ten_bai: "Bãi A", hang: "Đá 3", ton: 50 }, // Đá 3: nhóm Đá -> khu cố định nhóm (id 2)
      { ten_bai: "Bãi A", hang: "Phế HMS", ton: 30 }, // Bãi A không nhận Phế -> sai bãi
      { ten_bai: "Bãi C", hang: "Quặng X", ton: 1000 }, { ten_bai: "Bãi C", hang: "Phế HMS", ton: 1000 },
    ];
    const th = tongHopKho({ khoBai, khoTon, hangHoa: hh });
    const k = (id) => th.dong.find((d) => d.id === id);
    expect(k(1).ton).toBe(100);
    expect(k(2).ton).toBe(50);
    expect(th.dong.find((d) => d.saiBai).hang).toBe("Phế HMS");
    expect(k(4).ton).toBe(2000);
    expect(k(4).sucChua).toBeCloseTo(1000 * 4 * 1.75, 6); // tỉ trọng bình quân theo tồn (2,5 và 1)
    expect(khuNhan(th, "Bãi A", "Phế HMS")).toBe(null);
    expect(goiYBai(th, "Phế HMS").map((x) => x.ten_bai)).toEqual(["Bãi B", "Bãi C"]); // cố định đúng hàng trước, tự do sau
    expect(kieuBai(th.bai.find((b) => b.ten_bai === "Bãi A")).ten).toBe("Cố định hàng / nhóm");
    expect(kieuBai(th.bai.find((b) => b.ten_bai === "Bãi C")).ma).toBe("tu_do");
  });
});

describe("Thiết bị chuyến: theo phương án nếu có, không thì theo phiếu chuyến", () => {
  const v = { bai_hang: "Bãi A", xe_van_chuyen: [{ loai: "Xe ben", so: 8, don_vi: "hoa_phat" }], cau: ["QC01"], bang_tai: "#1" };
  it("chưa có phương án: lấy phiếu chuyến", () => {
    const tb = thietBiChuyen(v, []);
    expect(tb.plan).toBe(null);
    expect(tb.bai[0].bai).toBe("Bãi A");
    expect(tb.xe[0].so).toBe(8);
    expect(tb.cau).toEqual(["QC01"]);
  });
  it("có phương án: ưu tiên đã duyệt, rồi phương án sửa gần nhất; bỏ phương án hủy", () => {
    const pA = { id: 1, ten: "A", trang_thai: "nhap", updated_at: "2026-10-20T00:00:00Z", cau: ["QC02"], diem: [{ bai: "Bãi B", khu: "Khu 1", khoi_luong: 5000, tb: [] }], xe: [{ loai: "Xe đầu kéo", so_xe: 4 }], tb_khac: [{ viec: "be_ham", loai: "Xúc lật", so: 1 }] };
    const pB = { id: 2, ten: "B", trang_thai: "trinh", updated_at: "2026-10-22T00:00:00Z", cau: ["QC03"], diem: [], xe: [] };
    const pC = { id: 3, ten: "C", trang_thai: "huy", updated_at: "2026-10-23T00:00:00Z", cau: ["QC04"] };
    expect(thietBiChuyen(v, [pA, pB, pC]).plan.ten).toBe("B");
    const tb = thietBiChuyen(v, [{ ...pA, trang_thai: "duyet" }, pB, pC]);
    expect(tb.plan.ten).toBe("A");
    expect(tb.bai).toEqual([{ bai: "Bãi B", khu: "Khu 1", khoi_luong: 5000 }]);
    expect(tb.xe[0]).toEqual({ loai: "Xe đầu kéo", so: 4, don_vi: "hoa_phat" });
    expect(tb.hotVet[0].loai).toBe("Xúc lật");
    expect(tb.bangTai).toBe("#1"); // phương án chưa chọn băng tải: giữ băng tải của chuyến
  });
});

describe("Giai đoạn làm hàng", () => {
  const t0 = new Date(2026, 10, 1, 8).toISOString();
  it("nhập rời: đầu tàu nhanh, giữa đều, cuối vét hầm chậm", () => {
    const v = { huong: "nhap", ten_hang: "Quặng", khoi_luong: 10000, etb: t0 };
    const plan = { toc_do: 24000, khoi_dong: false, bat_dau: t0, xe: [], giai_doan: [{ hang: "Quặng", ten: "Đầu tàu", ty_le: 30, he_so: 120 }, { hang: "Quặng", ten: "Giữa tàu", ty_le: 50, he_so: 100 }, { hang: "Quặng", ten: "Cuối tàu – vét hầm", ty_le: 20, he_so: 60 }] };
    const kq = tinhPhuongAn(v, plan, { now: new Date(2026, 9, 1).getTime() });
    expect(kq.lamGio).toBeCloseTo(2.5 + 5 + 10 / 3, 6); // 3000 t ÷ 1200 t/h, 5000 ÷ 1000, 2000 ÷ 600
    expect(kq.giaiDoan.map((d) => Math.round(d.kl))).toEqual([3000, 5000, 2000]);
    expect(kq.tanCa).toBe(14400); // ca cao điểm 28.800 t/ngày ÷ 2
    expect(kq.theoCa.reduce((s, c) => s + c.tan, 0)).toBeCloseTo(10000, 3);
  });
  it("đã làm trừ dần từ giai đoạn đầu", () => {
    const v = { huong: "nhap", ten_hang: "Quặng", khoi_luong: 10000, da_lam: 4000, bd_lam_hang: new Date(2026, 9, 31).toISOString(), etb: t0 };
    const plan = { toc_do: 24000, xe: [], giai_doan: giaiDoanMau(v) };
    const kq = tinhPhuongAn(v, plan, { now: new Date(2026, 10, 1).getTime() });
    expect(kq.conLai).toBeCloseTo(6000, 6);
    expect(kq.lamGio).toBeCloseTo(4 + 10 / 3, 6); // còn 4.000 t giữa tàu + 2.000 t cuối tàu
  });
  it("tàu nhiều loại hàng: mỗi hàng giai đoạn riêng; cảnh báo tổng % khác 100", () => {
    const v = { huong: "xuat", khoi_luong: 10000, hang_ds: [{ ten_hang: "Thép thanh", khoi_luong: 6000 }, { ten_hang: "Thép cuộn", khoi_luong: 4000 }], etb: t0 };
    const plan = { toc_do: 24000, khoi_dong: false, bat_dau: t0, xe: [], giai_doan: [{ hang: "Thép thanh", ten: "Làm đều", ty_le: 100, he_so: 100 }, { hang: "Thép cuộn", ten: "Làm đều", ty_le: 90, he_so: 50 }] };
    const kq = tinhPhuongAn(v, plan, { now: new Date(2026, 9, 1).getTime() });
    expect(kq.lamGio).toBeCloseTo(6 + 7.2, 6); // 6.000 ÷ 1000 t/h + 3.600 ÷ 500 t/h
    expect(kq.canh.some((c) => /Thép cuộn: tổng các giai đoạn 90%/.test(c.nd))).toBe(true);
    expect(giaiDoanMau(v).length).toBe(6);
  });
});

describe("Biểu mẫu phương án (in PDF / Excel)", () => {
  it("lượt theo giai đoạn, máng chia đều năng suất, tổng số ngày = Σ lượng ÷ năng suất", async () => {
    const { duLieuBieuMau, luoiBieuMau, bookExcelPA } = await import("./bieuMauPA");
    const v = { ten_tau: "MINH PHÁT 26", ben_ma: "1", huong: "xuat", khoi_luong: 4440, so_mang: 2, etb: new Date(2026, 9, 24).toISOString(), etd: new Date(2026, 9, 25).toISOString(),
      hang_ds: [{ ten_hang: "Thép thanh", khoi_luong: 2300 }, { ten_hang: "Thép dây cuộn", khoi_luong: 2140 }] };
    const plan = { ten: "A", toc_do: 3000, khoi_dong: false, xe: [], diem: [{ bai: "Kho A", tb: [] }], tb_khac: [], bieu_mau: { luong: "Kho-Toa-Tàu" },
      giai_doan: [{ hang: "Thép thanh", ten: "Làm đều", ty_le: 100, toc_do: 3802, ham: "2 hầm", cong_nghe: "Cầu bờ - Mâm từ" }, { hang: "Thép dây cuộn", ten: "Làm đều", ty_le: 100, toc_do: 2907, so_mang: 1, cong_nghe: "Cầu bờ - Ngáng/Cáp vải" }] };
    const kq = tinhPhuongAn(v, plan, { now: new Date(2026, 9, 1).getTime() });
    const du = duLieuBieuMau(v, plan, kq, { now: new Date(2026, 9, 24).getTime(), keHoach7: true });
    expect(du.luot.map((l) => [l.hang, l.luong, l.so_mang, l.cn])).toEqual([["Thép thanh", 2300, 2, "Cầu bờ - Mâm từ"], ["Thép dây cuộn", 2140, 1, "Cầu bờ - Ngáng/Cáp vải"]]);
    expect(du.soNgay).toBeCloseTo(2300 / 3802 + 2140 / 2907, 6);
    expect(du.chung.luong).toBe("Bãi - Xe - Tàu"); // phiếu in lấy theo phương án, không còn ô sửa riêng
    const luoi = luoiBieuMau(du);
    expect(luoi.length).toBe(2 + 1 + 1 + 1 + 1); // lượt 1: 2 máng + tổng; lượt 2: 1 máng + tổng; tổng cộng
    expect(luoi[0][5].t).toBe((3802 / 2).toLocaleString("vi-VN", { maximumFractionDigits: 0 }));
    const wb = await bookExcelPA(du);
    const ws = wb.getWorksheet("Phuong an");
    expect(ws.getCell("A1").value).toMatch(/XẾP HÀNG/);
    expect(ws.getCell("G4").value).toBe(4440);
    if (process.env.GHI_FILE) await wb.xlsx.writeFile(process.env.GHI_FILE);
  });
});
