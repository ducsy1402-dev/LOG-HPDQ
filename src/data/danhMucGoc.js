// Danh mục 16 cầu bến và cẩu theo tài liệu kế hoạch (cập nhật 09/10/2026). Trùng nội dung với sql/14_nap_danh_muc_ben.sql,
// dùng cho chế độ demo. Dữ liệu thật đọc từ bảng berths / berth_cranes trên Supabase.
const B = (ma, ten_khac, dwt_max, mon_max, mon_cung, loa_max, loai_hang, thu_tu) => ({ ma, ten_khac, dwt_max, mon_max, mon_cung, loa_max, loai_hang, thu_tu, ghi_chu: null });
export const BERTHS = [
  B("1A", ["TL", "BTL", "B1A", "Tàu Lai"], 8000, 7.2, false, 140, "Thép thành phẩm, HRC, phôi vuông", 1),
  B("1", ["B01", "B1"], 8000, 7.2, false, 140, "Thép thành phẩm, HRC, phôi vuông", 2),
  B("2", ["B02", "B2"], 8000, 7.2, false, 140, "Xỉ, thép thành phẩm, HRC", 3),
  B("3", ["B03", "B3"], 40000, 12, false, 200, "HRC, xỉ, quặng hồi, thạch cao", 4),
  B("4", ["B04", "B4"], 30000, 8.9, false, 200, "Xỉ hạt, phế liệu nội địa", 5),
  B("5", ["B05", "B5"], 150000, 14.7, false, 300, "Than, quặng, HRC, thép cuộn", 6),
  B("6", ["B06", "B6"], 110000, 14.9, false, 300, "Than, quặng, HRC, thép cuộn", 7),
  B("7", ["B07", "B7"], 20000, 9, false, 180, "Đá, xỉ, quặng hồi, HRC", 8),
  B("8", ["B08", "B8"], 10000, 7.2, false, 126.5, "Đá, xỉ, quặng hồi", 9),
  B("9", ["B09", "B9"], 10000, 7.2, false, 126.5, "Đá, xỉ, quặng hồi", 10),
  B("10", ["B10"], 250000, 18.5, true, 410, "Than, quặng, HRC xuất khẩu", 11),
  B("11", ["B11"], 250000, 18.5, true, 410, "Than, quặng, HRC xuất khẩu", 12),
  B("HH2", ["BHH2"], 50000, 11.7, true, 242, "HRC, phôi, đá, xỉ, thiết bị", 13),
  B("HH3", ["BHH3"], 30000, 10.8, true, 190, "HRC, phôi, đá, xỉ, thiết bị", 14),
  B("6CTH", ["B6CTH"], 70000, 12.2, false, 250, "Phế, HRC, thép cuộn, phôi, slab, xỉ", 15),
  B("7CTH", ["B7CTH"], 70000, 12.2, false, 250, "Phế, HRC, thép cuộn, phôi, slab, xỉ", 16),
];

const C = (ma, ben_ma, loai, tai_nang = null, ghi_chu = null) => ({ ma, ben_ma, loai, tai_nang, tam_voi: null, nang_suat_th: null, pham_vi_tu: null, pham_vi_den: null, bang_tai: null, ghi_chu });
export const CRANES = [
  C("OHC 40T", ["1A", "1", "2"], "OHC", "40T", "Tài liệu ghi ở bến 1A, 1, 2"),
  C("OHC 30T", ["1A", "1", "2"], "OHC", "30T", "Tài liệu ghi ở bến 1A, 1, 2"),
  C("SLD bến 2", ["2"], "SLD", null, "Ship loader: băng tải xả thẳng xuống tàu hoặc mặt bến"),
  C("QC03", ["3"], "QC"), C("QC04", ["3"], "QC"), C("QC05", ["3"], "QC"),
  C("SLD bến 4", ["4"], "SLD", null, "Ship loader"), C("SC01", ["4"], "SC"),
  C("SC02", ["5"], "SC"), C("QC10", ["5"], "QC"), C("QC11", ["5"], "QC"),
  C("SC05", ["6"], "SC"), C("SC06", ["6"], "SC"), C("SC07", ["6"], "SC"), C("SLD bến 6", ["6"], "SLD", null, "Ship loader"),
  C("SC11", ["7"], "SC"), C("SC12", ["7"], "SC"), C("SLD bến 7", ["7"], "SLD", null, "Ship loader"),
  C("SC12A", ["8"], "SC", null, "Cần kiểm tra: file ghi 16T/30m nhưng năng suất thiết kế 32T"), C("SC08", ["8"], "SC"),
  C("SC09", ["9"], "SC"), C("SC10", ["9"], "SC"),
  C("QC06", ["10"], "QC"), C("QC07", ["10"], "QC"), C("QC08", ["10"], "QC"),
  C("QC01", ["11"], "QC"), C("QC02", ["11"], "QC"), C("QC09", ["11"], "QC"), C("QC12", ["11"], "QC"),
  C("SC HH02", ["HH2"], "SC"), C("SC HH03", ["HH2"], "SC"),
  C("Cẩu xích 350T", ["HH3"], "Cẩu xích", "350T"), C("Cẩu xích 260T #1", ["HH3"], "Cẩu xích", "260T"), C("Cẩu xích 260T #2", ["HH3"], "Cẩu xích", "260T"),
  C("SHC01", ["6CTH"], "SHC"), C("SHC02", ["6CTH"], "SHC"),
  C("SC03", ["7CTH"], "SC"), C("SC04", ["7CTH"], "SC"),
].map((c, i) => ({ ...c, id: i + 1, thu_tu: i + 1 }));

// Lý do dừng / đình trệ. Mặc định: thời tiết, hoa tiêu, lai dắt là thời gian đình trệ cho phép (trừ khỏi laytime);
// trống máng, chờ hàng, chờ xe tính là trống máng (tàu CQD). Người nhập vẫn sửa được từng khoảng.
export const LY_DO_DUNG = ["Thời tiết xấu", "Mưa", "Hoa tiêu lên tàu", "Lai dắt / di chuyển cầu", "Trống máng", "Chờ hàng", "Chờ xe", "Hỏng thiết bị", "Nghỉ ca", "Thủ tục / giám định", "Khác"];
export const TRU_MAC_DINH = new Set(["Thời tiết xấu", "Mưa", "Hoa tiêu lên tàu", "Lai dắt / di chuyển cầu"]);
export const TRONG_MANG_MAC_DINH = new Set(["Trống máng", "Chờ hàng", "Chờ xe"]);
