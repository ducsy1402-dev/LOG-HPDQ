// Báo cáo PDF (pdfmake, font Roboto có đủ dấu tiếng Việt). Thư viện được tải khi bấm nút.
import { diffDays, vn, pct, pad } from "./utils";
import { chenhLabel } from "./compute";

const C = { ink: "#0f172a", mute: "#64748b", line: "#e2e8f0", head: "#0e7490", headBg: "#ecfeff", ok: "#059669", warn: "#d97706", bad: "#e11d48", info: "#2563eb", zebra: "#f8fafc" };

async function loadPdfMake() {
  const [{ default: pdfMake }, fonts] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
  const vfs = fonts.default?.pdfMake?.vfs || fonts.pdfMake?.vfs || fonts.default || fonts.vfs;
  pdfMake.vfs = vfs;
  return pdfMake;
}

const th = (t, align = "left") => ({ text: t, style: "th", alignment: align });
const n = (v, color) => ({ text: v == null ? "–" : String(v), alignment: "right", color });
const rateColor = (r, T) => (!Number.isFinite(r) ? C.mute : r < T.red ? C.bad : r < T.ss ? C.warn : C.ok);

// Thanh tỷ lệ nhỏ trong ô bảng
const bar = (r, T, w = 70) => ({
  stack: [
    { canvas: [
      { type: "rect", x: 0, y: 0, w, h: 5, r: 2, color: "#e2e8f0" },
      { type: "rect", x: 0, y: 0, w: Math.max(0.5, w * (Number.isFinite(r) ? r : 0)), h: 5, r: 2, color: rateColor(r, T) },
    ] },
  ], margin: [0, 4, 0, 0],
});

const table = (widths, head, body, opts = {}) => ({
  table: { headerRows: 1, widths, body: [head, ...body], dontBreakRows: true },
  layout: {
    hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.4),
    vLineWidth: () => 0,
    hLineColor: (i) => (i <= 1 ? C.head : C.line),
    fillColor: (i) => (i === 0 ? C.headBg : opts.totalLast && i === body.length ? "#f1f5f9" : i % 2 === 0 ? C.zebra : null),
    paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 3.5, paddingBottom: () => 3.5,
  },
  margin: [0, 0, 0, 12],
});

