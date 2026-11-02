// Đọc file import (Excel/CSV) và xuất Excel. Thư viện SheetJS được tải khi cần.
import { plain, diffDays, vn } from "./utils";
import { ACTIVE } from "./compute";

// Tiền tố mã xe -> đội (dùng khi file không có cột doi và CSDL chưa cập nhật danh mục mới)
const DEFAULT_TIEN_TO = {
  "XĐ": "Xúc đào", "XL": "Xúc lật", "XN": "Xe nâng", "ĐK": "Xe đầu kéo", "XT": "Xe ben", "XB": "Xe bồn", "XBN": "Xe bồn",
  "XC": "Xe cẩu thùng", "XGL": "Xe gang lỏng", "XNN": "PT chuyên dụng khác", "XR": "PT chuyên dụng khác", "XU": "PT chuyên dụng khác", "XLU": "PT chuyên dụng khác",
};
const taiTrongTuModel = (s) => { const m = String(s || "").match(/(?<![0-9])(28|15|10|5|3)\s*(?:T|tấn)(?![a-zA-Z])/i); return m ? m[1] + "T" : null; };

const loadXLSX = () => import("xlsx");

// ---------- Định nghĩa cột import ----------
// Mỗi cột: khóa trong CSDL, các tên tiêu đề chấp nhận (không dấu, không phân biệt hoa thường)
export const VEHICLE_COLS = [
  { key: "ma", label: "Mã xe", alias: ["ma", "ma xe", "ma_xe", "bien so", "so hieu"], required: true },
  { key: "doi", label: "Đội xe", alias: ["doi", "doi xe", "dong xe", "loai xe"] },
  { key: "model", label: "Model", alias: ["model", "mau xe", "kieu xe"] },
  { key: "to_xe", label: "Tổ", alias: ["to", "to xe", "to_xe", "khu vuc"] },
  { key: "che_do", label: "Chế độ", alias: ["che do", "che_do", "ca", "che do lam viec"] },
  { key: "tai_trong", label: "Tải trọng", alias: ["tai trong", "tai_trong", "suc nang"] },
  { key: "thiet_bi_gan", label: "Thiết bị gắn", alias: ["thiet bi gan", "thiet_bi_gan", "tb gan", "thiet bi"] },
  { key: "ghi_chu", label: "Ghi chú", alias: ["ghi chu", "ghi_chu"] },
];
export const STAFF_COLS = [
  { key: "ma", label: "Mã NV", alias: ["ma", "ma nv", "ma_nv", "ma nhan vien", "msnv"], required: true },
  { key: "ho_ten", label: "Họ tên", alias: ["ho ten", "ho_ten", "ho va ten", "ten"], required: true },
  { key: "doi", label: "Đội xe", alias: ["doi", "doi xe"] },
  { key: "to_xe", label: "Tổ", alias: ["to", "to xe", "to_xe"] },
  { key: "kip", label: "Kíp", alias: ["kip"] },
  { key: "nhom", label: "Nhóm", alias: ["nhom", "chuc danh", "cong viec"] },
  { key: "trang_thai", label: "Trạng thái", alias: ["trang thai", "trang_thai", "tinh trang"] },
];

const normHead = (h) => plain(h).replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").replace(/\(.*\)/, "").trim();

export async function readTable(file) {
  const XLSX = await loadXLSX();
  const isCsv = /\.(csv|txt)$/i.test(file.name);
  const wb = isCsv ? XLSX.read(await file.text(), { type: "string", raw: true }) : XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  // Dòng tiêu đề: dòng đầu tiên có ít nhất 2 ô không rỗng
  const hi = rows.findIndex((r) => r.filter((c) => String(c).trim()).length >= 2);
  if (hi < 0) throw new Error("File không có dữ liệu");
  const body = [];
  rows.forEach((r, i) => { if (i > hi && r.some((c) => String(c).trim())) { r.line = i + 1; body.push(r); } });
  return { head: rows[hi].map((h) => String(h).trim()), body };
}

