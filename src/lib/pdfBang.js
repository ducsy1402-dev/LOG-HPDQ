// Chữ chung của mọi file PDF (anh Sỹ 24/11/2026): font Times New Roman, cỡ 13, căn giữa theo chiều dọc trong ô bảng.
// - Times New Roman là font có bản quyền, không thể nhúng vào web; dùng Tinos (SIL Open Font License, tải kèm ở public/fonts) có kích thước và hình dạng chữ tương đương
//   và đủ dấu tiếng Việt. Font được tải khi tạo PDF lần đầu (taiPdfMake đăng ký vào pdfmake) và nạp vào trình duyệt để ĐO chiều rộng chữ.
// - pdfmake không có căn giữa theo chiều dọc: bangVuaVan đo chữ thật để tính độ rộng cột (cột chữ ngắn vừa nội dung, cột chữ dài chia phần còn lại)
//   rồi đếm số dòng chữ của từng ô và đệm phía trên ô ít dòng hơn để chữ nằm giữa chiều cao dòng.
export const PDF_FONT = "Times";
export const PDF_CO = 13;
const TEN_DO = "TinosPdf";
const FILES = { normal: "Tinos-Regular.ttf", bold: "Tinos-Bold.ttf", italics: "Tinos-Italic.ttf", bolditalics: "Tinos-BoldItalic.ttf" };

const base64 = (buf) => {
  const u = new Uint8Array(buf); let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};

let nho = null;
// Tải 4 file font (một lần), trả { vfs, fonts } để gán vào pdfMake; đồng thời nạp vào trình duyệt để đo chữ
export function taiFontTimes() {
  if (nho) return nho;
  nho = (async () => {
    const goc = (import.meta.env?.BASE_URL || "/") + "fonts/";
    const ds = await Promise.all(Object.entries(FILES).map(async ([k, f]) => {
      const r = await fetch(goc + f);
      if (!r.ok) throw new Error("Không tải được font " + f);
      return [k, f, await r.arrayBuffer()];
    }));
    const vfs = {};
    for (const [, f, b] of ds) vfs[f] = base64(b);
    try {
      for (const [k, , b] of ds) {
        const face = new FontFace(TEN_DO, b, { weight: k.startsWith("bold") ? "700" : "400", style: k.includes("italics") ? "italic" : "normal" });
        await face.load(); document.fonts.add(face);
      }
    } catch { /* không nạp được thì đo gần đúng */ }
    return { vfs, fonts: { [PDF_FONT]: FILES } };
  })().catch((e) => { nho = null; throw e; });
  return nho;
}

const cv = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
export function doRong(t, { dam = false, nghieng = false, co = PDF_CO } = {}) {
  if (!t) return 0;
  if (cv) { cv.font = `${nghieng ? "italic " : ""}${dam ? "bold " : ""}${co}px ${TEN_DO}, "Times New Roman", serif`; return cv.measureText(t).width; }
  return String(t).length * co * 0.48;
}
// Ô bị gộp (placeholder {} đứng sau ô colSpan / rowSpan): không có nội dung nào
const laOGop = (c) => c.text === undefined && !c.stack && !c.image && !c.canvas && !c.columns && !c.ul && !c.table;
// Chữ thuần của một ô (chuỗi / số / mảng đoạn chữ / { text }); ô chứa hình, canvas, stack thì null
function laChu(c) {
  if (c == null) return "";
  if (typeof c === "string" || typeof c === "number") return String(c);
  if (Array.isArray(c)) return c.map(laChu).join("");
  if (c.text != null) return laChu(c.text);
  return null;
}
// Số dòng chữ khi xuống dòng theo từ trong bề rộng rong (từ dài hơn rong thì bẻ thêm dòng)
export function soDong(t, rong, o = {}) {
  const sp = doRong(" ", o);
  let tong = 0;
  for (const dong of String(t ?? "").split("\n")) {
    let n = 1, cur = 0;
    for (const w of dong.split(/\s+/).filter(Boolean)) {
      const wd = doRong(w, o);
      if (wd > rong) { n += Math.ceil(wd / rong) - 1 + (cur > 0 ? 1 : 0); cur = wd % rong; continue; }
      if (cur === 0) cur = wd; else if (cur + sp + wd <= rong) cur += sp + wd; else { n++; cur = wd; }
    }
    tong += n;
  }
  return tong;
}

