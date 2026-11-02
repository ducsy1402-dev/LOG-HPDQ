// Kế hoạch điều động tàu cập / rời cảng theo ngày, in theo biểu mẫu của 3 cảng: Hòa Phát Dung Quất, Hào Hưng, Cảng Tổng hợp Hòa Phát.
// Kế hoạch ngày tính từ 17h hôm nay đến 17h hôm sau (như tab Kế hoạch ngày tới). Ba phần:
//   I. Tàu rời cảng (ETD / ATD trong khoảng), II. Tàu cập cảng (ETB / ATB trong khoảng), III. Tàu shifting và cập mạn (shifting trong khoảng, ghi ở phiếu chuyến).
// Cột: Thời gian dự kiến | Tên tàu | Mớn nước | Chiều dài | Trọng tải | Từ | Đến | Ghi chú. Từ / Đến: số bến, PS (phao số, vùng đón trả hoa tiêu), NEO (đang neo chờ), TL (bến tàu lai).
// Chuyến thuộc cảng nào là theo bến: HH2, HH3 → Hào Hưng; 6CTH, 7CTH → Cảng Tổng hợp; các bến còn lại → Hòa Phát Dung Quất. Chuyến chưa xếp bến không vào phiếu.
import { ms } from "./format";
import { taiPdfMake } from "./bieuMauPA";
import { noiHaiBen } from "./tenBen";

export const CANG = [
  { ma: "hpdq", ten: "Hòa Phát Dung Quất", tenNgan: "HPDQ", tieuDe: "KẾ HOẠCH ĐIỀU ĐỘNG TÀU CẬP/RỜI CẢNG", congTy: ["CÔNG TY CỔ PHẦN THÉP", "HÒA PHÁT DUNG QUẤT"], logo: true, ngayDuoiTieuDe: false, ky: "hpdq" },
  { ma: "hh", ten: "Hào Hưng", tenNgan: "HH", tieuDe: "KẾ HOẠCH ĐIỀU ĐỘNG TÀU CẬP, RỜI CẢNG HÀO HƯNG", congTy: null, logo: false, ngayDuoiTieuDe: true, ky: null },
  { ma: "cth", ten: "Cảng Tổng hợp Hòa Phát", tenNgan: "CTH", tieuDe: "KẾ HOẠCH ĐIỀU ĐỘNG TÀU CẬP, RỜI CẢNG", congTy: ["CÔNG TY CỔ PHẦN", "CẢNG TỔNG HỢP HÒA PHÁT"], logo: true, ngayDuoiTieuDe: true, ky: "cth" },
];
export const cangCuaBen = (ma) => (!ma ? null : /^HH/i.test(ma) ? "hh" : /CTH$/i.test(ma) ? "cth" : "hpdq");
// Nhãn bến như trên phiếu: bến 1A là bến tàu lai (TL); bến 6CTH, 7CTH ghi 6, 7
export const nhanBenIn = (ma, cang) => (!ma ? "" : ma === "1A" ? "TL" : cang === "cth" ? String(ma).replace(/CTH$/i, "") : String(ma));
// Tàu cập hai bến (bến phụ) ghi như mẫu: 7/8, 3/5, HH2/3
const nhanIn = (ma, phu, cang) => (!ma ? "" : noiHaiBen(ma, phu, (x) => nhanBenIn(x, cang)));