export function mapColumns(head, cols) {
  const idx = {};
  const nh = head.map(normHead);
  for (const c of cols) {
    const i = nh.findIndex((h) => c.alias.includes(h));
    if (i >= 0) idx[c.key] = i;
  }
  const missing = cols.filter((c) => c.required && idx[c.key] == null).map((c) => c.label);
  return { idx, missing };
}

const clean = (v) => { const s = String(v ?? "").replace(/\s+/g, " ").trim(); return s || null; };

// Chuẩn hóa + kiểm tra dữ liệu xe. Trả về { rows, errors, warnings }
export function prepareVehicles(table, D) {
  const { idx, missing } = mapColumns(table.head, VEHICLE_COLS);
  if (missing.length) throw new Error("Thiếu cột bắt buộc: " + missing.join(", "));
  const tienTo = D.meta.tienTo?.XN ? D.meta.tienTo : DEFAULT_TIEN_TO;
  const rows = [], errors = [], seen = new Set();
  table.body.forEach((r, i) => {
    const line = r.line || i + 2;
    const get = (k) => (idx[k] == null ? null : clean(r[idx[k]]));
    const ma = get("ma")?.toUpperCase();
    if (!ma) return errors.push(`Dòng ${line}: thiếu mã xe`);
    if (!/^[A-ZĐ0-9][A-ZĐ0-9\-_.\/ ]*$/.test(ma)) return errors.push(`Dòng ${line}: mã xe "${ma}" có ký tự không hợp lệ`);
    if (seen.has(ma)) return errors.push(`Dòng ${line}: mã xe ${ma} bị trùng trong file`);
    seen.add(ma);
    const old = D.vmap[ma];
    let doi = get("doi") || old?.doi || tienTo[ma.split("-")[0]];
    if (!doi) return errors.push(`Dòng ${line}: không xác định được đội của ${ma} (thêm cột "doi")`);
    const cd = plain(get("che_do") || old?.che_do || "Đi ca");
    const che_do = cd === "hc" || cd.startsWith("hanh chinh") ? "HC" : cd.startsWith("di ca") || cd === "ca" ? "Đi ca" : null;
    if (!che_do) return errors.push(`Dòng ${line}: chế độ "${get("che_do")}" không hợp lệ (Đi ca / HC)`);
    const rec = { ma, doi, che_do };
    for (const k of ["model", "to_xe", "ghi_chu"]) rec[k] = idx[k] == null ? (old?.[k] ?? null) : get(k);
    // Tải trọng: chỉ xe nâng; lấy từ cột tai_trong, nếu trống thì lấy khi tên model GHI RÕ (VD "Xe nâng 5T")
    if (doi === "Xe nâng") {
      let tt = (get("tai_trong") || "").toUpperCase().replace(/\s+/g, "").replace(/TẤN$/, "T") || old?.tai_trong || taiTrongTuModel(rec.model);
      if (tt && /^\d+$/.test(tt)) tt += "T";
      if (tt && !D.taiTrongList.includes(tt)) return errors.push(`Dòng ${line}: tải trọng "${tt}" của ${ma} không hợp lệ (${D.taiTrongList.join(", ")})`);
      rec.tai_trong = tt || null;
      if (!tt) errors.push(`Dòng ${line}: xe nâng ${ma} chưa có tải trọng - vẫn nạp, hiện là "Chưa phân loại"`);
    } else rec.tai_trong = null;
    // Thiết bị gắn: chỉ xe xúc đào; ô trống giữ giá trị cũ, tên chuẩn hóa theo danh mục
    if (doi === "Xúc đào") {
      const t = get("thiet_bi_gan");
      const chuan = t ? D.thietBiGanList.find((x) => plain(x) === plain(t)) : null;
      if (t && !chuan) errors.push(`Dòng ${line}: thiết bị gắn "${t}" của ${ma} không có trong danh mục (${D.thietBiGanList.join(", ")}) - vẫn nạp`);
      rec.thiet_bi_gan = chuan || t || old?.thiet_bi_gan || null;
    } else rec.thiet_bi_gan = null;
    rows.push(rec);
  });
  return withDiff(rows, errors, D.vmap, ["doi", "model", "to_xe", "che_do", "tai_trong", "thiet_bi_gan", "ghi_chu"]);
}