// body: mảng dòng, mỗi ô là chuỗi / số / { text, bold, italics, colSpan, rowSpan, alignment, margin, ... } hoặc {} (ô bị gộp).
// usable: bề rộng bảng (pt) = bề rộng vùng chữ của trang. Trả { widths, body } dùng cho table của pdfmake.
//   - cột chữ: rộng = chữ dài nhất trên MỘT dòng (nếu đủ chỗ) hoặc nhỏ nhất = từ dài nhất; phần còn lại chia theo tỉ lệ chữ
//   - cột có ô không phải chữ (thanh, hình): rộng cố định = rongCo của ô (mặc định 70)
//   - mỗi ô được đệm phía trên để chữ nằm giữa chiều cao dòng (căn giữa theo chiều dọc)
export function bangVuaVan(body, { usable, padX = 2.5, co = PDF_CO, lh = co * 1.15, tran = {} } = {}) {
  const n = Math.max(...body.map((r) => r.length));
  const cell = (c) => (c == null || typeof c !== "object" || Array.isArray(c) ? { text: c == null ? "" : c } : c);
  const rows = body.map((r) => Array.from({ length: n }, (_, j) => cell(r[j])));
  const kieu = (c) => ({ dam: !!c.bold || c.style === "th", nghieng: !!c.italics, co });
  const nat = Array(n).fill(0), min = Array(n).fill(0), codinh = Array(n).fill(null);
  rows.forEach((r) => r.forEach((c, j) => {
    if (laOGop(c) || (c.colSpan || 1) > 1 || (c.rowSpan || 1) > 1) return;
    const t = laChu(c);
    if (t == null) { codinh[j] = Math.max(codinh[j] || 0, c.rongCo || 70); return; }
    const k = kieu(c);
    nat[j] = Math.max(nat[j], Math.max(0, ...t.split("\n").map((d) => doRong(d, k))) + 1.5);
    min[j] = Math.max(min[j], Math.max(0, ...t.split(/\s+/).map((w) => doRong(w, k))) + 1.5);
  }));
  for (let j = 0; j < n; j++) { if (codinh[j] != null) { nat[j] = min[j] = codinh[j]; } if (tran[j]) nat[j] = Math.min(nat[j], tran[j]); min[j] = Math.min(min[j], nat[j]); }
  // pdfmake: bề rộng cột KHÔNG gồm lề trong ô và nét kẻ → trừ khỏi bề rộng trang
  const rong0 = usable - n * padX * 2 - (n + 1) * 0.5 - 1;
  const sN = nat.reduce((a, b) => a + b, 0), sM = min.reduce((a, b) => a + b, 0);
  const co_gian = (j) => codinh[j] == null;
  let widths;
  if (sN <= rong0) { // đủ chỗ: mỗi cột vừa chữ, thừa chia theo tỉ lệ cho các cột chữ
    const du = rong0 - sN, tc = nat.reduce((a, v, j) => a + (co_gian(j) ? v : 0), 0) || 1;
    widths = nat.map((v, j) => (co_gian(j) ? v + (du * v) / tc : v));
  } else if (sM >= rong0) { // quá chật: thu đều các cột chữ
    const k = rong0 / sM; widths = min.map((v) => v * k);
  } else { // từ nhỏ nhất, phần còn lại chia theo mức "muốn giãn" (nat − min)
    const du = rong0 - sM, w = nat.map((v, j) => (co_gian(j) ? v - min[j] : 0)), tw = w.reduce((a, b) => a + b, 0) || 1;
    widths = min.map((v, j) => v + (du * w[j]) / tw);
  }
  // Đệm phía trên: dòng cao = ô nhiều dòng nhất; ô ít dòng hơn lùi xuống nửa phần chênh
  const kq = rows.map((r, i) => {
    const soD = r.map((c, j) => {
      if ((c.rowSpan || 1) > 1) return null;
      if (laOGop(c)) return 0; // ô bị gộp
      const t = laChu(c);
      if (t == null) return null;
      const w = widths.slice(j, j + (c.colSpan || 1)).reduce((a, b) => a + b, 0) + ((c.colSpan || 1) - 1) * (padX * 2 + 0.5);
      return soDong(t, Math.max(10, w), kieu(c));
    });
    const tren = Math.max(1, ...soD.map((x) => x || 0));
    return r.map((c, j) => {
      const d = soD[j];
      if (d == null || d === 0 || d >= tren) return c;
      const m = c.margin || [0, 0, 0, 0], them = ((tren - d) * lh) / 2;
      return { ...c, margin: [m[0], m[1] + them, m[2], m[3]] };
    });
  });
  return { widths, body: kq };
}