export async function exportPdf(D, who, action = "download") {
  const pdfMake = await loadPdfMake();
  const T = D.T, now = new Date();
  const all = D.summarize(D.vehicles);
  const open = D.open;
  const lau = open.filter((e) => D.flags(e).some((f) => f.k === "lau")).length;
  const qh = open.filter((e) => D.flags(e).some((f) => f.k === "qh")).length;
  const pt = open.filter((e) => e.phu_tung === "Chờ phụ tùng").length;

  // 1. Thẻ tổng quan
  const tile = (label, value, color = C.ink, sub) => ({
    stack: [{ text: label, fontSize: 7.5, color: C.mute }, { text: String(value), fontSize: 17, bold: true, color, margin: [0, 2, 0, 0] }, sub ? { text: sub, fontSize: 7, color: C.mute } : ""],
    margin: [6, 6, 6, 6],
  });
  const tiles = {
    table: { widths: Array(6).fill("*"), body: [[
      tile("Tổng số xe", all.tong),
      tile("Sẵn sàng", all.ready, C.ok, `gồm ${all.bddk} xe BD định kỳ`),
      tile("Tỷ lệ sẵn sàng", pct(all.rate, 1), rateColor(all.rate, T), `mục tiêu ${pct(T.ss)}`),
      tile("Hỏng", all.hong, C.bad),
      tile("BD chiến lược", all.bdcl, C.warn),
      tile("Nhân sự", D.staffActive.length, C.ink, `định biên ${all.dinhBien}`),
    ]] },
    layout: { hLineColor: () => C.line, vLineColor: () => C.line, hLineWidth: () => 0.6, vLineWidth: () => 0.6 },
    margin: [0, 0, 0, 6],
  };
  const alerts = [
    lau && `${lau} xe hỏng quá ${T.lau} ngày`, qh && `${qh} sự kiện quá hạn dự kiến`, pt && `${pt} sự kiện chờ phụ tùng`,
  ].filter(Boolean);

  // 2. Theo đội
  const doiRows = D.groupSummary(D.vehicles, "doi");
  const sumBody = (rows, first) => rows.map((r) => [
    first(r), n(r.tong), n(r.ready, C.ok), n(r.hong || "", C.bad), n(r.bdcl || "", C.warn), n(r.bddk || "", C.info),
    { text: pct(r.rate, 1), alignment: "right", bold: true, color: rateColor(r.rate, T) }, bar(r.rate, T), n(r.nhanSu), n(r.dinhBien),
  ]);
  const sumHead = (l) => [th(l), th("Tổng", "right"), th("Sẵn sàng", "right"), th("Hỏng", "right"), th("BDCL", "right"), th("BDĐK*", "right"), th("Tỷ lệ", "right"), th(""), th("Nhân sự", "right"), th("Định biên", "right")];
  const sumW = ["*", 30, 40, 30, 30, 34, 38, 72, 38, 42];
  const doiBody = sumBody(doiRows, (r) => ({ text: r.k, bold: true }));
  doiBody.push(...sumBody([{ ...all, k: "Tổng cộng", nhanSu: D.staffActive.length }], () => ({ text: "Tổng cộng", bold: true })));

  // 3. Theo tổ
  const toBody = [];
  for (const doi of D.doiList) {
    const vs = D.vehicles.filter((v) => v.doi === doi);
    if (!vs.length) continue;
    toBody.push(...sumBody(D.groupSummary(vs, "to_xe", (s) => s.doi === doi), (r) => ({ text: [{ text: doi + " · ", color: C.mute }, r.k] })));
  }

  // 4. Xe đang hỏng / bảo dưỡng
  const evBody = [...open].sort((a, b) => (a.loai === "BD định kỳ") - (b.loai === "BD định kỳ") || a.ngay_vao.localeCompare(b.ngay_vao)).map((e) => {
    const v = D.vmap[e.ma_xe] || {};
    const col = e.loai === "Hỏng" ? C.bad : e.loai === "BD chiến lược" ? C.warn : C.info;
    return [
      { text: e.ma_xe, bold: true }, { text: (v.to_xe || "").replace(/^Tổ\s+/, ""), color: C.mute }, { text: e.loai, color: col, bold: true },
      { text: [e.nhom, e.mo_ta].filter(Boolean).join(" – "), fontSize: 7.5 }, vn(e.ngay_vao), n(diffDays(e.ngay_vao, D.today)), vn(e.ngay_du_kien),
      { text: e.phu_tung || "", fontSize: 7.5 }, { text: D.flags(e).map((f) => f.label).join("\n"), color: C.bad, fontSize: 7.5 },
    ];
  });

  // 5. Quân số các ca tới
  const shifts = D.upcomingShifts();
  const qsBody = [];
  const warn = [];
  for (const sh of shifts) for (const r of D.shiftRows(sh)) {
    const tone = r.chenh == null ? C.mute : r.chenh < 0 ? C.bad : r.chenh > 0 ? C.info : C.ok;
    qsBody.push([`${vn(sh.ngay)}`, sh.ca, { text: r.kip || "chưa chọn", color: r.kip ? C.ink : C.warn }, r.doi, n(r.dinhBien), n(r.thucTe), n(r.xeCan), { text: chenhLabel(r.chenh), bold: true, color: tone }, { text: r.ghiChu, fontSize: 7.5 }]);
    if (r.chenh != null && r.chenh < 0) warn.push(`${sh.ca} ${vn(sh.ngay)} – ${r.doi}: thiếu ${-r.chenh} người (có ${r.thucTe}, cần ${r.xeCan})`);
  }

  const stamp = `${pad(now.getHours())}:${pad(now.getMinutes())} ${vn(D.today)}`;
  const doc = {
    pageSize: "A4", pageOrientation: "landscape", pageMargins: [28, 54, 28, 36],
    defaultStyle: { font: "Roboto", fontSize: 8.5, color: C.ink, lineHeight: 1.15 },
    styles: {
      th: { bold: true, fontSize: 7.5, color: C.head },
      h2: { fontSize: 11, bold: true, color: C.head, margin: [0, 6, 0, 6] },
      note: { fontSize: 7.5, color: C.mute, italics: true },
    },
    header: (page) => ({
      margin: [28, 18, 28, 0],
      columns: [
        { stack: [{ text: "BÁO CÁO TÌNH TRẠNG THIẾT BỊ", bold: true, fontSize: 13, color: C.head }, { text: `Ngày ${vn(D.today)} · xuất lúc ${stamp}${who ? " · " + who : ""}`, fontSize: 8, color: C.mute }] },
        { text: page === 1 ? "" : "Tình trạng thiết bị", alignment: "right", color: C.mute, fontSize: 8, margin: [0, 6, 0, 0] },
      ],
    }),
    footer: (cur, total) => ({ margin: [28, 8, 28, 0], columns: [{ text: "Hệ thống quản lý thiết bị", color: C.mute, fontSize: 7.5 }, { text: `Trang ${cur}/${total}`, alignment: "right", color: C.mute, fontSize: 7.5 }] }),
    content: [
      tiles,
      alerts.length ? { text: "Cảnh báo: " + alerts.join(" · "), color: C.bad, bold: true, fontSize: 8.5, margin: [0, 2, 0, 4] } : "",
      { text: "* BDĐK: xe đang bảo dưỡng định kỳ, vẫn tính là sẵn sàng. Xe sẵn sàng = không hỏng, không BD chiến lược.", style: "note", margin: [0, 0, 0, 6] },
      { text: "1. Tình trạng theo đội xe", style: "h2" },
      table(sumW, sumHead("Đội xe"), doiBody, { totalLast: true }),
      { text: "2. Tình trạng theo tổ", style: "h2" },
      table(sumW, sumHead("Đội · Tổ"), toBody),
      { text: `3. Xe đang hỏng / bảo dưỡng (${open.length})`, style: "h2", pageBreak: toBody.length > 8 ? "before" : undefined },
      evBody.length ? table([46, 64, 56, "*", 46, 30, 50, 56, 80], [th("Mã xe"), th("Tổ"), th("Loại"), th("Nhóm – Mô tả"), th("Ngày vào"), th("Số ngày", "right"), th("Dự kiến"), th("Phụ tùng"), th("Cảnh báo")], evBody)
        : { text: "Không có xe nào đang hỏng hoặc bảo dưỡng.", color: C.mute, margin: [0, 0, 0, 12] },
      { text: "4. Quân số các ca tới so với xe sẵn sàng", style: "h2" },
      warn.length ? { ul: warn, color: C.bad, margin: [0, 0, 0, 6] } : { text: "Không có ca nào thiếu người (trong các ca đã nhập).", color: C.ok, margin: [0, 0, 0, 6] },
      table([50, 86, 40, 60, 50, 44, 60, 56, "*"], [th("Ngày"), th("Ca"), th("Kíp"), th("Đội"), th("Định biên", "right"), th("Thực tế", "right"), th("Xe SS cần", "right"), th("Đánh giá"), th("Ghi chú")], qsBody),
      { text: "Định biên kíp = nhân sự đang làm việc thuộc kíp đi ca đó. Xe SS cần = xe sẵn sàng thuộc chế độ của ca (Đi ca: CA 1 ngày, CA 2 đêm; HC: CA HC), mỗi xe 1 người.", style: "note" },
    ],
  };
  const pdf = pdfMake.createPdf(doc);
  if (action === "blob") return new Promise((res) => pdf.getBlob(res));
  pdf.download(`Bao_cao_thiet_bi_${D.today}.pdf`);
}