export function prepareStaff(table, D) {
  const { idx, missing } = mapColumns(table.head, STAFF_COLS);
  if (missing.length) throw new Error("Thiếu cột bắt buộc: " + missing.join(", "));
  const smap = Object.fromEntries(D.staff.map((s) => [s.ma, s]));
  const kips = D.kipList;
  const rows = [], errors = [], seen = new Set();
  table.body.forEach((r, i) => {
    const line = r.line || i + 2;
    const get = (k) => (idx[k] == null ? null : clean(r[idx[k]]));
    const ma = get("ma")?.toUpperCase();
    const ho_ten = get("ho_ten");
    if (!ma) return errors.push(`Dòng ${line}: thiếu mã nhân viên`);
    if (!ho_ten) return errors.push(`Dòng ${line}: thiếu họ tên (${ma})`);
    if (seen.has(ma)) return errors.push(`Dòng ${line}: mã ${ma} bị trùng trong file`);
    seen.add(ma);
    const old = smap[ma];
    const rec = { ma, ho_ten };
    for (const k of ["doi", "to_xe", "kip", "nhom", "trang_thai"]) rec[k] = idx[k] == null ? (old?.[k] ?? null) : get(k);
    if (rec.kip) rec.kip = rec.kip.toUpperCase();
    if (rec.kip && !kips.includes(rec.kip)) errors.push(`Dòng ${line}: kíp "${rec.kip}" không có trong danh mục (${kips.join(", ")}) - vẫn nạp`);
    rec.trang_thai = rec.trang_thai || ACTIVE;
    rows.push(rec);
  });
  return withDiff(rows, errors, smap, ["ho_ten", "doi", "to_xe", "kip", "nhom", "trang_thai"]);
}

function withDiff(rows, errors, oldMap, fields) {
  let moi = 0, sua = 0, giu = 0;
  const changed = rows.filter((r) => {
    const o = oldMap[r.ma];
    if (!o) { moi++; return true; }
    if (fields.some((f) => (o[f] ?? null) !== (r[f] ?? null))) { sua++; return true; }
    giu++; return false;
  });
  const khongCo = Object.keys(oldMap).filter((m) => !rows.some((r) => r.ma === m)).length;
  return { rows: changed, all: rows, errors, stats: { moi, sua, giu, khongCo } };
}

