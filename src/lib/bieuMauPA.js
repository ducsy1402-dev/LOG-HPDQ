// Biểu mẫu "PHƯƠNG ÁN XẾP HÀNG / DỠ HÀNG" (theo mẫu của cảng): đầu phiếu 7 dòng, bảng theo lượt (mỗi lượt chia máng,
// dòng TỔNG, cuối TỔNG CỘNG), các ô chung (phương án, TB hầm, xe, định lượng, vị trí bốc / đổ, TB bãi), ghi chú cuối phiếu.
// Dựng một lưới ô chung rồi xuất PDF (pdfmake) và Excel (ExcelJS).
import { hangCuaChuyen, diemCua, cauTauCua } from "./phuongAn";
import { dsGanCau } from "./thietBi";

const p2 = (n) => String(n).padStart(2, "0");
const ngay = (t) => { if (!t) return ""; const d = new Date(t); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`; };
const soVN = (x, so = 0) => (x == null || !Number.isFinite(+x) ? "" : (+x).toLocaleString("vi-VN", { maximumFractionDigits: so, minimumFractionDigits: so }));
const dong = (ds) => ds.filter(Boolean).map((x) => `- ${x}`).join("\n");
// Thiết bị viết như phiếu tay: "9 xúc đào + 2 xúc lật" (thiết bị nhà thầu ghi thêm "(NT)")
const moTaIn = (ds) => (ds || []).filter((t) => t?.loai).map((t) => `${t.so != null && t.so !== "" ? `${t.so} ` : ""}${String(t.loai).toLowerCase()}${t.don_vi === "nha_thau" ? " (NT)" : ""}`).join(" + ");

// Phương thức định lượng và phương tiện thuê ngoài: người lập chọn ở hộp phương án (plan.bieu_mau.phuong_thuc / thue_ngoai); để trống thì web tự điền.
// Phiếu in chỉ lấy theo thông tin phương án, không còn ô sửa riêng từng cột của biểu mẫu.
export const PHUONG_THUC = [["mon", "Mớn"], ["can", "Cân"], ["eticket", "Eticket"], ["khac", "Khác"]];
const IN_PHUONG_THUC = { mon: "Đo mớn", can: "Theo cân", eticket: "Theo etiket" };
export const THUE_NGOAI = [["co", "Phát sinh thuê ngoài"], ["khong", "Không phát sinh thuê ngoài"], ["co_ncc", "Phát sinh thuê ngoài và NCC chịu chi phí"]];
// Phương án cũ ghi chữ tự do ("Theo cân", "Đo mớn"…) ở bieu_mau.dinh_luong: đổi về lựa chọn gần nhất, không khớp thì thành "Khác"
export function phuongThucCua(bm) {
  const k = bm?.phuong_thuc;
  if (PHUONG_THUC.some(([x]) => x === k)) return { k, khac: bm?.phuong_thuc_khac || "" };
  const cu = String(bm?.dinh_luong || "").trim();
  if (!cu) return { k: "", khac: "" };
  const p = cu.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return p.includes("mon") ? { k: "mon", khac: "" } : p.includes("can") ? { k: "can", khac: "" } : /e-?ti/.test(p) ? { k: "eticket", khac: "" } : { k: "khac", khac: cu };
}
// Chữ in ở cột Định lượng ("" = chưa chọn, web tự điền theo hướng)
export const chuPhuongThuc = (bm) => { const { k, khac } = phuongThucCua(bm); return k === "khac" ? khac.trim() : IN_PHUONG_THUC[k] || ""; };
// "co" | "khong" | "co_ncc" | "" (bản cũ ghi đúng / sai)
export const thueNgoaiCua = (bm) => { const x = bm?.thue_ngoai; return THUE_NGOAI.some(([k]) => k === x) ? x : x === true ? "co" : x === false ? "khong" : ""; };
export const GHI_CHU_CHUAN = "Đối với trường hợp không phát sinh chi phí xếp dỡ ngoài dự tính (các loại hàng hóa bắt buộc phát sinh chi phí) thì trình ký đến P.KH. Đối với các trường hợp phát sinh chi phí ngoài dự tính sẽ trình ký đến BGĐ.";

// Giá trị tự điền cho các ô chung của phiếu (người lập sửa lại ở plan.bieu_mau)
export function tuDongBieuMau(v, plan, kq) {
  const xuat = v.huong === "xuat";
  const diem = diemCua(plan);
  const khac = kq?.tbKhac || [];
  const beHam = khac.filter((t) => (t.viec || "be_ham") === "be_ham"), hoTro = khac.filter((t) => t.viec === "ho_tro");
  const xe = (kq?.xe || []).filter((x) => x.loai);
  const coBT = !!(plan.bang_tai || v.bang_tai);
  const cauBo = (plan.cau || []).length > 0, cauTau = !!cauTauCua(plan);
  return {
    luong: xuat ? "Bãi - Xe - Tàu" : coBT ? "Tàu - BT - Bãi" : "Tàu - Xe - Bãi",
    tb_ham: dong([moTaIn(beHam) && `${moTaIn(beHam)} ${xuat ? "be hầm" : "dưới hầm"}`, moTaIn(hoTro) && `${moTaIn(hoTro)} hỗ trợ làm hàng`]) || "Không",
    loai_xe: [...new Set(xe.map((x) => x.loai))].join(" / ") || "Không",
    so_xe: xe.length ? String(xe.reduce((s, x) => s + (+x.so || 0), 0) || "") : "Không",
    dinh_luong: xuat ? "Theo cân" : "Đo mớn",
    vi_tri: dong(diem.map((d) => `${d.bai}${d.khu ? ` › ${d.khu}` : ""}`)),
    tb_bai: dong(diem.map((d) => moTaIn(d.tb))) || "",
    thue_ngoai: [...xe, ...khac, ...diem.flatMap((d) => d.tb)].some((t) => t.don_vi === "nha_thau"),
    // Công nghệ xếp dỡ: cẩu + thiết bị gắn cẩu đã chọn ở phương án ("Cầu bờ - Mâm từ + Ngáng")
    cong_nghe: [cauTau && !cauBo ? "Cầu tàu" : "Cầu bờ", dsGanCau(plan.cau_gan).join(" + ")].filter(Boolean).join(" - "),
  };
}

// Dữ liệu phiếu: đầu phiếu, các lượt (mỗi giai đoạn một lượt; làm đều thì mỗi loại hàng một lượt), ô chung, ghi chú
export function duLieuBieuMau(v, plan, kq, { now = Date.now(), keHoach7 = false } = {}) {
  const xuat = v.huong === "xuat";
  const bm = plan.bieu_mau || {};
  const td = tuDongBieuMau(v, plan, kq);
  const mangMD = +v.so_mang > 0 ? +v.so_mang : 1;
  const ct = cauTauCua(plan);
  const cauIn = [(plan.cau || []).length && `Cẩu làm hàng: ${plan.cau.join(", ")}`, ct && +ct.so > 0 && `Cẩu tàu: ${ct.so} cẩu${+ct.nang_suat > 0 ? ` × ${ct.nang_suat} t/h` : ""}`, (plan.bang_tai || v.bang_tai) && `Băng tải: ${plan.bang_tai || v.bang_tai}`].filter(Boolean).join("\n");
  const nguon = kq?.coGiaiDoan ? kq.giaiDoan : hangCuaChuyen(v).map((h) => ({ hang: h.ten, kl: h.kl || +v.khoi_luong || 0, tocDo: kq?.tocDo, ten: "" }));
  const luot = nguon.filter((g) => +g.kl > 0).map((g, i) => {
    const so_mang = Math.max(1, Math.round(+g.so_mang || mangMD));
    const ghi = g.ghi_chu != null && g.ghi_chu !== "" ? g.ghi_chu : g.ten && g.ten !== "Làm đều" ? g.ten : "";
    // Hầm số: ô riêng của lượt, không có thì theo hầm số khai cho loại hàng
    return { stt: i + 1, hang: g.hang || v.ten_hang || v.loai_hang || "", luong: +g.kl, ham: g.ham || bm.ham_theo_hang?.[g.hang] || "", so_mang, tocDo: +g.tocDo || null,
      cn: g.cong_nghe || td.cong_nghe, ghi_chu: [i === 0 ? cauIn : "", ghi].filter(Boolean).join("\n") };
  });
  const tongKL = luot.reduce((s, l) => s + l.luong, 0) || +v.khoi_luong || 0;
  const soNgay = luot.every((l) => l.tocDo > 0) && luot.length ? luot.reduce((s, l) => s + l.luong / l.tocDo, 0) : null;
  const ghiThem = String(plan.ghi_chu ?? "").split("\n").map((x) => x.replace(/^\s*-\s*/, "").trim()).filter(Boolean);
  const d = new Date(now);
  return {
    xuat, ten_tau: v.ten_tau, ben: v.ben_ma || "", tongKL, ngayCap: ngay(v.atb || v.etb), ngayRoi: ngay(v.etd),
    sanLuong: soNgay ? tongKL / soNgay : null, soNgay,
    ghiKL: xuat ? "Tấn (Khối lượng dự kiến xếp hàng xuống tàu)" : "Tấn (Khối lượng lấy theo sơ đồ tàu)",
    luot,
    // Các ô chung lấy theo phương án; riêng Định lượng và thuê ngoài do người lập chọn (trống = tự điền)
    chung: { luong: td.luong, tb_ham: td.tb_ham, loai_xe: td.loai_xe, so_xe: td.so_xe, dinh_luong: chuPhuongThuc(bm) || td.dinh_luong, vi_tri: td.vi_tri, tb_bai: td.tb_bai },
    thueNgoai: thueNgoaiCua(bm) || (td.thue_ngoai ? "co" : "khong"),
    ghiChu: [GHI_CHU_CHUAN, ...ghiThem], keHoach7,
    noiNgay: `Quảng Ngãi, ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`,
  };
}

// Lưới bảng chính: 15 cột; mỗi ô { t, rs, cs, b (đậm), al (căn), i (nghiêng) }, ô bị gộp = null
export const COT = ["Lượt", "Loại hàng", "Lượng", "Hầm số", "Máng số", "Năng suất/ngày", "CN xếp dỡ", "Phương án", "TB hầm/\nMặt bến", "Loại xe", "Số xe", "Định lượng", "Vị trí bốc/\nđổ hàng", "TB bãi/Số máng", "Ghi chú"];
export const RONG = [5, 15, 8, 6, 6, 9, 13, 11, 16, 11, 6, 9, 13, 14, 16]; // độ rộng cột Excel (ký tự)
export function luoiBieuMau(du) {
  const rows = [];
  const o = (t, x = {}) => ({ t: t ?? "", ...x });
  for (const l of du.luot) {
    const m = l.so_mang, nsMang = l.tocDo ? l.tocDo / m : null;
    for (let j = 0; j < m; j++) {
      const r = Array(15).fill(undefined);
      if (j === 0) {
        r[0] = o(l.stt, { rs: m }); r[1] = o(l.hang, { rs: m }); r[2] = o(soVN(l.luong), { rs: m, al: "right" }); r[3] = o(l.ham, { rs: m });
        r[6] = o(l.cn, { rs: m }); r[14] = o(l.ghi_chu, { rs: m + 1, i: true });
      }
      r[4] = o(j + 1); r[5] = o(soVN(nsMang), { al: "right" });
      rows.push(r);
    }
    const t = Array(15).fill(undefined);
    t[0] = o("TỔNG", { cs: 2, b: true }); t[2] = o(soVN(l.luong), { b: true, al: "right" }); t[3] = o(""); t[4] = o(m, { b: true }); t[5] = o(soVN(l.tocDo), { b: true, al: "right" }); t[6] = o("");
    rows.push(t);
  }
  // Ô chung gộp suốt các lượt
  if (rows.length) {
    const c = du.chung, n = rows.length;
    [[7, c.luong], [8, c.tb_ham], [9, c.loai_xe], [10, c.so_xe], [11, c.dinh_luong], [12, c.vi_tri], [13, c.tb_bai]].forEach(([k, t]) => { rows[0][k] = o(t, { rs: n }); });
  }
  const tc = Array(15).fill(undefined);
  tc[0] = o("TỔNG CỘNG", { cs: 2, b: true }); tc[2] = o(soVN(du.tongKL), { b: true, al: "right" });
  for (const k of [3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14]) tc[k] = o("");
  tc[5] = o(soVN(du.sanLuong), { b: true, al: "right" });
  rows.push(tc);
  // Đánh dấu ô bị gộp (null) theo rs / cs
  const phu = new Set();
  rows.forEach((r, i) => r.forEach((c, k) => { if (!c) return; for (let a = 0; a < (c.rs || 1); a++) for (let b = 0; b < (c.cs || 1); b++) if (a || b) phu.add(`${i + a}:${k + b}`); }));
  return rows.map((r, i) => r.map((c, k) => (phu.has(`${i}:${k}`) ? null : c || o(""))));
}
export const dauPhieu = (du) => [
  ["1", "TÊN TÀU", du.ten_tau, ""], ["2", "BẾN CẬP", du.ben, ""], ["3", "TỔNG KHỐI LƯỢNG", soVN(du.tongKL), du.ghiKL],
  ["4", "NGÀY CẬP DỰ KIẾN", du.ngayCap, ""], ["5", "NGÀY RỜI DỰ KIẾN", du.ngayRoi, ""],
  ["6", "SẢN LƯỢNG CAM KẾT", soVN(du.sanLuong), "Tấn/ngày"], ["7", "TỔNG SỐ NGÀY KHAI THÁC", soVN(du.soNgay, 2), "Ngày"],
];
// "☒ có phát sinh thuê ngoài / ☐ không phát sinh thuê ngoài / ☐ có phát sinh thuê ngoài và NCC chịu chi phí"
const dongThueNgoai = (du, x, o) => `Phương tiện vận chuyển: ${THUE_NGOAI.map(([k, t]) => `${du.thueNgoai === k ? x : o} ${t.toLowerCase()}`).join(" / ")}.`;
const tenFile = (du, plan, duoi) => `Phuong_an_${String(du.ten_tau || "tau").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-z0-9]+/gi, "_")}_${plan.ten || ""}.${duoi}`;

// ---------- PDF ----------
export async function taiPdfMake() {
  const [{ default: pdfMake }, fonts] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
  pdfMake.vfs = fonts.default?.pdfMake?.vfs || fonts.pdfMake?.vfs || fonts.default || fonts.vfs;
  return pdfMake;
}
export async function xuatPdfPA(du, plan) {
  const pdfMake = await taiPdfMake();
  pdfMake.createPdf(docPdfPA(du)).download(tenFile(du, plan, "pdf"));
}
export function docPdfPA(du) {
  const khung = { hLineWidth: () => 0.6, vLineWidth: () => 0.6, paddingLeft: () => 3, paddingRight: () => 3, paddingTop: () => 2, paddingBottom: () => 2 };
  // pdfmake không căn giữa theo chiều dọc: ước lượng chiều cao từng dòng (số dòng chữ theo độ rộng cột) rồi đệm phía trên mỗi ô
  const W0 = [18, 70, 36, 30, 26, 40, 58, 50, 74, 48, 26, 40, 62, 62];
  const W = [...W0, 802 - W0.reduce((a, b) => a + b, 0) - 10];
  const FS = 7, LH = FS * 1.17, PAD = 4;
  const rong = (k, cs = 1) => W.slice(k, k + cs).reduce((a, b) => a + b, 0);
  const soDong = (t, w, dam) => String(t ?? "").split("\n").reduce((s, d) => s + Math.max(1, Math.ceil((d.length * FS * (dam ? 0.5 : 0.47)) / Math.max(10, w - 6))), 0);
  const cao = (c, k) => soDong(c.t, rong(k, c.cs || 1), c.b) * LH + PAD;
  const luoi = [COT.map((t) => ({ t, b: true, dau: true })), ...luoiBieuMau(du)];
  const hDong = luoi.map((r) => Math.max(LH + PAD, ...r.map((c, k) => (c && (c.rs || 1) === 1 ? cao(c, k) : 0))));
  luoi.forEach((r, i) => r.forEach((c, k) => { // ô gộp cao hơn các dòng: dòng cuối nở thêm
    if (!c || (c.rs || 1) === 1) return;
    const tong = hDong.slice(i, i + c.rs).reduce((a, b) => a + b, 0), can = cao(c, k);
    if (can > tong) hDong[i + c.rs - 1] += can - tong;
  }));
  const dem = (c, k, i) => Math.max(0, (hDong.slice(i, i + (c.rs || 1)).reduce((a, b) => a + b, 0) - cao(c, k)) / 2);
  const body = luoi.map((r, i) => r.map((c, k) => (c === null ? {} : {
    text: String(c.t ?? ""), rowSpan: c.rs, colSpan: c.cs, bold: c.b, italics: c.i, alignment: c.al || "center", margin: [0, dem(c, k, i), 0, 0], ...(c.dau ? { fillColor: "#f1f5f9" } : {}),
  })));
  const doc = {
    pageSize: "A4", pageOrientation: "landscape", pageMargins: [20, 24, 20, 24],
    defaultStyle: { font: "Roboto", fontSize: 7.5 },
    content: [
      { text: [{ text: "PHƯƠNG ÁN  " }, { text: du.xuat ? "[X]" : "[  ]" }, " XẾP HÀNG / ", { text: du.xuat ? "[  ]" : "[X]" }, " DỠ HÀNG"], alignment: "center", bold: true, fontSize: 13, margin: [0, 0, 0, 6] },
      { table: { widths: [14, 150, 110, "*"], body: dauPhieu(du).map(([a, b, c, d], i) => [{ text: a, alignment: "center" }, { text: b, bold: true }, { text: c, bold: i === 0, alignment: [2, 5, 6].includes(i) ? "right" : "left" }, { text: d, italics: i === 2 }]) }, layout: khung, margin: [0, 0, 0, 6] },
      { table: { headerRows: 1, widths: W, body, dontBreakRows: true }, layout: khung, fontSize: FS },
      { margin: [0, 6, 0, 0], fontSize: 8, stack: [
        { text: "Ghi chú:", italics: true },
        { text: `- ${dongThueNgoai(du, "[X]", "[  ]")}`, italics: true },
        ...du.ghiChu.map((g) => ({ text: `- ${g}`, italics: true })),
        ...(du.keHoach7 ? [{ text: "- Tàu nằm trong kế hoạch 7 ngày.", bold: true, italics: true, color: "#dc2626" }] : []),
        { text: du.noiNgay, italics: true, alignment: "right", margin: [0, 4, 0, 0] },
      ] },
    ],
  };
  return doc;
}

// ---------- Excel ----------
export async function xuatExcelPA(du, plan) {
  const wb = await bookExcelPA(du);
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a"); a.href = url; a.download = tenFile(du, plan, "xlsx"); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function bookExcelPA(du) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Phuong an", { pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } } });
  const font = { name: "Times New Roman", size: 11 };
  const vien = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  ws.columns = RONG.map((w) => ({ width: w }));
  const ghi = (r, c, v, x = {}) => { const o = ws.getCell(r, c); o.value = v; o.font = { ...font, bold: !!x.b, italic: !!x.i, color: x.mau ? { argb: x.mau } : undefined, size: x.size || font.size }; o.alignment = { vertical: "middle", horizontal: x.al || "left", wrapText: true }; if (x.vien) o.border = vien; return o; };
  const gop = (r1, c1, r2, c2) => { if (r2 > r1 || c2 > c1) ws.mergeCells(r1, c1, r2, c2); };
  const khungO = (r1, c1, r2, c2) => { for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) ws.getCell(r, c).border = vien; };

  ghi(1, 1, `PHƯƠNG ÁN ${du.xuat ? "☒" : "☐"} XẾP HÀNG/ ${du.xuat ? "☐" : "☒"} DỠ HÀNG`, { b: true, al: "center", size: 14 }); gop(1, 1, 1, 15);
  ws.getRow(1).height = 26;
  // Đầu phiếu 7 dòng: STT | nhãn (B:F) | giá trị (G:I) | đơn vị / ghi chú (J:O)
  dauPhieu(du).forEach(([a, b, c, d], i) => {
    const r = 2 + i;
    ghi(r, 1, +a, { al: "center" }); ghi(r, 2, b, { b: true }); gop(r, 2, r, 6);
    const so = [2, 5, 6].includes(i) && du[["", "", "tongKL", "", "", "sanLuong", "soNgay"][i]] != null;
    const val = ghi(r, 7, so ? +du[["", "", "tongKL", "", "", "sanLuong", "soNgay"][i]] : c, { b: i === 0, al: so ? "right" : "left" });
    if (so) val.numFmt = i === 6 ? "#,##0.00" : "#,##0";
    gop(r, 7, r, 9); ghi(r, 10, d, { i: i === 2 }); gop(r, 10, r, 15);
    khungO(r, 1, r, 15);
  });
  // Bảng chính
  const r0 = 10;
  COT.forEach((t, k) => ghi(r0, k + 1, t, { b: true, al: "center", vien: true }));
  ws.getRow(r0).height = 32;
  const luoi = luoiBieuMau(du);
  luoi.forEach((row, i) => row.forEach((c, k) => {
    if (c === null) return;
    const r = r0 + 1 + i, so = c.al === "right" && String(c.t).trim() !== "";
    const o = ghi(r, k + 1, so ? Number(String(c.t).replace(/\./g, "").replace(",", ".")) : c.t, { b: c.b, i: c.i, al: c.al || "center" });
    if (so) o.numFmt = "#,##0";
    gop(r, k + 1, r + (c.rs || 1) - 1, k + (c.cs || 1));
  }));
  khungO(r0, 1, r0 + luoi.length, 15);
  // Ghi chú cuối phiếu
  let r = r0 + luoi.length + 2;
  const dongGhi = (t, x = {}) => { ghi(r, 1, t, { i: true, ...x }); gop(r, 1, r, 15); r++; };
  dongGhi("Ghi chú:");
  dongGhi(`- ${dongThueNgoai(du, "☒", "☐")}`);
  for (const g of du.ghiChu) dongGhi(`- ${g}`);
  if (du.keHoach7) dongGhi("- Tàu nằm trong kế hoạch 7 ngày.", { b: true, mau: "FFDC2626" });
  r++;
  ghi(r, 1, du.noiNgay, { i: true, al: "right" }); gop(r, 1, r, 15);
  return wb;
}
