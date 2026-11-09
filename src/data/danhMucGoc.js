// Cầu bến gốc: mã (theo file Danh_muc_tong_hop.xlsx: TL, B01…B11, HH2, HH3, 6CTH, 7CTH), tên khác (mã cũ 1A, 1…11 để dán / nhập kiểu cũ vẫn nhận),
// mớn cứng (mớn ghi ≤: giới hạn cứng khi kiểm tra tàu – bến). Số liệu thật nạp từ file (scripts/danh-muc.mjs); đây là bản gốc cho script và demo.
const B = (ma, ten_khac, dwt_max, mon_max, mon_cung, loa_max, loai_hang, thu_tu) => ({ ma, ten_khac, dwt_max, mon_max, mon_cung, loa_max, loai_hang, thu_tu, ghi_chu: null });
export const BERTHS = [
  B("TL", ["1A", "BTL", "B1A", "Tàu Lai"], 8000, 7.2, false, 140, "Thép thành phẩm, HRC, phôi vuông", 1),
  B("B01", ["1", "B1"], 8000, 7.2, false, 140, "Thép thành phẩm, HRC, phôi vuông", 2),
  B("B02", ["2", "B2"], 8000, 7.2, false, 140, "Xỉ, thép thành phẩm, HRC", 3),
  B("B03", ["3", "B3"], 40000, 12, false, 200, "HRC, xỉ, quặng hồi, thạch cao", 4),
  B("B04", ["4", "B4"], 30000, 8.9, false, 200, "Xỉ hạt, phế liệu nội địa", 5),
  B("B05", ["5", "B5"], 150000, 14.7, false, 300, "Than, quặng, HRC, thép cuộn", 6),
  B("B06", ["6", "B6"], 110000, 14.9, false, 300, "Than, quặng, HRC, thép cuộn", 7),
  B("B07", ["7", "B7"], 20000, 9, false, 180, "Đá, xỉ, quặng hồi, HRC", 8),
  B("B08", ["8", "B8"], 10000, 7.2, false, 126.5, "Đá, xỉ, quặng hồi", 9),
  B("B09", ["9", "B9"], 10000, 7.2, false, 126.5, "Đá, xỉ, quặng hồi", 10),
  B("B10", ["10"], 250000, 18.5, true, 410, "Than, quặng, HRC xuất khẩu", 11),
  B("B11", ["11"], 250000, 18.5, true, 410, "Than, quặng, HRC xuất khẩu", 12),
  B("HH2", ["BHH2"], 50000, 11.7, true, 242, "HRC, phôi, đá, xỉ, thiết bị", 13),
  B("HH3", ["BHH3"], 30000, 10.8, true, 190, "HRC, phôi, đá, xỉ, thiết bị", 14),
  B("6CTH", ["B6CTH"], 70000, 12.2, false, 250, "Phế, HRC, thép cuộn, phôi, slab, xỉ", 15),
  B("7CTH", ["B7CTH"], 70000, 12.2, false, 250, "Phế, HRC, thép cuộn, phôi, slab, xỉ", 16),
];
// Mã bến cũ -> mã mới (SQL 08 đổi mã các bến, chuyến tàu đã có)
export const MA_BEN_CU = { "1A": "TL", 1: "B01", 2: "B02", 3: "B03", 4: "B04", 5: "B05", 6: "B06", 7: "B07", 8: "B08", 9: "B09", 10: "B10", 11: "B11" };

// Bố trí tuyến bến mặc định: [tuyến, từ mét, đến mét, đầu góc vuông ("dau" = phía mét nhỏ, "cuoi" = phía mét lớn)]
//   TL, B01, B02: ba bến song song, mỗi bến một tuyến 0–140 m. Mặt tây cầu cảng: B03 (0–200), B05 (200–500), B10 (500–910).
//   Mặt đông: B04 (0–200, đầu mét 0 góc vuông với tuyến bến B07), B06 (200–500), B11 (500–910).
//   Tuyến B07-B08-B09: B07 (0–180, đầu tây góc vuông với mặt đông), B08 (180–306,5), B09 (306,5–433). Hào Hưng: HH2 (0–242), HH3 (242–432).
//   Cảng Tổng hợp: 7CTH (0–250), 6CTH (250–490).
export const VI_TRI_MAC_DINH = {
  TL: ["TL", 0, 140], B01: ["B01", 0, 140], B02: ["B02", 0, 140],
  B03: ["B03-B05-B10", 0, 200], B05: ["B03-B05-B10", 200, 500], B10: ["B03-B05-B10", 500, 910],
  B04: ["B04-B06-B11", 0, 200, "dau"], B06: ["B04-B06-B11", 200, 500], B11: ["B04-B06-B11", 500, 910],
  B07: ["B07-B08-B09", 0, 180, "dau"], B08: ["B07-B08-B09", 180, 306.5], B09: ["B07-B08-B09", 306.5, 433],
  HH2: ["HH2-HH3", 0, 242], HH3: ["HH2-HH3", 242, 432], "7CTH": ["6CTH-7CTH", 0, 250], "6CTH": ["6CTH-7CTH", 250, 490],
};

// Lý do dừng / đình trệ. Mặc định: thời tiết, hoa tiêu, lai dắt là thời gian đình trệ cho phép (trừ khỏi laytime);
// trống máng, chờ hàng, chờ xe tính là trống máng (tàu CQD). Người nhập vẫn sửa được từng khoảng.
// Tàu CHƯA cập bến vì chưa đủ hàng (tàu xuất) hoặc chưa có bãi nhập (tàu nhập): ghi ở tab Khoảng dừng, lịch cầu bến vẽ màu xanh lá trong đoạn chờ bến
export const LY_DO_CHO_CAP = ["Chờ cập bến: chưa đủ hàng", "Chờ cập bến: chưa có bãi nhập"];
export const LY_DO_DUNG = ["Thời tiết xấu", "Mưa", "Hoa tiêu lên tàu", "Lai dắt / di chuyển cầu", "Trống máng", "Chờ hàng", "Chờ xe", "Hỏng thiết bị", "Nghỉ ca", "Thủ tục / giám định", "Khác", ...LY_DO_CHO_CAP];
export const TRU_MAC_DINH = new Set(["Thời tiết xấu", "Mưa", "Hoa tiêu lên tàu", "Lai dắt / di chuyển cầu"]);
export const TRONG_MANG_MAC_DINH = new Set(["Trống máng", "Chờ hàng", "Chờ xe"]);
