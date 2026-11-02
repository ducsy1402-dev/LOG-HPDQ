// Dữ liệu demo (?demo): chuyến tàu quanh ngày hiện tại. Số liệu dựng quanh phiếu mẫu MARINE HONESTY ngày 22/10/2026,
// rồi dời cả bộ sang ngày hôm nay để demo luôn "đang diễn ra". Đây là số MINH HỌA, không phải dữ liệu thật.
import DM from "./danhMuc.json";
import { tiTrong as ttKho, nhomCua } from "../lib/kho";

const GOC = new Date(2026, 9, 22).getTime(); // 22/10/2026 00:00, ngày của phiếu mẫu
const homNay = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

export function demoData() {
  const lech = homNay() - GOC;
  // "dd/mm hh:mm" theo năm 2026 (tháng 9 – 12), cộng độ lệch để về quanh hôm nay
  const T = (s) => {
    if (!s) return null;
    const [d, h] = s.split(" "), [dd, mm] = d.split("/").map(Number), [hh, mi] = (h || "00:00").split(":").map(Number);
    return new Date(new Date(2026, mm - 1, dd, hh, mi).getTime() + lech).toISOString();
  };
  let id = 0;
  const V = (o) => ({
    id: ++id, huong: "nhap", dai_ly: null, loai_hang: null, ten_hang: null, khoi_luong: null, da_lam: null, ben_ma: null, ben_phu: null, draft: null, loa: null, dwt: null,
    cam_ket: null, cam_ket_ghi_chu: null, eta: null, etb: null, etd: null, nor: null, atb: null, bd_lam_hang: null,
    kt_lam_hang: null, hoan_tat_tt: null, atd: null, moc_tinh_tp: "nor_12h", tg_tinh_tp: null, kieu_tp: "laytime", tru_hoa_tieu: true, cqd_nguong_gio: null, cau: [], bai_hang: null, xe_van_chuyen: [], hot_vet: [], vun_hang: [], huy: false, ghi_chu: null, so_mang: 2, uu_tien: false, vet_ham: false, be_ham: false, hang_ds: [], bai_kl: [], bang_tai: null,
    ...o,
    ...Object.fromEntries(["eta", "etb", "etd", "nor", "atb", "bd_lam_hang", "kt_lam_hang", "hoan_tat_tt", "atd", "tg_tinh_tp"].map((k) => [k, T(o[k])])),
  });
  const ma = (ten, n) => `${ten} / 2026 / ${String(n).padStart(4, "0")}`;

  const voyages = [
    // Phiếu mẫu: tàu mới cập, chưa làm hàng; ETD 25/10 02:00 không khả thi với cam kết 15.000 t/ngày
    V({ ma_chuyen: ma("MARINE HONESTY", 1), ten_tau: "MARINE HONESTY", dai_ly: "VOSA Quảng Ngãi", loai_hang: "Quặng", ten_hang: "Quặng sắt Úc", khoi_luong: 110680, da_lam: 0, ben_ma: "10", draft: 14.6, loa: 229, dwt: 81500, cam_ket: 15000,
      eta: "19/10 16:00", nor: "19/10 19:36", atb: "22/10 09:15", etd: "25/10 02:00", cau: ["QC06", "QC07", "QC08"], bai_hang: "NL-A",
      xe_van_chuyen: [{ loai: "Xe ben", so: 10, don_vi: "hoa_phat" }, { loai: "Xe ben", so: 6, don_vi: "nha_thau" }], hot_vet: [{ loai: "Xúc đào", so: 2, don_vi: "hoa_phat" }], vun_hang: [{ loai: "Xúc lật", so: 2, don_vi: "hoa_phat" }] }),
    // Tiến độ vượt kế hoạch 101,35%
    V({ ma_chuyen: ma("VIỆT THUẬN 1501", 3), ten_tau: "VIỆT THUẬN 1501", dai_ly: "Sao Biển", huong: "xuat", loai_hang: "Xỉ hạt", ten_hang: "Xỉ hạt lò cao", khoi_luong: 3000, da_lam: 3040.5, ben_ma: "4", draft: 5.6, loa: 79.8, dwt: 3150, cam_ket: 3000,
      eta: "21/10 06:00", nor: "21/10 07:00", atb: "21/10 08:10", bd_lam_hang: "21/10 09:00", etd: "22/10 20:00", cau: ["SLD bến 4"] }),
    V({ ma_chuyen: ma("PACIFIC GLORY", 1), ten_tau: "PACIFIC GLORY", dai_ly: "Inlaco Sài Gòn", loai_hang: "Than", ten_hang: "Than cốc", khoi_luong: 75000, da_lam: 31200, ben_ma: "5", draft: 13.8, loa: 225, dwt: 76000, cam_ket: 20000,
      eta: "19/10 12:00", nor: "19/10 15:20", atb: "20/10 06:00", bd_lam_hang: "20/10 08:00", etd: "24/10 18:00", cau: ["SC02", "QC10"], bai_hang: "NL-B",
      xe_van_chuyen: [{ loai: "Xe ben", so: 12, don_vi: "hoa_phat" }], hot_vet: [{ loai: "Xúc đào", so: 1, don_vi: "hoa_phat" }, { loai: "Xúc lật", so: 1, don_vi: "nha_thau" }], vun_hang: [{ loai: "Xúc lật", so: 2, don_vi: "hoa_phat" }] }),
    // Năng suất thấp hơn cam kết
    V({ moc_tinh_tp: "nor_24h", ma_chuyen: ma("ORIENT STAR", 2), ten_tau: "ORIENT STAR", dai_ly: "VOSA Quảng Ngãi", loai_hang: "Quặng", ten_hang: "Quặng Brazil", khoi_luong: 95000, da_lam: 54000, ben_ma: "6", draft: 14.2, loa: 235, dwt: 96000, cam_ket: 18000,
      eta: "17/10 20:00", nor: "18/10 01:00", atb: "18/10 10:00", bd_lam_hang: "18/10 12:00", etd: "23/10 12:00", cau: ["SC05", "SC06"], bai_hang: "NL-A",
      xe_van_chuyen: [{ loai: "Xe ben", so: 14, don_vi: "hoa_phat" }], vun_hang: [{ loai: "Xúc lật", so: 3, don_vi: "hoa_phat" }] }),
    V({ moc_tinh_tp: "nor_8h", ma_chuyen: ma("GREAT HARMONY", 1), ten_tau: "GREAT HARMONY", dai_ly: "Gemadept Shipping", huong: "xuat", loai_hang: "HRC", ten_hang: "Thép cuộn cán nóng HRC", khoi_luong: 30000, da_lam: 0, ben_ma: "11", draft: 10.4, loa: 190, dwt: 52000, cam_ket: 10000,
      eta: "21/10 18:00", nor: "21/10 20:30", atb: "22/10 06:00", etd: "25/10 18:00", cau: ["QC01", "QC02"], bai_hang: "TP-A",
      xe_van_chuyen: [{ loai: "Xe đầu kéo", so: 6, don_vi: "hoa_phat" }], vun_hang: [{ loai: "Xe nâng", so: 2, don_vi: "hoa_phat" }] }),
    // Chờ neo lâu và mớn vượt giới hạn cứng của bến 10
    V({ uu_tien: true, so_mang: null, vet_ham: true, ma_chuyen: ma("CAPE AURORA", 1), ten_tau: "CAPE AURORA", dai_ly: "Inlaco Sài Gòn", loai_hang: "Quặng", ten_hang: "Quặng sắt", khoi_luong: 165000, ben_ma: "10", draft: 18.9, loa: 292, dwt: 180000, cam_ket: 25000, cam_ket_ghi_chu: null,
      eta: "18/10 10:00", nor: "18/10 18:00", etb: "25/10 06:00", etd: "01/11 12:00" }),
    V({ ma_chuyen: ma("HẢI PHÒNG 68", 2), ten_tau: "HẢI PHÒNG 68", dai_ly: "Sao Biển", loai_hang: "Đá", ten_hang: "Đá vôi", khoi_luong: 12000, da_lam: 12000, ben_ma: "7", draft: 7.8, loa: 132, dwt: 13000, cam_ket: 6000,
      eta: "20/10 06:00", nor: "20/10 07:00", atb: "20/10 10:00", bd_lam_hang: "20/10 11:00", kt_lam_hang: "22/10 05:00", etd: "22/10 14:00", cau: ["SC11", "SC12"] }),
    // Hai tàu trùng bến 1A
    V({ ma_chuyen: ma("THÀNH ĐẠT 09", 5), ten_tau: "THÀNH ĐẠT 09", dai_ly: "Sao Biển", huong: "xuat", loai_hang: "Thép thành phẩm", ten_hang: "Thép thanh vằn; Thép cuộn", khoi_luong: 4500,
      hang_ds: [{ ten_hang: "Thép thanh vằn", loai_hang: "Thép thành phẩm", khoi_luong: 3000 }, { ten_hang: "Thép cuộn", loai_hang: "Thép thành phẩm", khoi_luong: 1500 }], ben_ma: "1A", draft: 6.2, loa: 96, dwt: 5200, cam_ket: 2500,
      eta: "23/10 06:00", etb: "23/10 08:00", etd: "25/10 08:00", cau: ["OHC 40T"] }),
    V({ ma_chuyen: ma("PHÚ AN 36", 2), ten_tau: "PHÚ AN 36", dai_ly: "Sao Biển", huong: "xuat", loai_hang: "HRC", ten_hang: "HRC nội địa", khoi_luong: 5000, ben_ma: "1A", draft: 6.5, loa: 99, dwt: 6800, cam_ket: 2500,
      eta: "24/10 10:00", etb: "24/10 12:00", etd: "26/10 18:00" }),
    V({ ma_chuyen: ma("TBA", 1), ten_tau: "TBA", huong: "xuat", loai_hang: "HRC", ten_hang: "HRC xuất khẩu", khoi_luong: 20000, ben_ma: "3", cam_ket_ghi_chu: "CQD", eta: "05/11 06:00", etb: "05/11 10:00" }),
    V({ ma_chuyen: ma("SEA DRAGON", 1), ten_tau: "SEA DRAGON", dai_ly: "Gemadept Shipping", loai_hang: "Phôi", ten_hang: "Phôi vuông", khoi_luong: 15000, ben_ma: "HH2", draft: 9.5, loa: 160, dwt: 28000, cam_ket: 7000,
      eta: "26/10 06:00", etb: "26/10 10:00", etd: "29/10 06:00" }),
    V({ ma_chuyen: ma("HEAVY LIFT 2", 1), ten_tau: "HEAVY LIFT 2", dai_ly: "VOSA Quảng Ngãi", loai_hang: "Thiết bị", ten_hang: "Thiết bị siêu trường siêu trọng", khoi_luong: 3200, ben_ma: "HH3", draft: 7.4, loa: 138, dwt: 12500, cam_ket: 1500,
      eta: "28/10 08:00", etb: "28/10 14:00", etd: "31/10 08:00", cau: ["Cẩu xích 350T"] }),
    V({ ma_chuyen: ma("GOLDEN BRIDGE", 3), ten_tau: "GOLDEN BRIDGE", dai_ly: "Inlaco Sài Gòn", loai_hang: "Phế", ten_hang: "Phế liệu HMS", khoi_luong: 42000, da_lam: 25500, ben_ma: "6CTH", draft: 11.1, loa: 199, dwt: 56000, cam_ket: 12000,
      eta: "19/10 04:00", nor: "19/10 08:00", atb: "20/10 14:00", bd_lam_hang: "20/10 16:00", etd: "24/10 06:00", cau: ["SHC01", "SHC02"], bai_hang: "NL-C",
      xe_van_chuyen: [{ loai: "Xe ben", so: 8, don_vi: "hoa_phat" }], hot_vet: [{ loai: "Xúc đào", so: 1, don_vi: "nha_thau" }], vun_hang: [{ loai: "Xúc lật", so: 1, don_vi: "hoa_phat" }] }),
    V({ ma_chuyen: ma("ASIA PEARL", 1), ten_tau: "ASIA PEARL", dai_ly: "Gemadept Shipping", huong: "xuat", loai_hang: "Slab", ten_hang: "Slab", khoi_luong: 28000, ben_ma: "7CTH", draft: 10.8, loa: 186, dwt: 45000, cam_ket: 9000,
      eta: "27/10 06:00", etb: "27/10 12:00", etd: "31/10 00:00" }),
    V({ ma_chuyen: ma("NAM KHÁNH 18", 4), ten_tau: "NAM KHÁNH 18", dai_ly: "Sao Biển", loai_hang: "Đá", ten_hang: "Đá vôi", khoi_luong: 8000, ben_ma: "8", draft: 6.9, loa: 118, dwt: 9500, cam_ket: 4000,
      eta: "23/10 18:00", etb: "24/10 06:00", etd: "26/10 06:00" }),
    V({ kieu_tp: "cqd", cqd_nguong_gio: 6, cam_ket_ghi_chu: "CQD", ma_chuyen: ma("NAM KHÁNH 26", 2), ten_tau: "NAM KHÁNH 26", dai_ly: "Sao Biển", loai_hang: "Quặng hồi", ten_hang: "Quặng hồi", khoi_luong: 7000, da_lam: 2600, ben_ma: "9", draft: 6.8, loa: 112, dwt: 9000, cam_ket: 4000,
      eta: "21/10 12:00", nor: "21/10 13:00", atb: "21/10 18:00", bd_lam_hang: "21/10 19:00", etd: "23/10 18:00", cau: ["SC09"] }),
    V({ ma_chuyen: ma("HƯNG THỊNH 05", 6), ten_tau: "HƯNG THỊNH 05", dai_ly: "Sao Biển", huong: "xuat", loai_hang: "Xỉ", ten_hang: "Xỉ thép", khoi_luong: 6000, ben_ma: "2", draft: 6.5, loa: 102, dwt: 7200, cam_ket: 3000,
      eta: "25/10 06:00", etb: "25/10 08:00", etd: "27/10 08:00", cau: ["SLD bến 2"] }),
    // Đã rời trong tháng: thưởng (xong sớm) và phạt (xong muộn)
    V({ ma_chuyen: ma("OCEAN CROWN", 1), ten_tau: "OCEAN CROWN", dai_ly: "VOSA Quảng Ngãi", loai_hang: "Than", ten_hang: "Than nhiệt", khoi_luong: 88000, da_lam: 88000, ben_ma: "5", draft: 14.1, loa: 229, dwt: 82000, cam_ket: 18000,
      eta: "08/10 06:00", nor: "08/10 09:00", atb: "09/10 06:00", bd_lam_hang: "09/10 08:00", kt_lam_hang: "12/10 20:00", hoan_tat_tt: "13/10 02:00", atd: "13/10 05:00", cau: ["SC02", "QC10", "QC11"] }),
    V({ ma_chuyen: ma("STAR LUMINOUS", 2), ten_tau: "STAR LUMINOUS", dai_ly: "Inlaco Sài Gòn", loai_hang: "Quặng", ten_hang: "Quặng sắt", khoi_luong: 102000, da_lam: 102000, ben_ma: "10", draft: 15.2, loa: 250, dwt: 106000, cam_ket: 15000,
      eta: "05/10 12:00", nor: "05/10 16:00", atb: "07/10 08:00", bd_lam_hang: "07/10 10:00", kt_lam_hang: "14/10 06:00", hoan_tat_tt: "14/10 12:00", atd: "14/10 16:00", cau: ["QC06", "QC07"] }),
    V({ ma_chuyen: ma("VIỆT THUẬN 1501", 2), ten_tau: "VIỆT THUẬN 1501", dai_ly: "Sao Biển", huong: "xuat", loai_hang: "Xỉ hạt", ten_hang: "Xỉ hạt lò cao", khoi_luong: 3000, da_lam: 3000, ben_ma: "4", draft: 5.6, loa: 79.8, dwt: 3150, cam_ket: 3000,
      eta: "10/10 06:00", nor: "10/10 07:00", atb: "10/10 08:00", bd_lam_hang: "10/10 09:00", kt_lam_hang: "11/10 05:00", atd: "11/10 09:00", cau: ["SLD bến 4"] }),
    V({ ma_chuyen: ma("GREAT HARMONY", 2), ten_tau: "GREAT HARMONY", dai_ly: "Gemadept Shipping", huong: "xuat", loai_hang: "HRC", ten_hang: "Thép cuộn cán nóng HRC", khoi_luong: 26000, da_lam: 26000, ben_ma: "11", draft: 10.2, loa: 190, dwt: 52000, cam_ket: 10000,
      eta: "02/10 06:00", nor: "02/10 08:00", atb: "02/10 14:00", bd_lam_hang: "02/10 16:00", kt_lam_hang: "05/10 02:00", atd: "05/10 08:00" }),
    V({ ma_chuyen: ma("PACIFIC GLORY", 2), ten_tau: "PACIFIC GLORY", dai_ly: "Inlaco Sài Gòn", loai_hang: "Than", ten_hang: "Than cốc", khoi_luong: 70000, da_lam: 70000, ben_ma: "6", draft: 13.5, loa: 225, dwt: 76000, cam_ket: 20000,
      eta: "14/09 06:00", nor: "14/09 08:00", atb: "15/09 06:00", bd_lam_hang: "15/09 08:00", kt_lam_hang: "19/09 14:00", atd: "19/09 20:00" }),
    V({ ma_chuyen: ma("CAPE AURORA", 2), ten_tau: "CAPE AURORA", dai_ly: "Inlaco Sài Gòn", loai_hang: "Quặng", ten_hang: "Quặng sắt", khoi_luong: 160000, da_lam: 160000, ben_ma: "11", draft: 17.8, loa: 292, dwt: 180000, cam_ket: 25000,
      eta: "03/09 06:00", nor: "03/09 09:00", atb: "04/09 10:00", bd_lam_hang: "04/09 12:00", kt_lam_hang: "10/09 16:00", atd: "10/09 22:00" }),
    V({ ma_chuyen: ma("HẢI PHÒNG 68", 1), ten_tau: "HẢI PHÒNG 68", dai_ly: "Sao Biển", loai_hang: "Đá", ten_hang: "Đá vôi", khoi_luong: 11000, da_lam: 11000, ben_ma: "7", draft: 7.6, loa: 132, dwt: 13000, cam_ket: 6000,
      eta: "20/09 06:00", nor: "20/09 07:00", atb: "20/09 09:00", bd_lam_hang: "20/09 10:00", kt_lam_hang: "21/09 18:00", atd: "22/09 02:00" }),
    V({ ma_chuyen: ma("SEA FORTUNE", 1), ten_tau: "SEA FORTUNE", dai_ly: "VOSA Quảng Ngãi", huong: "xuat", loai_hang: "HRC", ten_hang: "HRC xuất khẩu", khoi_luong: 18000, ben_ma: "3", huy: true, ghi_chu: "Chủ hàng hủy chuyến",
      eta: "15/10 06:00", etb: "15/10 10:00", etd: "17/10 10:00" }),
  ];
  // Tàu cập hai bến liền nhau (bến phụ, SQL 28) mẫu: 7/8 và 3/5
  for (const [m, ben_ma, ben_phu, loa] of [[ma("NAM KHÁNH 18", 4), "7", "8", null], [ma("TBA", 1), "3", "5", 190]]) {
    const v = voyages.find((x) => x.ma_chuyen === m);
    if (v) Object.assign(v, { ben_ma, ben_phu }, loa ? { loa } : {});
  }
  // Vị trí mét mẫu (SQL 28): SEA DRAGON ghi vị trí trên tuyến HH2 – HH3 như bảng kế hoạch Cảng Tổng hợp
  Object.assign(voyages.find((x) => x.ma_chuyen === ma("SEA DRAGON", 1)) || {}, { vi_tri: 20 });
  const vid = (m) => voyages.find((v) => v.ma_chuyen === m).id;

  let sid = 0;
  const S = (m, tu, den, ly_do, tru_tp = true, ghi_chu = null, trong_mang = false) => ({ id: ++sid, voyage_id: vid(m), tu: T(tu), den: T(den), ly_do, tru_tp, ghi_chu, trong_mang });
  const stops = [
    S(ma("CAPE AURORA", 1), "20/10 08:00", "23/10 20:00", "Chờ cập bến: chưa có bãi nhập", false, "Bãi nhập đầy, chờ giải phóng bãi"),
    S(ma("PACIFIC GLORY", 1), "21/10 02:00", "21/10 05:00", "Thời tiết xấu", true, "Mưa to, dừng làm hàng"),
    S(ma("PACIFIC GLORY", 1), "21/10 19:00", "21/10 20:00", "Nghỉ ca", false),
    S(ma("ORIENT STAR", 2), "19/10 10:00", "19/10 22:00", "Hỏng thiết bị", false, "SC06 hỏng tời"),
    S(ma("ORIENT STAR", 2), "20/10 14:00", "20/10 18:00", "Mưa"),
    S(ma("STAR LUMINOUS", 2), "10/10 00:00", "10/10 18:00", "Mưa"),
    S(ma("GOLDEN BRIDGE", 3), "21/10 08:00", "21/10 12:00", "Chờ xe", false),
    S(ma("NAM KHÁNH 26", 2), "22/10 02:00", "22/10 05:30", "Trống máng", false, "Hết hàng ở bãi", true),
    S(ma("NAM KHÁNH 26", 2), "22/10 13:00", "22/10 15:00", "Chờ xe", false, null, true),
  ];
  let eid = 0;
  const E = (m, t, noi_dung, kl_luy_ke = null) => ({ id: ++eid, voyage_id: vid(m), thoi_diem: T(t), noi_dung, kl_luy_ke, created_at: T(t) });
  const events = [
    E(ma("MARINE HONESTY", 1), "19/10 18:00", "Tàu đến neo khu chờ"),
    E(ma("MARINE HONESTY", 1), "19/10 19:36", "Đại lý nộp NOR (hợp đồng: laytime tính sau NOR 12 giờ)"),
    E(ma("MARINE HONESTY", 1), "22/10 07:40", "Hoa tiêu lên tàu"),
    E(ma("MARINE HONESTY", 1), "22/10 09:15", "Cập bến 10, cẩu QC06 QC07 QC08 sẵn sàng"),
    E(ma("PACIFIC GLORY", 1), "20/10 08:00", "Bắt đầu dỡ hàng"),
    E(ma("PACIFIC GLORY", 1), "21/10 08:00", "Ca 1 bàn giao", 16000),
    E(ma("PACIFIC GLORY", 1), "22/10 06:00", "Ca 2 bàn giao", 31200),
  ];
  const DG = { "MARINE HONESTY": 25000, "PACIFIC GLORY": 18000, "ORIENT STAR": 20000, "GREAT HARMONY": 12000, "OCEAN CROWN": 19000, "STAR LUMINOUS": 22000, "GOLDEN BRIDGE": 14000, "CAPE AURORA": 30000, "NAM KHÁNH 26": 6000 };
  const tien = voyages.filter((v) => DG[v.ten_tau]).map((v) => ({ voyage_id: v.id, don_gia: DG[v.ten_tau], don_vi_tien: "USD", ty_le_thuong: 0.5, ghi_chu: null }));
  tien.push({ voyage_id: vid(ma("HẢI PHÒNG 68", 2)), don_gia: 150e6, don_vi_tien: "VND", ty_le_thuong: 0.5, ghi_chu: null });
  tien.push({ voyage_id: vid(ma("VIỆT THUẬN 1501", 3)), don_gia: 10e6, don_vi_tien: "VND", ty_le_thuong: 0.5, ghi_chu: "10tr dôi nhật" });

  const agents = [...new Set(voyages.map((v) => v.dai_ly).filter(Boolean))].map((ten) => ({ ten, lien_he: null, ghi_chu: null }));
  const vessels = [...new Map(voyages.filter((v) => v.ten_tau !== "TBA").map((v) => [v.ten_tau, { ten: v.ten_tau, dwt: v.dwt, loa: v.loa, draft: v.draft, dai_ly: v.dai_ly, ghi_chu: null }])).values()];
  // Bãi của các chuyến demo theo danh mục kho bãi thật
  const BAI = { "MARINE HONESTY": "Bãi Duafat", "PACIFIC GLORY": "Bãi C2 CTH", "ORIENT STAR": "Bãi đuôi kho 3", "GOLDEN BRIDGE": "Bãi CTH", "GREAT HARMONY": "Bãi TP-A", "CAPE AURORA": "Bãi Duafat", "OCEAN CROWN": "Bãi C2 CTH" };
  for (const v of voyages) if (BAI[v.ten_tau]) v.bai_hang = BAI[v.ten_tau];
  const kho = khoDemo(voyages, vid, ma);
  const plans = [
    { id: 1, voyage_id: vid(ma("MARINE HONESTY", 1)), ten: "A", trang_thai: "duyet", cau: ["QC06", "QC07", "QC08"], gio_lam_ngay: 22, he_so: 0.3, toc_do: 24000, khoi_dong: true, bat_dau: T("22/10 11:00"), gio_dung_tt: 4, gio_dung_khac: 2, bai_hang: "Bãi Duafat",
      xe: [{ loai: "Xe ben", tai_trong: 30, chuyen_ca: 14, so_xe: 22, don_vi: "hoa_phat" }, { loai: "Xe ben", tai_trong: 25, chuyen_ca: 14, so_xe: 6, don_vi: "nha_thau" }], ghi_chu: "3 cẩu giàn, tốc độ chốt 24.000 t/ngày theo năng lực bãi; xe ben Hòa Phát + nhà thầu",
      khoi_dong_hs: [0.6, 0.85], diem: [{ bai: "Bãi Duafat", khoi_luong: 80000, tb: [{ loai: "Xúc lật", so: 2, don_vi: "hoa_phat" }] }, { bai: "Bãi đuôi kho 3", khoi_luong: 30680, tb: [{ loai: "Xúc lật", so: 1, don_vi: "hoa_phat" }] }],
      tb_khac: [{ viec: "be_ham", loai: "Xúc đào", so: 2, don_vi: "hoa_phat" }, { viec: "be_ham", loai: "Xúc lật", so: 1, don_vi: "nha_thau" }, { viec: "ho_tro", loai: "Xe nâng", so: 1, don_vi: "hoa_phat" }], duyet_luc: T("22/10 08:00") },
    { id: 2, voyage_id: vid(ma("MARINE HONESTY", 1)), ten: "B", trang_thai: "nhap", cau: ["QC06", "QC07"], gio_lam_ngay: 22, he_so: 0.3, toc_do: null, khoi_dong: true, bat_dau: T("22/10 11:00"), gio_dung_tt: 4, gio_dung_khac: 2, bai_hang: "Bãi Duafat",
      xe: [{ loai: "Xe ben", tai_trong: 30, chuyen_ca: 14, so_xe: null, don_vi: "hoa_phat" }], ghi_chu: "Chỉ 2 cẩu (QC08 bảo dưỡng)",
      khoi_dong_hs: [0.5, 0.8], diem: [{ bai: "Bãi Duafat", khoi_luong: null, tb: [{ loai: "Xúc lật", so: 2, don_vi: "hoa_phat" }] }], tb_khac: [{ viec: "be_ham", loai: "Xúc đào", so: 2, don_vi: "hoa_phat" }] },
    { id: 3, voyage_id: vid(ma("CAPE AURORA", 1)), ten: "A", trang_thai: "trinh", cau: ["QC06", "QC07", "QC08"], gio_lam_ngay: 22, he_so: 0.3, toc_do: null, khoi_dong: true, bat_dau: null, gio_dung_tt: 6, gio_dung_khac: 2, bai_hang: "Bãi Duafat",
      xe: [{ loai: "Xe ben", tai_trong: 30, chuyen_ca: 14, so_xe: null, don_vi: "hoa_phat" }], ghi_chu: "Nhập rời: đầu tàu nhanh, cuối tàu vét hầm chậm",
      giai_doan: [{ hang: "Quặng sắt", ten: "Đầu tàu", ty_le: 30, he_so: 120 }, { hang: "Quặng sắt", ten: "Giữa tàu", ty_le: 50, he_so: 100 }, { hang: "Quặng sắt", ten: "Cuối tàu – vét hầm", ty_le: 20, he_so: 60 }] },
    { id: 4, voyage_id: vid(ma("THÀNH ĐẠT 09", 5)), ten: "A", trang_thai: "nhap", cau: ["OHC 40T"], gio_lam_ngay: 22, he_so: 0.6, toc_do: 3000, khoi_dong: false, bat_dau: null, gio_dung_tt: 0, gio_dung_khac: 1, bai_hang: "Bãi TP-A",
      diem: [{ bai: "Bãi TP-A", khoi_luong: 4500, tb: [{ loai: "Xe nâng", so: 2, don_vi: "hoa_phat" }] }],
      xe: [{ loai: "Xe đầu kéo", tai_trong: 30, chuyen_ca: 5, so_xe: null, don_vi: "hoa_phat" }], ghi_chu: "Xuất 2 loại thép: thanh vằn trước, cuộn sau; đầu tàu be hầm, cuối tàu lashing",
      giai_doan: [{ hang: "Thép thanh vằn", ten: "Đầu tàu – be hầm", ty_le: 20, he_so: 70 }, { hang: "Thép thanh vằn", ten: "Giữa tàu", ty_le: 60, he_so: 115 }, { hang: "Thép thanh vằn", ten: "Cuối tàu – lashing", ty_le: 20, he_so: 75 },
        { hang: "Thép cuộn", ten: "Đầu tàu – be hầm", ty_le: 20, he_so: 70 }, { hang: "Thép cuộn", ten: "Giữa tàu", ty_le: 60, he_so: 115 }, { hang: "Thép cuộn", ten: "Cuối tàu – lashing", ty_le: 20, he_so: 75 }] },
  ];
  const bangTaiBen = (ma) => [...new Set(DM.cranes.filter((c) => (c.ben_phuc_vu || []).includes(ma) && c.bang_tai).flatMap((c) => c.bang_tai.split(",").map((x) => x.trim())))].sort().join(", ") || null;
  // Mục tiêu sản lượng tháng mẫu (SQL 21): tháng trước và tháng này
  const thang = (lech) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + lech); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const MT_MAU = [["nhap", "Quặng", 400000], ["nhap", "Than", 180000], ["nhap", "Phế", 50000], ["nhap", "Đá", 20000], ["xuat", "HRC", 70000], ["xuat", "Thép thành phẩm", 30000], ["xuat", "Slab", 20000]];
  const mucTieu = [-1, 0].flatMap((lech) => MT_MAU.map(([huong, loai_hang, tan]) => ({ thang: thang(lech), huong, loai_hang, tan: lech ? Math.round(tan * 0.92) : tan, ghi_chu: null })));
  // Cột tự thêm "Khu vực" của danh mục kho bãi (mẫu): chia bãi lớn vào 4 khu theo thứ tự trong danh mục
  const dmCot = [{ bang: "kho", ma: "khu_vuc", ten: "Khu vực", loai: "text", thu_tu: 0 }];
  const tenBaiDs = [...new Set(kho.khoBai.map((r) => r.ten_bai))];
  for (const r of kho.khoBai) r.them = { ...(r.them || {}), khu_vuc: `Khu ${"ABCD"[Math.floor((tenBaiDs.indexOf(r.ten_bai) * 4) / tenBaiDs.length)]}` };
  // Kế hoạch xuất / nhập tồn kho theo tháng và bãi nhỏ mẫu (SQL 27): tháng trước, tháng này, tháng sau
  const khoKeHoach = [];
  for (const lech of [-1, 0, 1]) for (const k of kho.khoBai) {
    const cap = k.suc_chua_tay || (k.dien_tich || 0) * (k.chieu_cao || 0) * 1.5; if (!(cap > 0)) continue;
    const nh = nhomCua(k.hang, DM.hanghoa) || null;
    for (const [huong, he] of [["nhap", 0.3], ["xuat", 0.26]]) khoKeHoach.push({ id: khoKeHoach.length + 1, thang: thang(lech), ten_bai: k.ten_bai, khu_key: `k${k.id}`, ten_khu: k.ten_khu || k.hang || "Khu tự do", hang: k.hang || null, nhom: nh, huong, khoi_luong: Math.round((cap * he) / 100) * 100, ghi_chu: null });
  }
  return { mucTieu, khoKeHoach, dmCot, berths: DM.berths.map((b) => ({ ...b, bang_tai: bangTaiBen(b.ma) })), khoBai: kho.khoBai, giaoDich: kho.giaoDich, khoLo: kho.khoLo, plans, voyages, stops, events, tien, agents, vessels, nextId: { v: id, s: sid, e: eid, p: plans.length, g: kho.giaoDich.length, k: khoKeHoach.length } };
}

