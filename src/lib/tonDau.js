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
// Tính cho một lần khai báo tồn đầu kỳ, TỪ TOÀN BỘ SỔ của gian / lô (lấy mới từ CSDL lúc lưu: api.loadGiaoDichBai), không dựa vào số đã tải (cửa sổ 35 ngày, tải nền chưa xong).
// gan: kho.gan (ten_bai, hang, ten_khu → khóa gian / lô). Trả:
//   base   = tồn sổ ngay trước ngày đó (mọi lượt có ngày nhỏ hơn)
//   hienCo = tồn đầu ngày hiện có (base + các lượt Tồn đầu kỳ cùng ngày)
//   delta  = lượng cần ghi để tồn đầu ngày = tonDau
//   moiNhat = lần khai báo tồn đầu (kiểu đặt lại) có NGÀY MỚI NHẤT của gian / lô + hàng này: { ngay, so } (cùng ngày thì lượt ghi sau cùng), null nếu chưa có
//   cu     = true nếu ngày đang khai NHỎ HƠN ngày của moiNhat: chỉ tồn đầu ngày mới nhất có hiệu lực, khai ngày cũ hơn sẽ làm lệch tồn hiện tại nên không cho ghi
//   trung  = true nếu CÙNG ngày với moiNhat: khai lại, số mới thay số cũ (cảnh báo)
export function tinhTonDau({ kho, gan: ganNgoai, giaoDich, key, hang, ngay, tonDau }) {
  const gan = ganNgoai || kho.gan, p = plain(hang);
  let base = 0, daCo = 0, moiNhat = null, idMoi = -Infinity;
  for (const g of giaoDich) {
    if (plain(g.hang) !== p) continue;
    const n = ngayDen(g.ngay), d = deltaLuot(g, key, hang, gan);
    if (n < ngay) base += d;
    else if (n === ngay && g.loai === "dau_ky") daCo += d;
    // lần khai báo kiểu đặt lại của đúng gian / lô này
    if (g.loai === "dau_ky" && g.do_thuc_te != null && gan(g.ten_bai, g.hang, g.ten_khu) === key) {
      const id = +g.id || 0;
      if (!moiNhat || n > moiNhat.ngay || (n === moiNhat.ngay && id >= idMoi)) { moiNhat = { ngay: n, so: +g.do_thuc_te || 0 }; idMoi = id; }
    }
  }
  const hienCo = base + daCo;
  return { base, hienCo, delta: tonDau - hienCo, moiNhat, cu: !!moiNhat && ngay < moiNhat.ngay, trung: !!moiNhat && ngay === moiNhat.ngay };
}
// Trong MỘT lần nhập nhiều dòng tồn đầu: mỗi (gian / lô, hàng) chỉ lấy dòng có ngày MỚI NHẤT (cùng ngày thì dòng cuối), các dòng còn lại bỏ và báo.
// ds: [{ khoa, ngay, ... }] → { giu: [...], bo: [{ y, lyDo: "cu" | "trung" }] } (giữ nguyên thứ tự)
export function chonTonDauMoiNhat(ds) {
  const tot = new Map();
  ds.forEach((y, i) => { const o = tot.get(y.khoa); if (!o || y.ngay > o.y.ngay || (y.ngay === o.y.ngay)) tot.set(y.khoa, { y, i }); });
  const giu = [], bo = [];
  ds.forEach((y, i) => { const t = tot.get(y.khoa); if (t.i === i) giu.push(y); else bo.push({ y, lyDo: y.ngay === t.y.ngay ? "trung" : "cu", thay: t.y }); });
  return { giu, bo };
}
export const ngayVN = (n) => `${String(n).slice(8, 10)}/${String(n).slice(5, 7)}/${String(n).slice(0, 4)}`;
// Lượt sổ ghi cho một lần khai báo tồn đầu kỳ (null nếu không cần ghi: số đã khớp). ghiCa = true: số đã khớp vẫn ghi một lượt chênh lệch 0 để web nhận (VD khai tồn đầu 0 khi tồn đang là 0)
export const luotTonDau = ({ ngay, ca, kr, hang, tonDau, hienCo, delta, ghi_chu = null, ghiCa = false }) => (!ghiCa && Math.abs(delta) < 1e-9 ? null
  : { ngay, ca: ca || null, loai: "dau_ky", ten_bai: kr.ten_bai, ten_khu: kr.ten, hang, so_luong: Math.round(delta * 1e6) / 1e6, do_thuc_te: tonDau, so_sach: Math.round(hienCo * 1e6) / 1e6, nguon: null, so_lo: null, chung_tu: null, ghi_chu });
// Lượt Tồn đầu kỳ kiểu mới (đặt lại) có do_thuc_te
export const laTonDauDatLai = (g) => g.loai === "dau_ky" && g.do_thuc_te != null;
