// Tồn hiện tại và dự báo đầy theo LOẠI HÀNG của một loại kho (Khai thác kho bãi › Kho hàng kiện, anh Sỹ 21/11/2026).
// Loại hàng = nhóm hàng của Danh mục › Hàng hóa (nomOf), hoặc từng hàng nếu truyền hàm trả chính tên hàng.
//   • tonTheoLoaiHang: tồn hiện tại, sức chứa và % lấp đầy theo loại hàng. Sức chứa của gian / lô cố định hàng tính trọn cho hàng đó; gian / lô chứa nhiều hàng chia theo tỉ lệ tồn;
//     gian / lô đang trống mà đã khai hàng thì tính cho hàng khai báo. Gian / lô chưa có hàng nào thì không thuộc loại hàng nào.
//   • duBaoDay: "nếu không xuất bán thì bao lâu đầy" = (sức chứa − tồn) ÷ nhập mỗi ngày. Nhập mỗi ngày lấy kế hoạch nhập đang có hiệu lực hôm nay (Kế hoạch xuất/nhập kho), không có thì bình quân 30 ngày gần nhất theo sổ.
//     Thêm cột "theo xu hướng" = (sức chứa − tồn) ÷ (nhập − xuất bình quân 30 ngày) để đối chiếu khi vẫn xuất bán như hiện nay.
import { khuCuaKeHoach, ngayStr } from "./kho";
import { plain } from "./format";
import { ngayCuaKeHoach } from "./keHoachKy";

const DAY = 864e5, r2 = (x) => Math.round((+x || 0) * 100) / 100;
const KHONG_NHOM = "(chưa có nhóm)";
const nhanCua = (nhomOf, hang) => { const ten = String(nhomOf(hang) || "").trim() || KHONG_NHOM; return { k: plain(ten), ten }; };

export function tonTheoLoaiHang({ kho, loai, nhomOf }) {
  const m = new Map();
  const lay = (h) => { const { k, ten } = nhanCua(nhomOf, h); if (!m.has(k)) m.set(k, { k, ten, ton: 0, sucChua: 0 }); return m.get(k); };
  for (const c of kho.cap) if (c.loai === loai && Math.abs(c.ton) > 1e-6) lay(c.hang).ton += c.ton;
  for (const d of kho.dong) {
    if (d.loai !== loai || d.saiBai || !(d.sucChua > 0)) continue;
    const chua = (d.chua || []).filter((c) => c.ton > 1e-6);
    if (d.kieu === "co_dinh_hang" && d.hang) { lay(d.hang).sucChua += d.sucChua; continue; }
    if (chua.length) { const w = chua.reduce((s, c) => s + c.ton, 0); for (const c of chua) lay(c.hang).sucChua += (d.sucChua * c.ton) / w; }
    else if (d.hang) lay(d.hang).sucChua += d.sucChua;
  }
  return [...m.values()].filter((x) => x.ton > 1e-6 || x.sucChua > 0).map((x) => ({ ...x, ton: r2(x.ton), sucChua: r2(x.sucChua), lapDay: x.sucChua > 0 ? x.ton / x.sucChua : null })).sort((a, b) => b.ton - a.ton);
}

// Trạng thái: da_day | gap (đầy trong ≤ 7 ngày) | chu_y (≤ 30 ngày) | on | khong_nhap (không có nhập, không đầy) | thieu_suc_chua
export function duBaoDay({ kho, loai, nhomOf, giaoDich = [], keHoach = [], now = Date.now(), soNgayBQ = 30 }) {
  const homNay = ngayStr(now), tu = ngayStr(now - soNgayBQ * DAY);
  const loaiKey = new Map(kho.dong.map((d) => [d.key, d.loai])), loaiOf = (b, h, khu) => loaiKey.get(kho.gan(b, h, khu));
  const nhap = new Map(), xuat = new Map();
  for (const g of giaoDich) {
    const n = String(g.ngay).slice(0, 10);
    if (n <= tu || n > homNay || (g.loai !== "nhap" && g.loai !== "xuat") || loaiOf(g.ten_bai, g.hang, g.ten_khu) !== loai) continue;
    const m = g.loai === "nhap" ? nhap : xuat, k = nhanCua(nhomOf, g.hang).k;
    m.set(k, (m.get(k) || 0) + (+g.so_luong || 0) / soNgayBQ);
  }
  const dongOk = kho.dong.filter((d) => !d.saiBai), khNhap = new Map();
  for (const r of keHoach) {
    if (r.huong === "xuat") continue;
    const d = khuCuaKeHoach(r, dongOk); if (!d || d.loai !== loai) continue;
    const hang = r.hang || d.hang; if (!hang) continue;
    const nd = ngayCuaKeHoach(r); if (!nd.includes(homNay)) continue; // chỉ kế hoạch đang có hiệu lực hôm nay
    const k = nhanCua(nhomOf, hang).k;
    khNhap.set(k, (khNhap.get(k) || 0) + (+r.khoi_luong || 0) / (nd.length || 1));
  }
  return tonTheoLoaiHang({ kho, loai, nhomOf }).map((x) => {
    const bq = nhap.get(x.k) || 0, kh = khNhap.get(x.k) || 0, nhapNgay = kh > 0 ? kh : bq, xuatNgay = xuat.get(x.k) || 0;
    const conTrong = x.sucChua > 0 ? Math.max(0, x.sucChua - x.ton) : null;
    const soNgay = (rong) => (conTrong == null ? null : conTrong <= 1e-6 ? 0 : rong > 1e-9 ? conTrong / rong : null);
    const ngayDay = soNgay(nhapNgay), ngayXH = soNgay(nhapNgay - xuatNgay);
    const ngayDuKien = (s) => (s == null ? null : ngayStr(now + Math.ceil(s) * DAY));
    const trangThai = conTrong == null ? "thieu_suc_chua" : conTrong <= 1e-6 ? "da_day" : ngayDay == null ? "khong_nhap" : ngayDay <= 7 ? "gap" : ngayDay <= 30 ? "chu_y" : "on";
    return { ...x, conTrong, nhapNgay: r2(nhapNgay), nguonNhap: kh > 0 ? "ke_hoach" : "binh_quan", xuatNgay: r2(xuatNgay), ngayDay, ngayDuKien: ngayDuKien(ngayDay), ngayDayXuHuong: ngayXH, ngayDuKienXuHuong: ngayDuKien(ngayXH), trangThai };
  });
}
