// Tàu của Linetime thành việc cho Kế hoạch & phân bổ › Dài hạn (phần Thiết bị cơ giới), theo một đội xe.
// Nguồn số liệu của chuyến:
//   - Đã có phương án làm hàng ĐÃ DUYỆT: số lượng xe / thiết bị và các mốc thời gian (bắt đầu, tốc độ, giờ dừng, hoàn tất) theo phương án đó;
//   - Chưa duyệt phương án (hoặc chưa có): theo phiếu chuyến › Bãi & Thiết bị (xe vận chuyển để trống số xe thì web tự tính như ở phiếu chuyến);
//     thời gian theo ATB / ETB, cam kết xếp dỡ, ETD.
// Lấy cả xe / thiết bị Hòa Phát lẫn nhà thầu (chỉ cộng số lượng), đúng loại của đội; tàu không dùng đội này thì bỏ qua. Chia hai phần:
//   - viecTauTuLinetime: xe vận chuyển, thiết bị be hầm / hót vét và hỗ trợ chung → công việc Cảng (loại "tau"), tính theo ca có hệ số khởi động;
//   - viecBaiTuLinetime: thiết bị hạ hàng / vun hàng (tàu xuất: lên hàng) ở bãi → công việc bãi (loại "bai"), đúng khoảng thời gian của chuyến tàu.
// Hai loại việc này không vào Ngắn hạn.
import { tinhPhuongAn, thietBiChuyen } from "./phuongAn";
import { plain, ms, DAY } from "./format";
import { klCanLam } from "./linetime";

