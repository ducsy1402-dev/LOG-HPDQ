// Đọc file "Danh mục.xlsx" (thư mục "File danh mục - bàn giao - hướng dẫn" hoặc thư mục gốc C:\WEB-QLTB) và sinh:
//   1. src/data/danhMuc.json  – dữ liệu cho chế độ demo (bến, cẩu, hàng hóa, kho bãi)
//   2. ../sql/02_nap_danh_muc.sql – nạp vào Supabase (chạy sau sql/01)
// Chạy: npm run danh-muc   (sau khi sửa file Excel)
// Sheet: "Danh mục bến", "Danh mục cẩu", "Danh mục hàng hóa", "Danh mục kho bãi".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { BERTHS, CRANES } from "../src/data/danhMucGoc.js";

XLSX.set_fs(fs);
const __dir = path.dirname(fileURLToPath(import.meta.url));
const CO = [path.resolve(__dir, "../Danh mục.xlsx"), path.resolve(__dir, "../docs/Danh mục.xlsx")];
const FILE = process.argv[2] || CO.find((f) => fs.existsSync(f)) || CO[0];
const wb = XLSX.readFile(FILE);
const sheet = (ten) => {
  const ws = wb.Sheets[wb.SheetNames.find((n) => n.trim().toLowerCase() === ten.toLowerCase())];
  if (!ws) throw new Error(`Không thấy sheet "${ten}" trong ${FILE}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }).slice(1).filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
};
const str = (x) => (x == null || String(x).trim() === "" ? null : String(x).trim().replace(/\s+/g, " "));
const num = (x) => { if (x == null || x === "") return null; if (typeof x === "number") return x; const n = Number(String(x).replace(/[^\d.,-]/g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const plain = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase().replace(/\s+/g, "");

// ---------- Bến ----------
// "Bến 1A" -> 1A, "Bến 2-HH" -> HH2, "Bến 6-CTH" -> 6CTH; mớn "<=18.5" -> 18.5 và là giới hạn cứng
const maBen = (ten) => {
  const t = String(ten).replace(/^bến\s*/i, "").trim();
  const hh = /^(\d+)\s*-\s*HH$/i.exec(t);
  if (hh) return "HH" + hh[1];
  return t.replace(/\s*-\s*/g, "").toUpperCase();
};
const berths = sheet("Danh mục bến").map((r, i) => {
  const ma = maBen(r[0]), goc = BERTHS.find((b) => b.ma === ma);
  const monStr = String(r[2] ?? "");
  return {
    ma, ten_khac: [...new Set([...(goc?.ten_khac || []), str(r[0])].filter(Boolean))],
    dwt_max: num(r[1]), mon_max: num(r[2]), mon_cung: /<=|≤/.test(monStr) || !!goc?.mon_cung, loa_max: num(r[3]),
    loai_hang: goc?.loai_hang || null, thu_tu: i + 1, ghi_chu: str(r[4]),
  };
});

// ---------- Cẩu (thành xe đội "Cẩu" trong danh mục thiết bị cơ giới) ----------
// Cột: loại cẩu | tên cẩu | tải trọng (tấn) | tầm với | năng suất (t/h) | phạm vi di chuyển | băng tải làm hàng | ghi chú
// Tên trùng nhiều dòng (cẩu xích) là biểu đồ tải: gộp thành một cẩu. Một số dòng trong file bị lệch cột năng suất / phạm vi: tự đổi lại.
const maCau = (ten) => str(ten).replace(/^(QC|SC|SHC)\s+(?=\d|HH)/i, (m, a) => a.toUpperCase()).replace(/^SLD\s+bến/i, "SLD bến");
const loaiCau = (l, ten) => (/^SLD/i.test(l || "") || /^SLD/i.test(ten) ? "Ship loader (SLD)" : str(l));
const nangSuatTxt = (x) => (x == null ? null : String(x).replace(/\s*t\/h$/i, "").trim());
const gomCau = new Map();
for (const r of sheet("Danh mục cẩu")) {
  const ma = maCau(r[1] || r[0]);
  let ns = r[4], pv = r[5];
  if (typeof ns === "string" && /m$/i.test(ns.trim()) && (pv == null || /t\/h/i.test(String(pv)))) [ns, pv] = [pv, ns];
  const g = gomCau.get(ma) || { ma, loai: loaiCau(r[0], ma), tai: [], tam: [], ns: null, pv: null, bt: null, gc: [] };
  if (r[2] != null) g.tai.push(r[2]);
  if (r[3] != null) g.tam.push(r[3]);
  g.ns ??= nangSuatTxt(ns); g.pv ??= str(pv); g.bt ??= str(r[6]);
  if (str(r[7])) g.gc.push(str(r[7]));
  gomCau.set(ma, g);
}
// Số cẩu cùng tên (file chỉ ghi biểu đồ tải một lần): tách thành nhiều cẩu đánh số #1, #2… cùng thông số
const SO_CAU = { "Cẩu xích 260T": 2 };
const benCua = (ma) => CRANES.find((c) => plain(c.ma) === plain(ma) || plain(c.ma).replace(/#\d+$/, "") === plain(ma))?.ben_ma || [];
const cranes = [...gomCau.values()].flatMap((g) => (SO_CAU[g.ma] > 1 ? Array.from({ length: SO_CAU[g.ma] }, (_, k) => ({ ...g, ma: `${g.ma} #${k + 1}` })) : [g])).map((g, i) => ({
  ma: g.ma, doi: "Cẩu", model: g.loai, to_xe: null, che_do: "Đi ca",
  ben_phuc_vu: benCua(g.ma),
  tai_nang: g.tai.length ? g.tai.join(" / ") + " T" : null,
  tam_voi: g.tam.length ? g.tam.join(" / ") + " m" : null,
  nang_suat: g.ns, pham_vi: g.pv, bang_tai: g.bt,
  ghi_chu: [g.tai.length > 1 ? "Biểu đồ tải: " + g.tai.map((t, j) => `${t}T tầm ${g.tam[j] ?? "?"}m`).join(", ") : null, ...g.gc].filter(Boolean).join(". ") || null,
  thu_tu: i + 1,
}));