const p2 = (n) => String(n).padStart(2, "0");
const gio = (t) => { const d = new Date(t); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const so = (x, dp) => (x == null || x === "" || !Number.isFinite(+x) ? "" : (+x).toLocaleString("vi-VN", { minimumFractionDigits: dp, maximumFractionDigits: dp }));
const ngayChu = (t) => { const d = new Date(t); return { d: d.getDate(), m: d.getMonth() + 1, y: d.getFullYear() }; };

// Dữ liệu ba phần của từng cảng cho khoảng [tu, den) (ms)
export function duLieuKeHoachCang({ voyages = [], stopsOf = () => [], tu, den }) {
  const trong = (t) => t != null && t >= tu && t < den;
  const theoCang = Object.fromEntries(CANG.map((c) => [c.ma, { roi: [], cap: [], shifting: [] }]));
  let chuaXep = 0;
  const hang = (v) => `${v.huong === "xuat" ? "Xuất" : "Nhập"} ${v.ten_hang || v.loai_hang || ""}`.trim();
  const dong = (v, t, tuBen, denBen, cang) => ({ t, gio: gio(t), ten: v.ten_tau, mon: so(v.draft, 2), dai: so(v.loa, 2), trongTai: so(v.dwt, 2), tu: tuBen, den: denBen, ghiChu: hang(v), cang });
  for (const v of voyages) {
    if (v.huy) continue;
    const shifts = (stopsOf(v.id) || []).filter((s) => s.loai === "shifting").sort((a, b) => String(a.tu).localeCompare(String(b.tu)));
    const benDau = shifts[0]?.ben_cu || v.ben_ma, phuDau = shifts[0]?.ben_cu ? shifts[0].ben_phu_cu : v.ben_phu; // bến lúc cập (trước khi shifting)
    let coDong = false;
    const tCap = ms(v.atb) ?? ms(v.etb);
    if (trong(tCap)) {
      const c = cangCuaBen(benDau);
      if (c) { theoCang[c].cap.push(dong(v, tCap, v.den_neo ? "NEO" : "PS", nhanIn(benDau, phuDau, c), c)); coDong = true; }
    }
    const tRoi = ms(v.atd) ?? ms(v.etd);
    if (trong(tRoi)) {
      const c = cangCuaBen(v.ben_ma);
      if (c) { theoCang[c].roi.push(dong(v, tRoi, nhanIn(v.ben_ma, v.ben_phu, c), "PS", c)); coDong = true; }
    }
    for (const s of shifts) {
      const t = ms(s.tu);
      if (!trong(t)) continue;
      const c = cangCuaBen(s.ben_moi || s.ben_cu);
      if (c) { theoCang[c].shifting.push(dong(v, t, nhanIn(s.ben_cu, s.ben_phu_cu, cangCuaBen(s.ben_cu) || c), nhanIn(s.ben_moi, s.ben_phu_moi, c), c)); coDong = true; }
    }
    if (!coDong && !v.ben_ma && (trong(tCap) || trong(tRoi))) chuaXep++;
  }
  for (const c of Object.values(theoCang)) for (const k of ["roi", "cap", "shifting"]) c[k].sort((a, b) => a.t - b.t);
  return { tu, den, ngay: ngayChu(tu), theoCang, chuaXep };
}

const CAC_PHAN = [["roi", "I. TÀU RỜI CẢNG"], ["cap", "II. TÀU CẬP CẢNG"], ["shifting", "III. TÀU SHIFTING VÀ CẬP MẠN"]];
const COT = ["Thời gian\ndự kiến", "Tên tàu", "Mớn\nnước", "Chiều dài", "Trọng tải", "Từ", "Đến", "Ghi chú"];
const TOI_THIEU = 3; // số dòng tối thiểu mỗi phần (dòng trống kẻ sẵn như mẫu)
const hang8 = (r) => [r.gio, r.ten, r.mon, r.dai, r.trongTai, r.tu, r.den, r.ghiChu];
const dongPhan = (ds) => [...ds.map(hang8), ...Array.from({ length: Math.max(0, TOI_THIEU - ds.length) }, () => Array(8).fill(" "))];
const tenFile = (du, cang, duoi) => `Ke_hoach_dieu_dong_tau_${cang}_${du.ngay.y}-${p2(du.ngay.m)}-${p2(du.ngay.d)}.${duoi}`;
export const cangChon = (ma) => (ma === "tat_ca" ? CANG : CANG.filter((c) => c.ma === ma));
const tenFileChon = (du, ma, duoi) => tenFile(du, ma === "tat_ca" ? "3_cang" : CANG.find((c) => c.ma === ma).tenNgan, duoi);

// ---------- PDF ----------
export function docPdfKeHoachCang(du, dsCang, logo) {
  const { d, m, y } = du.ngay;
  const content = [];
  dsCang.forEach((c, i) => {
    const dl = du.theoCang[c.ma];
    const trang = i ? { pageBreak: "before" } : {};
    if (c.congTy) content.push({ ...trang, margin: [4, 0, 0, 2], columns: [{ width: 140, stack: [{ image: logo, width: 105, alignment: "center", margin: [0, 0, 0, 3] }, ...c.congTy.map((t) => ({ text: t, bold: true, fontSize: 9, alignment: "center" }))] }] });
    content.push({ ...(c.congTy ? {} : trang), text: c.tieuDe, bold: true, fontSize: 14, alignment: "center", margin: [0, c.congTy ? 4 : 0, 0, c.ngayDuoiTieuDe ? 1 : 5] });
    if (c.ngayDuoiTieuDe) content.push({ text: `Ngày ${d} Tháng ${m} Năm ${y}`, italics: true, alignment: "center", fontSize: 9.5, margin: [0, 0, 0, 4] });
    const body = [COT.map((t) => ({ text: t, bold: true, alignment: "center", fontSize: 8.5 }))];
    const phan = [];
    for (const [k, ten] of CAC_PHAN) {
      body.push([{ text: ten, colSpan: 8, bold: true, fontSize: 10, margin: [0, 1, 0, 1] }, ...Array(7).fill({})]);
      phan.push(body.length - 1);
      for (const r of dongPhan(dl[k])) body.push(r.map((t, j) => ({ text: t, fontSize: 8.5, alignment: j >= 2 && j <= 4 ? "right" : j === 5 || j === 6 ? "center" : "left", margin: [0, 0, 0, 0] })));
    }
    content.push({
      table: { headerRows: 1, widths: [72, "*", 30, 44, 58, 32, 32, 118], body, dontBreakRows: true },
      layout: { hLineWidth: (i2, nd) => (i2 === 0 || i2 === nd.table.body.length || phan.includes(i2) || phan.includes(i2 - 1) || i2 === 1 ? 0.8 : 0.3), vLineWidth: (i2, nd) => (i2 === 0 || i2 === nd.table.widths.length ? 0.8 : 0.3),
        hLineColor: () => "#777", vLineColor: () => "#777", paddingLeft: () => 3, paddingRight: () => 3, paddingTop: () => 1.5, paddingBottom: () => 1.5 },
    });
    if (c.ky === "hpdq") content.push({ margin: [0, 8, 0, 0], stack: [{ text: `Quảng Ngãi, ngày ${d} tháng ${m} năm ${y}`, italics: true, alignment: "right", fontSize: 9.5, margin: [0, 0, 30, 4] }, { text: "KT. GIÁM ĐỐC BP. LOGISTICS", bold: true, alignment: "right", fontSize: 9, margin: [0, 0, 20, 0] }, { text: "PHÓ GIÁM ĐỐC BP. LOGISTICS", bold: true, alignment: "right", fontSize: 9, margin: [0, 0, 20, 0] }] });
    if (c.ky === "cth") content.push({ margin: [0, 12, 0, 0], stack: [{ text: "CÔNG TY CỔ PHẦN", bold: true, alignment: "center", fontSize: 11, margin: [200, 0, 0, 0] }, { text: "CẢNG TỔNG HỢP HÒA PHÁT", bold: true, alignment: "center", fontSize: 11, margin: [200, 0, 0, 0] }] });
  });
  return { pageSize: "A4", pageOrientation: "portrait", pageMargins: [40, 30, 40, 40], defaultStyle: { font: "Roboto", fontSize: 9 }, content, footer: (cur, tong) => ({ text: `${cur}/${tong}`, alignment: "center", fontSize: 8, margin: [0, 8, 0, 0] }) };
}
export async function xuatPdfKeHoachCang(du, ma, logo) {
  const pdfMake = await taiPdfMake();
  pdfMake.createPdf(docPdfKeHoachCang(du, cangChon(ma), logo)).download(tenFileChon(du, ma, "pdf"));
}

// ---------- Excel ----------
export async function bookExcelKeHoachCang(du, dsCang, logo) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const vien = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  const font = { name: "Times New Roman", size: 11 };
  const { d, m, y } = du.ngay;
  const idLogo = logo ? wb.addImage({ base64: logo, extension: "png" }) : null;
  for (const c of dsCang) {
    const dl = du.theoCang[c.ma];
    const ws = wb.addWorksheet(c.tenNgan, { pageSetup: { orientation: "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } } });
    ws.columns = [20, 30, 9, 12, 14, 8, 8, 36].map((w) => ({ width: w }));
    const ghi = (r, col, v, x = {}) => { const o = ws.getCell(r, col); o.value = v; o.font = { ...font, bold: !!x.b, italic: !!x.i, size: x.size || font.size }; o.alignment = { vertical: "middle", horizontal: x.al || "left", wrapText: true }; if (x.vien) o.border = vien; return o; };
    const gop = (r1, c1, r2, c2) => { if (r2 > r1 || c2 > c1) ws.mergeCells(r1, c1, r2, c2); };
    let r = 1;
    if (c.congTy) {
      if (idLogo != null) ws.addImage(idLogo, { tl: { col: 0.1, row: 0.1 }, ext: { width: 150, height: 30 } });
      r = 3;
      for (const t of c.congTy) { ghi(r, 1, t, { b: true, al: "center", size: 10 }); gop(r, 1, r, 2); r++; }
      r++;
    }
    ghi(r, 1, c.tieuDe, { b: true, al: "center", size: 14 }); gop(r, 1, r, 8); ws.getRow(r).height = 24; r++;
    if (c.ngayDuoiTieuDe) { ghi(r, 1, `Ngày ${d} Tháng ${m} Năm ${y}`, { i: true, al: "center", size: 10 }); gop(r, 1, r, 8); r++; }
    const r0 = r;
    COT.forEach((t, k) => ghi(r, k + 1, t, { b: true, al: "center", vien: true })); ws.getRow(r).height = 30; r++;
    for (const [k, ten] of CAC_PHAN) {
      ghi(r, 1, ten, { b: true, vien: true }); gop(r, 1, r, 8); for (let q = 2; q <= 8; q++) ws.getCell(r, q).border = vien; r++;
      for (const row of dongPhan(dl[k])) { row.forEach((t, j) => ghi(r, j + 1, t, { vien: true, al: j >= 2 && j <= 4 ? "right" : j === 5 || j === 6 ? "center" : "left" })); r++; }
    }
    r++;
    if (c.ky === "hpdq") {
      ghi(r, 4, `Quảng Ngãi, ngày ${d} tháng ${m} năm ${y}`, { i: true, al: "center" }); gop(r, 4, r, 8); r++;
      ghi(r, 4, "KT. GIÁM ĐỐC BP. LOGISTICS", { b: true, al: "center", size: 10 }); gop(r, 4, r, 8); r++;
      ghi(r, 4, "PHÓ GIÁM ĐỐC BP. LOGISTICS", { b: true, al: "center", size: 10 }); gop(r, 4, r, 8);
    } else if (c.ky === "cth") {
      ghi(r, 4, "CÔNG TY CỔ PHẦN", { b: true, al: "center" }); gop(r, 4, r, 8); r++;
      ghi(r, 4, "CẢNG TỔNG HỢP HÒA PHÁT", { b: true, al: "center" }); gop(r, 4, r, 8);
    }
    ws.views = [{ state: "frozen", ySplit: r0 }];
  }
  return wb;
}
export async function xuatExcelKeHoachCang(du, ma, logo) {
  const wb = await bookExcelKeHoachCang(du, cangChon(ma), logo);
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a"); a.href = url; a.download = tenFileChon(du, ma, "xlsx"); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
