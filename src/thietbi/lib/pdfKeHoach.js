// PDF Kế hoạch ngày (Thiết bị cơ giới › Kế hoạch ngày): Trình ký (mẫu BM.07D/HD.05.02), theo Tổ, theo Bộ phận sử dụng. Anh Sỹ 22/11/2026.
// Trước đây in qua hộp thoại in của trình duyệt (@page A4 ngang): chọn máy in ảo như "Microsoft Print to PDF" thì file ra là trang DỌC có nội dung xoay ngang 90°.
// Nay web tự dựng PDF bằng pdfmake, khổ A4 NGANG ghi thẳng trong file nên mở ở máy nào cũng đúng chiều; cùng dữ liệu (duLieuTrinhKy / duLieuTheoTo / duLieuTheoBP) với Excel.
import { duLieuTrinhKy, duLieuTheoTo, duLieuTheoBP, COT_KY, COT_TO } from "./plan";
import { taiPdfMake } from "@/lib/bieuMauPA";
import { logoDataUrl } from "@/lib/keHoachCang";

const p2 = (n) => String(n).padStart(2, "0");
const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`; };
const A4_NGANG = { pageSize: "A4", pageOrientation: "landscape", pageMargins: [28, 26, 28, 30], defaultStyle: { font: "Roboto", fontSize: 8 } };
const VIEN = { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#000", vLineColor: () => "#000", paddingLeft: () => 2.5, paddingRight: () => 2.5, paddingTop: () => 1.5, paddingBottom: () => 1.5 };
// Số và chữ như bản in cũ: khối lượng có dấu ngăn nghìn; cột SĐT tách các số bằng khoảng trắng để tự xuống hàng giữa các số
const oChu = (v, i, kl, sdt) => {
  if (typeof v === "number" && i === kl) return v.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  const s = String(v ?? "");
  return i === sdt ? s.replace(/\s*[,;/]\s*|\s+/g, " ").trim() : s;
};
const tieuDeCot = (cot) => cot.map((c) => ({ text: c.replace(/^(T\.gian|Loại|Đơn vị|Số) /, "$1\n"), bold: true, alignment: "center", fontSize: 7.5 }));
const rongTheo = (chars, tong = 770) => { const t = chars.reduce((a, b) => a + b, 0); return chars.map((c) => (c * tong) / t); };

// Mẫu trình ký: logo + mã biểu mẫu, tiêu đề, bảng 13 cột chia theo ca, tổng, ngày ký và ba chữ ký
function docTrinhKy(x, logo) {
  const { cas, total } = duLieuTrinhKy(x);
  const d0 = new Date(cas[0].start);
  const TRAI = [2, 3, 4], N = COT_KY.length;
  const body = [tieuDeCot(COT_KY)];
  for (const ca of cas) {
    const nen = "#f2f2f2";
    body.push([{ text: "", fillColor: nen }, { text: ca.label, bold: true, colSpan: N - 1, fillColor: nen }, ...Array(N - 2).fill({})]);
    for (const r of ca.dong) body.push(r.map((v, i) => ({ text: oChu(v, i, 5, -1), alignment: TRAI.includes(i) ? "left" : "center" })));
  }
  const tong = Array(N).fill("").map((_, i) => ({ text: i === 1 ? "Tổng" : i === 10 ? String(total) : "", bold: true, alignment: "center", fillColor: "#f2f2f2" }));
  body.push(tong);
  const doc = {
    ...A4_NGANG,
    content: [
      { columns: [logo ? { image: logo, fit: [150, 42] } : { text: "" }, { text: "BM.07D/HD.05.02\nNgày hiệu lực: 25/09/2025\nLần sửa đổi: 00", alignment: "right", fontSize: 9, lineHeight: 1.2 }] },
      { text: "KẾ HOẠCH KHAI THÁC LOGISTICS SẢN XUẤT NGÀY", bold: true, fontSize: 14, alignment: "center", margin: [0, 6, 0, 8] },
      { table: { headerRows: 1, widths: rongTheo([5, 11, 42, 22, 22, 10, 7, 9, 9, 14, 8, 22, 14]), body, dontBreakRows: true }, layout: VIEN },
      { unbreakable: true, stack: [
        { text: `Quảng Ngãi, ngày ${d0.getDate()} tháng ${d0.getMonth() + 1} năm ${d0.getFullYear()}`, italics: true, alignment: "right", margin: [0, 10, 0, 6] },
        { columns: [["TP/BP", "[03]"], ["Phụ trách", "[02]"], ["Người lập", "[01]"]].map(([ten, ma]) => ({ stack: [{ text: ten, bold: true, alignment: "center" }, { text: ma, alignment: "center", margin: [0, 2, 0, 60] }] })) },
      ] },
    ],
    footer: (cur, tongTrang) => ({ text: `${cur}/${tongTrang}`, alignment: "center", fontSize: 7.5, margin: [0, 6, 0, 0] }),
  };
  return { doc, ten: `Ke_hoach_trinh_ky_${ymd(cas[0].start)}` };
}

// Mẫu theo nhóm (tổ / bộ phận sử dụng): mỗi ca một trang, mỗi nhóm một dải tiêu đề
function docNhom(cas, tieuDe, tenFile) {
  const TRAI = [3, 4, 5, 11], N = COT_TO.length, SDT = 10;
  const content = [];
  cas.forEach((ca, i) => {
    const body = [tieuDeCot(COT_TO)];
    for (const t of ca.to) {
      body.push([{ text: t.ten, bold: true, colSpan: N, fillColor: "#dde7f3" }, ...Array(N - 1).fill({})]);
      for (const r of t.dong) body.push(r.map((v, j) => ({ text: oChu(v, j, 6, SDT), alignment: TRAI.includes(j) ? "left" : "center" })));
    }
    content.push({ text: tieuDe, bold: true, fontSize: 14, alignment: "center", margin: [0, 0, 0, 3], ...(i ? { pageBreak: "before" } : {}) });
    content.push({ text: ca.tieuDe, italics: true, alignment: "center", margin: [0, 0, 0, 6] });
    content.push({ table: { headerRows: 1, widths: rongTheo([5, 18, 12, 42, 22, 22, 10, 7, 8, 8, 12, 22]), body, dontBreakRows: true }, layout: VIEN });
  });
  return { doc: { ...A4_NGANG, content, footer: (cur, tongTrang) => ({ text: `${cur}/${tongTrang}`, alignment: "center", fontSize: 7.5, margin: [0, 6, 0, 0] }) }, ten: `${tenFile}_${ymd(cas[0].start)}` };
}

export const MAU_PDF_KE_HOACH = [["ky", "Trình ký"], ["to", "Theo tổ"], ["bp", "Theo bộ phận sử dụng"]];
// x = { asgs, demOf, shOf, D }; kind: ky | to | bp. Trả { doc, ten }
export function dungPdfKeHoach(kind, x, logo) {
  if (kind === "bp") return docNhom(duLieuTheoBP(x), "KẾ HOẠCH PHƯƠNG TIỆN THEO BỘ PHẬN SỬ DỤNG", "Ke_hoach_theo_BPSD");
  if (kind === "to") return docNhom(duLieuTheoTo(x), "KẾ HOẠCH PHƯƠNG TIỆN THEO TỔ", "Ke_hoach_theo_to");
  return docTrinhKy(x, logo);
}
export const tenFilePdfKeHoach = (kind, x) => `${dungPdfKeHoach(kind, x, null).ten}.pdf`;
export async function blobPdfKeHoach(kind, x, logo) {
  const [pdfMake, anh] = await Promise.all([taiPdfMake(), kind === "ky" ? logoDataUrl(logo) : null]);
  return new Promise((xong, loi) => { try { pdfMake.createPdf(dungPdfKeHoach(kind, x, anh).doc).getBlob(xong); } catch (e) { loi(e); } });
}