const khopDoi = (doi) => { const b = plain(doi); return (loai) => { const a = plain(loai); return !!a && (a === b || a.startsWith(b)); }; };
const p2 = (n) => String(n).padStart(2, "0");
const ngayStr = (t) => { const d = new Date(t); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
// Phương án đã duyệt của chuyến (bỏ phương án chưa duyệt / hủy)
const phuongAnDuyet = (plans = []) => (plans || []).find((p) => p.trang_thai === "duyet") || null;

// Chuyến còn trong kế hoạch (bỏ tàu hủy, tàu đã rời quá 1 ngày) kèm phương án đã duyệt (nếu có) và kết quả tính;
// pb: thiết bị theo phiếu chuyến (Bãi & Thiết bị) khi chưa duyệt phương án
function chuyenCuaKeHoach(LD, { cranes, now }) {
  const out = [];
  for (const v of LD?.voyages || []) {
    if (v.huy || (v.atd && ms(v.atd) < now - DAY)) continue;
    const stops = LD.stopsOf?.(v.id) || [];
    const p = phuongAnDuyet(LD.plansOf?.(v.id));
    out.push({ v, p, kq: p ? tinhPhuongAn(v, p, { cranes, stops, now }) : null, pb: p ? null : thietBiChuyen(v, [], { cranes, stops, now }) });
  }
  return out;
}
const nguonCua = (p) => (p ? `PA ${p.ten} (đã duyệt)` : "Bãi & thiết bị");

export function viecTauTuLinetime(LD, doi, { cranes = [], tenBen = (x) => x, now = Date.now() } = {}) {
  if (!LD?.voyages || !doi) return [];
  const khop = khopDoi(doi);
  const out = [];
  for (const { v, p, kq, pb } of chuyenCuaKeHoach(LD, { cranes, now })) {
    let tb, th, gioDung = 0, bd = v.bd_lam_hang;
    if (p) {
      tb = [...kq.xe.map((x) => ({ loai: x.loai, so: x.so, don_vi: x.don_vi })), ...kq.tbKhac];
      th = kq.tocDo > 0 ? kq.tocDo / 24 : null;
      gioDung = kq.dungGio || 0;
      bd = bd || p.bat_dau;
    } else {
      tb = [...pb.xe, ...pb.hotVet]; // xe vận chuyển (số trống thì tự tính), be hầm / hót vét / hỗ trợ chung
      th = +v.cam_ket > 0 ? +v.cam_ket / 24 : null;
    }
    const cua = tb.filter((t) => t && khop(t.loai));
    if (!cua.length) continue;
    const so = cua.reduce((s, t) => s + (+t.so || 0), 0), kl = klCanLam(v);
    out.push({
      id: `lt-${v.id}`, lt: v.id, loai: "tau", doi, ten: v.ten_tau, hang: v.loai_hang || v.ten_hang || "", vi_tri: tenBen(v.ben_ma) || v.ben_ma || "",
      // Còn lại chỉ ghi khi tàu đã làm hàng; chưa làm thì tính từ giờ bắt đầu, không từ mốc hiện tại
      khoi_luong: kl || null, con_lai: kl && v.bd_lam_hang ? Math.max(0, kl - (+v.da_lam || 0)) : null, nang_suat: th, gio_dung: gioDung,
      bat_dau: bd || v.atb || v.etb || null, so_xe_tay: so > 0 ? so : null, nguon: nguonCua(p),
    });
  }
  out.sort((x, y) => (ms(x.bat_dau) ?? 9e15) - (ms(y.bat_dau) ?? 9e15)).forEach((j, i) => { j.thu_tu = (i + 1) * 10; });
  return out;
}

// Việc bãi của tàu: thiết bị hạ hàng / vun hàng (lên hàng) từ lúc bắt đầu làm hàng đến lúc hoàn tất dự kiến của chuyến.
// Số máy mỗi ca như nhau (tàu làm cả ngày lẫn đêm). tu / den (giờ chính xác) để lưới ca chỉ tính các ca giao với khoảng đó.
export function viecBaiTuLinetime(LD, doi, { cranes = [], now = Date.now() } = {}) {
  if (!LD?.voyages || !doi) return [];
  const khop = khopDoi(doi);
  const out = [];
  for (const { v, p, kq, pb } of chuyenCuaKeHoach(LD, { cranes, now })) {
    const diem = p ? kq.diem : [{ bai: pb.bai.map((b) => b.bai).join("; "), tb: pb.vunHang }];
    const tb = diem.flatMap((d) => d.tb || []).filter((t) => t && khop(t.loai));
    const so = tb.reduce((s, t) => s + (+t.so || 0), 0);
    if (!(so > 0)) continue;
    const bd = ms(v.bd_lam_hang) ?? (p ? kq.batDau : ms(v.atb) ?? ms(v.etb));
    // Hết việc: giờ hoàn tất của phương án đã duyệt; chưa duyệt thì theo cam kết xếp dỡ, rồi ETD
    const kl = klCanLam(v);
    const kt = v.kt_lam_hang ? ms(v.kt_lam_hang) : p && kq.ketThuc != null ? kq.ketThuc : bd != null && kl > 0 && +v.cam_ket > 0 ? bd + (kl / +v.cam_ket) * DAY : ms(v.etd);
    if (bd == null) continue;
    const ket = kt != null && kt > bd ? kt : bd + 3600e3; // chưa biết giờ hết: tính tối thiểu một giờ
    out.push({
      id: `lt-bai-${v.id}`, lt: v.id, loai: "bai", doi, ten: `${v.huong === "xuat" ? "Lên hàng" : "Hạ / vun hàng"} · ${v.ten_tau}`, hang: v.loai_hang || v.ten_hang || "",
      vi_tri: [...new Set(diem.map((d) => d.bai).filter(Boolean))].join("; "),
      tu_ngay: ngayStr(bd), den_ngay: ngayStr(ket), tu: new Date(bd).toISOString(), den: new Date(ket).toISOString(),
      xe_ngay: so, xe_dem: so, khoi_luong: kl || null, con_lai: kl && v.bd_lam_hang ? Math.max(0, kl - (+v.da_lam || 0)) : null, nguon: nguonCua(p),
    });
  }
  out.sort((x, y) => x.tu.localeCompare(y.tu)).forEach((j, i) => { j.thu_tu = (i + 1) * 10; });
  return out;
}

// Việc Cảng nhập tay (nút "Thêm việc cảng"): việc loại "tau" có ghi_chu là dấu này. Các việc tàu nhập tay đời cũ (trước khi lấy tàu từ Linetime)
// không có dấu nên vẫn bị bỏ qua, không hiện lại.
export const DAU_VIEC_CANG = "viec_cang_tay";
export const laViecCangTay = (j) => j?.loai === "tau" && j.ghi_chu === DAU_VIEC_CANG;