// ---------- File mẫu ----------
export async function downloadTemplate(kind, D) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  if (kind === "vehicles") {
    const rows = D.vehicles.length ? D.vehicles.map((v) => ({ ma: v.ma, doi: v.doi, model: v.model, to_xe: v.to_xe, che_do: v.che_do, tai_trong: v.tai_trong || "", ghi_chu: v.ghi_chu || "" }))
      : [{ ma: "XL-VT01", doi: "Xúc lật", model: "Xe xúc lật LiuGong ZL50CN", to_xe: "Tổ PVC", che_do: "Đi ca", ghi_chu: "" }];
    XLSX.utils.book_append_sheet(wb, sheet(XLSX, rows, [12, 12, 34, 18, 9, 10, 24]), "Danh muc xe");
  } else {
    const rows = D.staff.length ? D.staff.map((s) => ({ ma: s.ma, ho_ten: s.ho_ten, doi: s.doi, to_xe: s.to_xe, kip: s.kip, nhom: s.nhom, trang_thai: s.trang_thai }))
      : [{ ma: "NV0001", ho_ten: "Nguyễn Văn A", doi: "Xúc lật", to_xe: "Tổ PVC", kip: "A", nhom: "Lái xe", trang_thai: ACTIVE }];
    XLSX.utils.book_append_sheet(wb, sheet(XLSX, rows, [10, 26, 12, 18, 6, 12, 16]), "Nhan su");
  }
  const guide = kind === "vehicles" ? [
    ["Cột", "Bắt buộc", "Ghi chú"],
    ["ma", "Có", "Mã xe, VD XL-VT01. Trùng mã đã có thì cập nhật thông tin xe đó."],
    ["doi", "Không", "Để trống thì tự suy ra từ tiền tố mã: XĐ = Xúc đào, XL = Xúc lật."],
    ["model", "Không", "Tên model, dùng để khớp bảng thông số kỹ thuật."],
    ["to_xe", "Không", "Tổ quản lý xe."],
    ["che_do", "Không", "Đi ca hoặc HC. Mặc định Đi ca."],
    ["tai_trong", "Xe nâng", "Chỉ cho xe nâng: 3T, 5T, 10T, 15T, 28T. Để trống thì lấy từ tên model nếu model ghi rõ (VD \"Xe nâng 5T Komatsu\")."],
    ["", "", "Xe không có trong file vẫn được GIỮ NGUYÊN (không bị xóa)."],
  ] : [
    ["Cột", "Bắt buộc", "Ghi chú"],
    ["ma", "Có", "Mã nhân viên. Trùng mã đã có thì cập nhật."],
    ["ho_ten", "Có", ""],
    ["doi", "Không", "Đội xe: " + D.doiList.join(", ")],
    ["to_xe", "Không", "Tổ: " + D.toList.join(", ")],
    ["kip", "Không", "Kíp: " + D.kipList.join(", ") + ". Người làm hành chính ghi HC."],
    ["nhom", "Không", "VD: Lái xe"],
    ["trang_thai", "Không", `Mặc định "${ACTIVE}". Người nghỉ việc ghi "Nghỉ việc" để không tính định biên.`],
    ["", "", "Nhân sự không có trong file vẫn được GIỮ NGUYÊN (không bị xóa)."],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guide), "Huong dan");
  XLSX.writeFile(wb, kind === "vehicles" ? "Mau_danh_muc_xe.xlsx" : "Mau_nhan_su.xlsx");
}

function sheet(XLSX, rows, widths) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "": "Không có dữ liệu" }]);
  if (widths) ws["!cols"] = widths.map((w) => ({ wch: w }));
  return ws;
}