// ---------- Kho demo: chiều cao chất đống, tồn đầu kỳ, nhập từ tàu / sản xuất, xuất cấp sản xuất / theo tàu, lô thành phẩm ----------
function khoDemo(voyages, vid, ma) {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const d0 = new Date(); const homNay = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
  const ngay = (lui) => { const d = new Date(homNay.getTime() - lui * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const tiTrong = (hang) => ttKho(hang, DM.hanghoa) || 1.5;
  // Bãi nguyên liệu: cao 5 m; thêm 3 bãi thành phẩm (sức chứa nhập tay)
  // Mỗi dòng là một bãi nhỏ; minh họa: khu quặng cố định nhóm ở Bãi đuôi kho 3, khu tự do ở Bãi Duafat
  const khoBai = DM.khoBai.map((k) => ({ ...k, chieu_cao: 5, suc_chua_tay: k.dien_tich ? null : 3000, loai_kho: null, tieu_thu_ngay: null, ten_khu: null, kieu_bai: null, nhom_bai: null,
    ...(k.ten_bai === "Bãi đuôi kho 3" && k.hang === "Quặng cỡ Kumba" ? { ten_khu: "Khu quặng (Kumba, Khumani…)", kieu_bai: "co_dinh_nhom", nhom_bai: "Quặng" } : {}) }));
  const TP = [
    { ten_bai: "Bãi TP-A", dien_tich: 12000, hang: "Thép cuộn HRC", thiet_bi: "2 cầu trục 32T", suc_chua_tay: 72000 },
    { ten_bai: "Bãi TP-B", dien_tich: 8000, hang: "Thép thanh vằn", thiet_bi: "Xe nâng 10T", suc_chua_tay: 48000 },
    { ten_bai: "Kho TP-C", dien_tich: 6000, hang: "Phôi vuông", thiet_bi: "Cổng trục 20T", suc_chua_tay: 30000 },
  ];
  let kid = Math.max(...khoBai.map((k) => k.id));
  for (const t of TP) khoBai.push({ id: ++kid, chieu_cao: null, loai_kho: "thanh_pham", tieu_thu_ngay: null, ten_khu: null, kieu_bai: null, nhom_bai: null, ghi_chu: "Minh họa", ...t });
  khoBai.push({ id: ++kid, ten_bai: "Bãi Duafat", ten_khu: "Khu tự do", kieu_bai: "tu_do", nhom_bai: null, hang: null, dien_tich: 4000, chieu_cao: 5, suc_chua_tay: null, loai_kho: "nguyen_lieu", tieu_thu_ngay: null, thiet_bi: null, ghi_chu: "Minh họa: nhận mọi hàng" });
  const sc = (k) => k.suc_chua_tay || (k.dien_tich || 0) * (k.chieu_cao || 0) * tiTrong(k.hang);
  const gd = [], lo = [], dauKy = new Map();
  const G = (o) => gd.push({ ca: "CA 1", so_lo: null, nguon: null, voyage_id: null, den_bai: null, chung_tu: null, do_thuc_te: null, so_sach: null, ghi_chu: null, ...o });
  // Tồn đầu kỳ 30 ngày trước: 35–75% sức chứa. Mỗi ngày cấp sản xuất ~1,5–3% tồn đầu kỳ, mỗi tuần nhập bổ sung 20%.
  // Vài loại hàng tiêu thụ nhanh, không nhập bổ sung: còn dưới 7 ngày cấp (để thấy cảnh báo).
  for (const k of khoBai.filter((x) => x.loai_kho !== "thanh_pham" && x.hang)) {
    const cap = sc(k); if (!cap) continue;
    const dk = Math.round(cap * (/Duafat/.test(k.ten_bai) ? 0.7 : /C2 CTH/.test(k.ten_bai) ? 0.3 : 0.35 + rnd() * 0.4)), nhanh = /^(HBI|Quặng cỡ titan|Vảy cán)/.test(k.hang);
    dauKy.set(k.id, dk);
    G({ ngay: ngay(30), loai: "dau_ky", ten_bai: k.ten_bai, hang: k.hang, so_luong: dk, ghi_chu: "Tồn đầu kỳ" });
    for (let i = 29; i >= 0; i--) G({ ngay: ngay(i), ca: i % 2 ? "CA 1" : "CA 2", loai: "xuat", nguon: "cap_sx", ten_bai: k.ten_bai, hang: k.hang, so_luong: Math.round(dk * (nhanh ? 0.03 : 0.015 + rnd() * 0.015)), chung_tu: `PX-${ngay(i).slice(5).replace("-", "")}` });
    if (!nhanh) for (const i of [22, 15, 8]) G({ ngay: ngay(i), ca: "CA 1", loai: "nhap", nguon: "khac", ten_bai: k.ten_bai, hang: k.hang, so_luong: Math.round(dk * 0.2), chung_tu: `PN-${ngay(i).slice(5).replace("-", "")}` });
  }
  // Khu tự do Bãi Duafat: hàng không có dòng riêng trong danh mục
  for (const [i, hang, sl] of [[20, "Quặng Hemantit Lào", 6000], [12, "Quặng Hemantit Lào", 5000], [6, "Than PCI HWW", 4000], [2, "Than PCI HWW", 3500]]) G({ ngay: ngay(i), ca: "CA 1", loai: "nhap", nguon: "khac", ten_bai: "Bãi Duafat", hang, so_luong: sl, chung_tu: `PN-TD-${i}` });
  for (let i = 19; i >= 0; i -= 2) G({ ngay: ngay(i), ca: "CA 2", loai: "xuat", nguon: "cap_sx", ten_bai: "Bãi Duafat", hang: i > 6 ? "Quặng Hemantit Lào" : "Than PCI HWW", so_luong: 450, chung_tu: `PX-TD-${i}` });
  // Nhập từ tàu đang / đã làm hàng về bãi nhận
  const nhapTau = (ten, n, bai, hang, lui) => { const v = voyages.find((x) => x.ma_chuyen === ma(ten, n)); if (!v) return; const ds = Array.isArray(lui) ? lui : [lui]; for (const [i, sl] of ds) G({ ngay: ngay(i), ca: "CA 2", loai: "nhap", nguon: "tau", voyage_id: v.id, ten_bai: bai, hang, so_luong: sl, chung_tu: `Tàu ${ten}` }); };
  nhapTau("PACIFIC GLORY", 1, "Bãi C2 CTH", "Than cốc 10-80mm", [[2, 3000], [1, 4000], [0, 3500]]);
  nhapTau("OCEAN CROWN", 1, "Bãi C2 CTH", "Than cốc 10-80mm", [[13, 6000], [12, 5000]]);
  nhapTau("ORIENT STAR", 2, "Bãi đuôi kho 3", "Quặng cỡ Pilbara-Úc", [[4, 4000], [3, 5000], [2, 5000], [1, 4000], [0, 4000]]);
  nhapTau("GOLDEN BRIDGE", 3, "Bãi CTH", "Phế", [[2, 8000], [1, 9000], [0, 8500]]);
  // Thành phẩm: nhập từ sản xuất theo lô, xuất theo tàu
  const TT = ["san_sang", "san_sang", "san_sang", "cho_kiem", "giu_lai"];
  let nlo = 0;
  for (const t of TP) for (let i = 0; i < 6; i++) {
    const lui = i === 0 ? 72 : Math.floor(rnd() * 25), so = `LO-${t.ten_bai.slice(-1)}${String(++nlo).padStart(3, "0")}`;
    const sl = Math.round(t.suc_chua_tay * (0.05 + rnd() * 0.08));
    G({ ngay: ngay(lui), loai: "nhap", nguon: "san_xuat", ten_bai: t.ten_bai, hang: t.hang, so_luong: sl, so_lo: so, chung_tu: `PN-SX-${nlo}` });
    lo.push({ so_lo: so, hang: t.hang, ngay_nhap: ngay(lui), trang_thai: i === 0 ? "giu_lai" : TT[Math.floor(rnd() * TT.length)], ghi_chu: i === 0 ? "Chờ khách xác nhận" : null });
  }
  const gh = voyages.find((x) => x.ma_chuyen === ma("GREAT HARMONY", 2));
  if (gh) G({ ngay: ngay(18), loai: "xuat", nguon: "tau", voyage_id: gh.id, ten_bai: "Bãi TP-A", hang: "Thép cuộn HRC", so_luong: 2500, so_lo: "LO-A002", chung_tu: "Tàu GREAT HARMONY" });
  // Kiểm kê: một bãi lệch 3%
  const kk = khoBai.find((k) => k.ten_bai === "Bãi KTX");
  if (kk && dauKy.get(kk.id)) {
    const so = Math.round(dauKy.get(kk.id) * 0.8), lech = -Math.round(so * 0.03);
    G({ ngay: ngay(5), loai: "kiem_ke", ten_bai: kk.ten_bai, hang: kk.hang, so_luong: lech, do_thuc_te: so + lech, so_sach: so, ghi_chu: `Kiểm kê định kỳ: đo ${(so + lech).toLocaleString("vi-VN")} t, sổ ${so.toLocaleString("vi-VN")} t` });
  }
  gd.forEach((g, i) => { g.id = i + 1; g.created_at = g.ngay + "T08:00:00.000Z"; });
  return { khoBai, giaoDich: gd, khoLo: lo };
}