// ---------- Hàng hóa (thay hẳn danh sách cũ) ----------
const hangMap = new Map();
for (const r of sheet("Danh mục hàng hóa")) { const ten = str(r[0]); if (ten) hangMap.set(ten, { loai_hang: ten, nhom: str(r[1]), ti_trong: num(r[2]), ghi_chu: str(r[9]) }); }
const hanghoa = [...hangMap.values()];

// ---------- Kho bãi (mỗi dòng: một bãi – một loại hàng) ----------
const khoBai = sheet("Danh mục kho bãi").map((r, i) => ({ id: i + 1, ten_bai: str(r[0]), dien_tich: num(r[1]), hang: str(r[2]), thiet_bi: str(r[3]), ghi_chu: str(r[4]) })).filter((r) => r.ten_bai);

fs.writeFileSync(path.resolve(__dir, "../src/data/danhMuc.json"), JSON.stringify({ berths, cranes, hanghoa, khoBai }, null, 1));

// ---------- SQL ----------
const q = (v) => (v == null ? "null" : typeof v === "number" ? String(v) : typeof v === "boolean" ? String(v) : Array.isArray(v) ? `'{${v.map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(",")}}'` : `'${String(v).replace(/'/g, "''")}'`);
const dong = (cols, rows) => rows.map((r) => `  (${cols.map((c) => q(r[c])).join(", ")})`).join(",\n");
const cB = ["ma", "ten_khac", "dwt_max", "mon_max", "mon_cung", "loa_max", "loai_hang", "thu_tu", "ghi_chu"];
const cC = ["ma", "doi", "model", "che_do", "ben_phuc_vu", "tai_nang", "tam_voi", "nang_suat", "pham_vi", "bang_tai", "ghi_chu"];
const cH = ["loai_hang", "nhom", "ti_trong", "ghi_chu"];
const cK = ["ten_bai", "dien_tich", "hang", "thiet_bi", "ghi_chu"];
const sql = `-- =====================================================================
-- BƯỚC 2: NẠP DANH MỤC DÙNG CHUNG TỪ FILE "Danh mục.xlsx" (chạy SAU 01_cau_truc.sql)
-- File này do máy sinh ra (scripts/danh-muc.mjs, lệnh: npm run danh-muc). Không sửa tay.
-- Sinh lúc ${new Date().toLocaleString("vi-VN")} từ ${path.basename(FILE)}.
--   A. ${berths.length} cầu bến: thêm mới hoặc cập nhật trọng tải, mớn, chiều dài theo file (mớn ghi <= là giới hạn cứng).
--   B. ${cranes.length} cẩu thành xe đội "Cẩu" trong danh mục thiết bị cơ giới (theo dõi hỏng / bảo dưỡng như xe).
--      Có rồi thì chỉ cập nhật loại, bến phục vụ và thông số kỹ thuật; không đổi tổ, chế độ, ghi chú đã sửa trên web.
--   C. Hàng hóa: XÓA danh sách cũ, thay bằng ${hanghoa.length} loại trong file (đã thống nhất thay hẳn).
--   D. Kho bãi: nạp ${khoBai.length} dòng (bãi – loại hàng) CHỈ KHI bảng đang trống (không ghi đè dữ liệu đã nhập trên web).
-- Chạy lại: A, B cập nhật lại theo file; C thay lại toàn bộ hàng hóa theo file; D bỏ qua nếu đã có dữ liệu.
-- =====================================================================

-- A. Cầu bến
insert into public.berths (${cB.join(", ")}) values
${dong(cB, berths)}
on conflict (ma) do update set ten_khac = excluded.ten_khac, dwt_max = excluded.dwt_max, mon_max = excluded.mon_max,
  mon_cung = excluded.mon_cung, loa_max = excluded.loa_max, updated_at = now();

-- B. Cẩu -> đội "Cẩu" trong danh mục thiết bị cơ giới
update public.danh_muc set data = jsonb_set(data, '{doi}', (data->'doi') || '["Cẩu"]'::jsonb), updated_at = now()
where id = 'meta' and jsonb_typeof(data->'doi') = 'array' and not (data->'doi') ? 'Cẩu';
insert into public.vehicles (${cC.join(", ")}) values
${dong(cC, cranes)}
on conflict (ma) do update set doi = excluded.doi, model = excluded.model, ben_phuc_vu = excluded.ben_phuc_vu, tai_nang = excluded.tai_nang,
  tam_voi = excluded.tam_voi, nang_suat = excluded.nang_suat, pham_vi = excluded.pham_vi, bang_tai = excluded.bang_tai;

-- C. Hàng hóa: thay hẳn bằng danh sách trong file
delete from public.hang_hoa;
insert into public.hang_hoa (${cH.join(", ")}) values
${dong(cH, hanghoa)};

-- D. Kho bãi: chỉ nạp khi bảng trống
insert into public.kho_bai (${cK.join(", ")})
select * from (values
${dong(cK, khoBai)}
) as t(${cK.join(", ")})
where not exists (select 1 from public.kho_bai);

-- Kiểm tra
select 'berths' as bang, count(*) from public.berths
union all select 'vehicles (Cẩu)', count(*) from public.vehicles where doi = 'Cẩu'
union all select 'hang_hoa', count(*) from public.hang_hoa
union all select 'kho_bai', count(*) from public.kho_bai;
`;
fs.writeFileSync(path.resolve(__dir, "../sql/02_nap_danh_muc.sql"), sql);
console.log(`Bến ${berths.length} · cẩu ${cranes.length} · hàng hóa ${hanghoa.length} · kho bãi ${khoBai.length}`);
for (const c of cranes.filter((c) => !c.ben_phuc_vu.length)) console.log("  Cẩu chưa rõ bến:", c.ma);