// ---------- Xuất báo cáo Excel ----------
export async function exportExcel(D) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const ST = { ss: "Sẵn sàng", bddk: "Sẵn sàng (BD định kỳ)", bdcl: "BD chiến lược", hong: "Hỏng" };
  const sumRow = (r, name, label) => ({
    [label]: name, "Tổng xe": r.tong, "Sẵn sàng": r.ready, "Trong đó BD định kỳ": r.bddk, "Hỏng": r.hong, "BD chiến lược": r.bdcl,
    "Tỷ lệ SS (%)": r.tong ? +(r.rate * 100).toFixed(1) : null, "Định biên NS": r.dinhBien, "Nhân sự hiện có": r.nhanSu,
  });
  const all = D.summarize(D.vehicles);
  const byDoi = D.groupSummary(D.vehicles, "doi").map((r) => sumRow(r, r.k, "Đội xe"));
  byDoi.push(sumRow({ ...all, nhanSu: D.staffActive.length }, "TỔNG", "Đội xe"));
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, byDoi, [14, 9, 9, 18, 8, 13, 12, 13, 15]), "Theo doi");

  const byTo = [];
  for (const doi of D.doiList) {
    const vs = D.vehicles.filter((v) => v.doi === doi);
    D.groupSummary(vs, "to_xe", (s) => s.doi === doi).forEach((r) => byTo.push({ "Đội xe": doi, ...sumRow(r, r.k, "Tổ") }));
  }
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, byTo, [12, 18, 9, 9, 18, 8, 13, 12, 13, 15]), "Theo to");

  const open = [...D.open].sort((a, b) => a.ngay_vao.localeCompare(b.ngay_vao)).map((e) => {
    const v = D.vmap[e.ma_xe] || {};
    return { "Mã xe": e.ma_xe, "Đội": v.doi, "Tổ": v.to_xe, "Model": v.model, "Loại": e.loai, "Nhóm": e.nhom, "Mô tả": e.mo_ta, "Ngày vào": vn(e.ngay_vao),
      "Số ngày": diffDays(e.ngay_vao, D.today), "Dự kiến xong": vn(e.ngay_du_kien), "Phụ tùng": e.phu_tung, "PIC": e.pic, "Cảnh báo": D.flags(e).map((f) => f.label).join("; ") };
  });
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, open, [10, 10, 16, 28, 13, 20, 30, 11, 8, 12, 13, 12, 28]), "Dang xu ly");

  const ready = D.vehicles.filter((v) => D.isReady(v.ma)).map((v) => ({ "Mã xe": v.ma, "Đội": v.doi, "Tổ": v.to_xe, "Model": v.model, "Chế độ": v.che_do, "Ghi chú": D.stateOf(v.ma) === "bddk" ? "Đang BD định kỳ" : "" }));
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, ready, [10, 10, 18, 30, 8, 16]), "Xe san sang");

  const qs = [];
  for (const sh of D.upcomingShifts()) for (const r of D.shiftRows(sh)) {
    qs.push({ "Ngày": vn(sh.ngay), "Ca": sh.ca, "Kíp": r.kip, "Đội xe": r.doi, "Định biên kíp": r.dinhBien, "Thực tế": r.thucTe, "Xe SS cần người": r.xeCan,
      "Chênh lệch": r.chenh, "Đánh giá": r.chenh == null ? "Chưa nhập" : r.chenh < 0 ? `Thiếu ${-r.chenh}` : r.chenh > 0 ? `Thừa ${r.chenh}` : "Đủ", "Ghi chú": r.ghiChu });
  }
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, qs, [11, 18, 6, 10, 12, 8, 14, 10, 11, 24]), "Quan so");

  const closed = D.events.filter((e) => e.ngay_xong).sort((a, b) => b.ngay_xong.localeCompare(a.ngay_xong)).map((e) => ({
    "Mã xe": e.ma_xe, "Loại": e.loai, "Nhóm": e.nhom, "Mô tả": e.mo_ta, "Ngày vào": vn(e.ngay_vao), "Ngày xong": vn(e.ngay_xong), "Số ngày": diffDays(e.ngay_vao, e.ngay_xong), "PIC": e.pic,
  }));
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, closed, [10, 13, 20, 30, 11, 11, 8, 12]), "Da hoan thanh");

  XLSX.utils.book_append_sheet(wb, sheet(XLSX, D.vehicles.map((v) => ({
    "Mã xe": v.ma, "Đội": v.doi, "Tổ": v.to_xe, "Model": v.model, "Chế độ": v.che_do, "Tải trọng": D.taiTrongOf(v) || "", "Thiết bị gắn": D.thietBiGanOf(v) || "", "Tình trạng": ST[D.stateOf(v.ma)], "Ghi chú": v.ghi_chu,
  })), [10, 10, 18, 30, 8, 20, 20]), "Danh muc xe");

  XLSX.utils.book_append_sheet(wb, sheet(XLSX, D.staff.map((s) => ({
    "Mã NV": s.ma, "Họ tên": s.ho_ten, "Đội": s.doi, "Tổ": s.to_xe, "Kíp": s.kip, "Nhóm": s.nhom, "Trạng thái": s.trang_thai,
  })), [10, 24, 10, 18, 6, 10, 14]), "Nhan su");

  XLSX.writeFile(wb, `Bao_cao_thiet_bi_${D.today}.xlsx`);
}

export async function exportLookup(rows, name) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, rows), name.slice(0, 30));
  XLSX.writeFile(wb, name + ".xlsx");
}
