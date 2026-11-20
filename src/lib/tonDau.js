// Tồn đầu kỳ dạng ĐẶT LẠI (anh Sỹ chốt 17/11/2026): khai báo tồn đầu kỳ của một (gian / lô, hàng) ở một ngày = số tồn ở đầu ngày đó,
// lần khai báo gần nhất thay cho các lần trước (không cộng dồn). Sổ (kho_giao_dich) vẫn là cộng trừ, nên ghi lượt "Tồn đầu kỳ" với so_luong = X − tồn sổ ngay trước ngày đó
// (có thể âm), do_thuc_te = X, so_sach = tồn sổ trước. Các lượt nhập / xuất từ ngày đó trở đi vẫn cộng lên trên. Khai báo lại cùng ngày thì ghi thêm lượt bù chênh lệch (không xóa lượt cũ).
import { plain } from "./format";

const ngayDen = (x) => String(x || "").slice(0, 10);
// Thay đổi tồn của (key, hang) do một lượt sổ
export function deltaLuot(g, key, hang, gan) {
  const sl = +g.so_luong || 0, p = plain(hang);
  if (plain(g.hang) !== p) return 0;
  let d = 0;
  if (gan(g.ten_bai, g.hang, g.ten_khu) === key) d += g.loai === "xuat" || g.loai === "dieu_chuyen" ? -sl : sl;
  if (g.loai === "dieu_chuyen" && g.den_bai && gan(g.den_bai, g.hang, g.den_khu) === key) d += sl;
  return d;
}
// kho: { gan, cap } (kết quả tongHopKho); giaoDich: các lượt sổ đã tải; tonDau: số tồn đầu ngày muốn đặt.
// Không xóa lượt cũ (người nhập liệu không có quyền xóa): khai báo lại cùng ngày thì ghi thêm lượt bù chênh lệch với tồn đầu ngày hiện có.
// Trả { base: tồn sổ ngay trước ngày đó (không tính lượt từ ngày đó trở đi), hienCo: tồn đầu ngày hiện có (base + các lượt Tồn đầu kỳ cùng ngày), delta }
export function tinhTonDau({ kho, giaoDich, key, hang, ngay, tonDau }) {
  const tonNay = kho.cap.find((c) => c.key === key && plain(c.hang) === plain(hang))?.ton || 0;
  let tuNgay = 0, daCo = 0;
  for (const g of giaoDich) {
    if (ngayDen(g.ngay) < ngay) continue;
    const d = deltaLuot(g, key, hang, kho.gan);
    if (!d) continue;
    tuNgay += d;
    if (g.loai === "dau_ky" && ngayDen(g.ngay) === ngay) daCo += d;
  }
  const base = tonNay - tuNgay, hienCo = base + daCo;
  return { base, hienCo, delta: tonDau - hienCo };
}
// Lượt sổ ghi cho một lần khai báo tồn đầu kỳ (null nếu không cần ghi: số đã khớp). ghiCa = true: số đã khớp vẫn ghi một lượt chênh lệch 0 để web nhận (VD khai tồn đầu 0 khi tồn đang là 0)
export const luotTonDau = ({ ngay, ca, kr, hang, tonDau, hienCo, delta, ghi_chu = null, ghiCa = false }) => (!ghiCa && Math.abs(delta) < 1e-9 ? null
  : { ngay, ca: ca || null, loai: "dau_ky", ten_bai: kr.ten_bai, ten_khu: kr.ten, hang, so_luong: Math.round(delta * 1e6) / 1e6, do_thuc_te: tonDau, so_sach: Math.round(hienCo * 1e6) / 1e6, nguon: null, so_lo: null, chung_tu: null, ghi_chu });
// Lượt Tồn đầu kỳ kiểu mới (đặt lại) có do_thuc_te
export const laTonDauDatLai = (g) => g.loai === "dau_ky" && g.do_thuc_te != null;
