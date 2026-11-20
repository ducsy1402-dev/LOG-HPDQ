// Dán nhanh / Excel mục tiêu VẬN TẢI theo form bảng của anh Sỹ (16/11/2026):
//   Loại hàng · Hướng (PVC / PVSX) · Loại xe · ĐVT · Tổng · Hòa Phát · Thuê ngoài · Ghi chú  (không có cột Stt; ĐVT chỉ để đủ form, luôn là tấn)
// Dòng đầu là tiêu đề cột; cột nhận theo tên (không dấu, không phân biệt hoa thường), thứ tự tùy ý. Ô trống hoặc "-" = không có số.
// Hòa Phát + Thuê ngoài là số web ghi; Tổng chỉ để đối chiếu (lệch thì cảnh báo, vẫn lấy Hòa Phát + Thuê ngoài).
import { plain, docSo } from "./format";
import { NGHIEP_VU, docNghiepVu } from "./sanLuongTT";

export const COT_DAN_VT = [["hang", "Loại hàng"], ["huong", "Hướng"], ["nv", "Nghiệp vụ"], ["loai", "Loại xe"], ["dvt", "ĐVT"], ["tong", "Tổng"], ["hp", "Hòa Phát"], ["tn", "Thuê ngoài"], ["ghi_chu", "Ghi chú"]];
export const MAU_DAN_VT = COT_DAN_VT.map(([, t]) => t).join("\t");
const TEN_COT = {
  hang: ["loai hang", "hang", "nhom hang", "hang hoa", "ten hang"],
  huong: ["huong", "huong phuc vu", "phuc vu", "muc dich"],
  nv: ["nghiep vu", "nv"],
  loai: ["loai xe", "doi xe", "xe", "loai phuong tien", "phuong tien"],
  dvt: ["dvt", "don vi tinh"],
  tong: ["tong", "tong cong", "tong muc tieu", "muc tieu"],
  hp: ["hoa phat", "hp"],
  tn: ["thue ngoai", "nha thau", "tn"],
  ghi_chu: ["ghi chu", "note"],
};
const chuanCot = (c) => plain(c).replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
export const docHuongVT = (x) => { const p = plain(x); return /\bpvsx\b|san xuat|\bsx\b/.test(p) ? "phuc_vu_san_xuat" : /\bpvc\b|cang/.test(p) ? "phuc_vu_cang" : null; };
// Số tấn: số thật, hoặc chữ ("60.000", "1,5"); ô trống / "-" => null (không có số); không đọc được => NaN
export function docTan(x) {
  if (typeof x === "number") return Number.isFinite(x) ? x : NaN;
  const t = String(x ?? "").trim();
  if (!t || /^[-–—]+$/.test(t)) return null;
  const v = docSo(t);
  return v == null || !Number.isFinite(v) ? NaN : v;
}
// bang: mảng dòng (dòng đầu là tiêu đề) -> { loiCot } | { ds: [{ hang, huong, loai, hp, tn, tong, ghi_chu, loi: [], canh: [] }] }
export function docBangMucTieuVT(bang) {
  const dung = new Set(), cot = bang[0].map((c) => { const p = chuanCot(c), k = p ? Object.entries(TEN_COT).find(([, bi]) => bi.includes(p))?.[0] || "" : ""; return k && !dung.has(k) ? (dung.add(k), k) : ""; });
  const thieu = ["huong", "loai"].filter((k) => !cot.includes(k)).map((k) => (k === "huong" ? "Hướng" : "Loại xe"));
  if (!cot.includes("hp") && !cot.includes("tn") && !cot.includes("tong")) thieu.push("Hòa Phát / Thuê ngoài");
  if (thieu.length) return { loiCot: `Dòng đầu phải là tiêu đề cột. Chưa thấy cột: ${thieu.join(", ")}. Cần: ${COT_DAN_VT.map(([, t]) => t).join(" · ")} (không cần Stt).` };
  const ds = bang.slice(1).filter((r) => r.some((x) => x !== "" && x != null)).map((o) => {
    const r = {}; cot.forEach((k, i) => { if (k) r[k] = o[i]; });
    const loi = [], canh = [], huong = docHuongVT(r.huong), loai = String(r.loai ?? "").trim();
    if (!huong) loi.push(`Hướng "${r.huong ?? ""}" phải là PVC (phục vụ cảng) hoặc PVSX (phục vụ sản xuất)`);
    if (!loai) loi.push("Thiếu loại xe");
    const nv = docNghiepVu(r.nv);
    if (nv === null) loi.push(`Nghiệp vụ "${r.nv}" phải là: ${NGHIEP_VU.join(", ")} (hoặc để trống)`);
    const hp = docTan(r.hp), tn = docTan(r.tn), tong = docTan(r.tong);
    if (Number.isNaN(hp)) loi.push(`Hòa Phát "${r.hp}" không phải số`);
    if (Number.isNaN(tn)) loi.push(`Thuê ngoài "${r.tn}" không phải số`);
    if (Number.isNaN(tong)) loi.push(`Tổng "${r.tong}" không phải số`);
    if (!loi.length) {
      if (hp == null && tn == null && !(tong > 0)) loi.push("Chưa có số Hòa Phát / Thuê ngoài");
      else if (hp == null && tn == null) loi.push(`Có Tổng ${tong} nhưng chưa chia Hòa Phát / Thuê ngoài`);
      else if (tong != null && Math.abs((hp || 0) + (tn || 0) - tong) > 0.5) canh.push(`Tổng ${tong} khác Hòa Phát + Thuê ngoài (${(hp || 0) + (tn || 0)}): lấy theo Hòa Phát + Thuê ngoài`);
    }
    return { hang: String(r.hang ?? "").trim(), huong, nv: nv || "", loai, hp: Number.isNaN(hp) ? null : hp, tn: Number.isNaN(tn) ? null : tn, tong: Number.isNaN(tong) ? null : tong, ghi_chu: String(r.ghi_chu ?? "").trim(), loi, canh };
  });
  return { ds };
}
// Dòng dán hợp lệ -> các dòng mục tiêu theo đơn vị (đưa vào bảng): mỗi ô có số là một dòng
// Các dòng trùng (cùng loại hàng, hướng, loại xe, đơn vị — không phân biệt hoa thường / dấu) được CỘNG lại: trước đây dòng sau ghi đè dòng trước nên tổng bị hụt
export function gopDongDonVi(items) {
  const m = new Map();
  let trung = 0;
  for (const x of items) {
    const k = `${x.huong}|${plain(x.loai)}|${x.donVi}|${plain(x.hang)}|${plain(x.nv || "")}`, o = m.get(k);
    if (o) { o.tan += x.tan; if (!o.ghi_chu && x.ghi_chu) o.ghi_chu = x.ghi_chu; trung++; } else m.set(k, { ...x });
  }
  return { ds: [...m.values()], trung };
}
export const thanhDongDonVi = (ds) => ds.flatMap((x) => [["hoa_phat", x.hp], ["nha_thau", x.tn]].filter(([, v]) => v != null).map(([donVi, tan]) => ({ huong: x.huong, loai: x.loai, donVi, hang: x.hang, nv: x.nv || "", tan, ghi_chu: x.ghi_chu })));
