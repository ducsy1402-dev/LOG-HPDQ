// Đọc file "Danh_muc_tong_hop.xlsx" (thư mục gốc kho) và sinh:
//   1. src/data/danhMuc.json  – dữ liệu cho chế độ demo (bến, cẩu, xe, hàng hóa, kho bãi, các bảng danh mục phụ)
//   2. src/data/dmBang.json   – cấu hình cột của các bảng danh mục phụ (thông số, định mức, thiết bị gắn, khai báo kho / bãi)
//   3. sql/08_danh_muc_tong_hop.sql – nạp vào Supabase (thay toàn bộ danh mục cũ)
// Chạy: npm run danh-muc   (sau khi sửa file Excel)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { BERTHS, MA_BEN_CU, VI_TRI_MAC_DINH } from "../src/data/danhMucGoc.js";

XLSX.set_fs(fs);
const __dir = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2] || path.resolve(__dir, "../Danh_muc_tong_hop.xlsx");
const wb = XLSX.readFile(FILE);
const tenSheet = (ten) => wb.SheetNames.find((n) => n.trim().toLowerCase() === ten.toLowerCase());
const aoa = (ten) => {
  const n = tenSheet(ten);
  if (!n) throw new Error(`Không thấy sheet "${ten}" trong ${FILE}`);
  return XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
};
const sheet = (ten) => aoa(ten).slice(1).filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
const str = (x) => (x == null || String(x).trim() === "" ? null : String(x).trim().replace(/\s+/g, " "));
const num = (x) => { if (x == null || x === "") return null; if (typeof x === "number") return x; const n = Number(String(x).replace(/[^\d.,-]/g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const plain = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
const khong = (x) => (/^khong co$/.test(plain(x)) ? null : str(x));
const canhBao = [];

// ---------- Cầu bến: TL, B01…B11, HH2, HH3, 6CTH, 7CTH ----------
// Mã cầu bến theo file; tên khác giữ mã cũ (1A, 1…11) để dán / nhập Excel kiểu cũ vẫn nhận. Mớn cứng và tuyến / mét theo bố trí đã chốt.
const maBen = (x) => { const t = String(x ?? "").trim().toUpperCase().replace(/\s+/g, ""); return t === "B1A" || t === "BTL" || t === "1A" ? "TL" : /^B(6|7)CTH$/.test(t) ? t.slice(1) : /^B\d$/.test(t) ? "B0" + t.slice(1) : t; };
const berths = sheet("danh sách bến").map((r, i) => {
  const ma = maBen(r[0]), goc = BERTHS.find((b) => b.ma === ma), vt = VI_TRI_MAC_DINH[ma];
  if (!goc) canhBao.push(`Bến ${ma} chưa có trong bố trí tuyến bến mặc định`);
  return {
    ma, ten_khac: goc?.ten_khac || [], dwt_max: num(r[1]), mon_max: num(r[2]), mon_cung: !!goc?.mon_cung, loa_max: num(r[3]),
    loai_hang: str(r[4]), thu_tu: i + 1, ghi_chu: null,
    tuyen: vt?.[0] ?? null, met_tu: vt?.[1] ?? null, met_den: vt?.[2] ?? null, goc_vuong: vt?.[3] ?? null,
  };
});
const coBen = new Set(berths.map((b) => b.ma));

// ---------- Cẩu cảng (xe đội "Cẩu" trong danh mục thiết bị cơ giới) ----------
// Tải trọng, tầm với lấy theo sheet thông số cẩu cảng (theo loại); năng suất = định mức cao nhất của loại cẩu (t/h).
const tsCau = new Map(sheet("thông số cẩu cảng").map((r) => [str(r[0]), { tai: num(r[1]), tam: num(r[2]) }]));
const dmCau = new Map();
for (const r of sheet("định mức cẩu cảng")) { const l = str(r[0]), v = num(r[2]); if (l && v != null) dmCau.set(l, Math.max(dmCau.get(l) || 0, v)); }
// Băng tải làm hàng của từng cẩu (theo tài liệu cũ; file mới chưa có cột này)
const BANG_TAI_CAU = { SC02: "#1, #2", QC10: "#1, #2, #5", QC11: "#1, #2, #5", QC06: "#1, #2, #5", QC07: "#1, #2, #5", QC08: "#1, #2, #5", SC05: "#3, #4", SC06: "#3, #4", SC07: "#3, #4",
  QC01: "#3, #4, #5", QC02: "#3, #4, #5", QC09: "#3, #4, #5", QC12: "#3, #4, #5", SC11: "#101, #201, #301", SC12: "#101, #201, #301", SC12A: "#101, #201, #301", SC08: "#101, #201", SC09: "#101, #201", SC10: "#101, #201" };
const cranes = sheet("danh sách cẩu cảng").map((r, i) => {
  const loai = str(r[1]), ts = tsCau.get(loai) || {}, ben = maBen(r[3]), ma = str(r[2]);
  if (!coBen.has(ben)) canhBao.push(`Cẩu ${ma}: bến "${r[3]}" không có trong danh sách bến`);
  return {
    ma, doi: "Cẩu", ten_loai: str(r[0]), model: loai, to_xe: null, che_do: "Đi ca", ben_phuc_vu: coBen.has(ben) ? [ben] : [],
    tai_nang: ts.tai ? `${ts.tai} T` : null, tam_voi: ts.tam ? `${ts.tam} m` : null, nang_suat: dmCau.get(loai) ? String(dmCau.get(loai)) : null,
    pham_vi: null, bang_tai: BANG_TAI_CAU[ma] || null, he_so: num(r[5]), xuong: null, ghi_chu: null, thu_tu: i + 1,
  };
});
// Băng tải của bến: gộp từ các cẩu phục vụ bến
for (const b of berths) b.bang_tai = [...new Set(cranes.filter((c) => c.ben_phuc_vu.includes(b.ma) && c.bang_tai).flatMap((c) => c.bang_tai.split(",").map((x) => x.trim())))].sort().join(", ") || null;

// ---------- Xe (danh sách xe tổng hợp) ----------
// Chế độ "Hành chính" lưu là HC. Xe nâng: tải trọng lấy từ model (VD "Xe nâng 3T …"). Cột Tình trạng không nạp (tình trạng tính theo sự kiện).
const TAI_NANG_XE = ["3T", "5T", "10T", "15T", "28T"];
const xe = sheet("danh sách xe tổng hợp").map((r) => {
  const doi = str(r[1]), model = str(r[2]), tt = /(\d+)\s*T\b/i.exec(model || "")?.[1];
  return {
    ma: str(r[0])?.toUpperCase(), doi, model, to_xe: str(r[3]), che_do: /hanh chinh|^hc$/.test(plain(r[4])) ? "HC" : "Đi ca",
    xuong: str(r[5]), he_so: num(r[6]), tai_trong: doi === "Xe nâng" && TAI_NANG_XE.includes(`${tt}T`) ? `${tt}T` : null, thiet_bi_gan: null, ghi_chu: null,
  };
}).filter((v) => v.ma && v.doi);
const doiXe = [...new Set(xe.map((v) => v.doi)), "Cẩu"];
const toXe = [...new Set(xe.map((v) => v.to_xe).filter(Boolean))];

// ---------- Hàng hóa: hàng rời (tỷ khối đống) và hàng thành phẩm / hàng kiện (đơn trọng) ----------
const hangMap = new Map();
for (const r of sheet("danh sách hàng rời")) { const ten = str(r[0]); if (ten) hangMap.set(ten, { loai_hang: ten, loai_hh: "roi", nhom: str(r[1]), don_vi: str(r[2]), ti_trong: num(r[3]), do_am: str(r[4]), don_trong: null, ghi_chu: null }); }
for (const r of sheet("danh sách hàng thành phẩm")) {
  const ten = str(r[0]); if (!ten) continue;
  if (hangMap.has(ten)) canhBao.push(`Hàng "${ten}" có ở cả hàng rời và hàng thành phẩm: lấy theo hàng thành phẩm`);
  hangMap.set(ten, { loai_hang: ten, loai_hh: "thanh_pham", nhom: str(r[1]), don_vi: str(r[2]), ti_trong: null, do_am: null, don_trong: num(r[3]), ghi_chu: str(r[4]) });
}
const hanghoa = [...hangMap.values()];

// ---------- Kho bãi ----------
// Khai báo kho / bãi lớn (diện tích, khu vực, loại Cố định / Tự do); mỗi dòng của hai sheet kho là một gian / lô (bãi nhỏ).
// Sức chứa khả dụng của file ghi vào "Sức chứa nhập tay" (web dùng số này thay công thức). Kiểu bãi theo loại kho / bãi đã khai báo.
const baiLon = sheet("khai báo thông tin kho-bãi").map((r) => ({ ten_bai: str(r[0]), dien_tich: num(r[1]), khu_vuc: str(r[2]), loai: str(r[3]) })).filter((r) => r.ten_bai);
const kieuCua = new Map(baiLon.map((b) => [plain(b.ten_bai).replace(/[^a-z0-9]/g, ""), /tu do/.test(plain(b.loai)) ? "tu_do" : /co dinh/.test(plain(b.loai)) ? "co_dinh_hang" : null]));
const khoaBai = (t) => plain(t).replace(/[^a-z0-9]/g, "");
const dongKho = (ten, loai_kho, cotCao) => sheet(ten).map((r) => {
  const ten_bai = str(r[0]);
  if (ten_bai && !kieuCua.has(khoaBai(ten_bai))) canhBao.push(`Kho / bãi "${ten_bai}" (${ten}) chưa có ở sheet khai báo thông tin kho-bãi`);
  return {
    ten_bai, ten_khu: str(r[1]), dien_tich: num(r[2]), [cotCao]: num(r[3]), hang: khong(r[4]), suc_chua_dn: num(r[5]), he_so_luu_chua: num(r[6]), suc_chua_tay: num(r[7]),
    thiet_bi: khong(r[8]), loai_kho, kieu_bai: kieuCua.get(khoaBai(ten_bai)) ?? null, nhom_bai: null, tieu_thu_ngay: null, ghi_chu: null,
  };
}).filter((r) => r.ten_bai);
const khoBai = [...dongKho("danh sách kho thành phẩm", "thanh_pham", "so_lop"), ...dongKho("danh sách kho nguyên liệu", "nguyen_lieu", "chieu_cao")].map((r, i) => ({ id: i + 1, ...r }));
for (const r of khoBai) if (r.hang && !hangMap.has(r.hang)) canhBao.push(`Kho "${r.ten_bai} › ${r.ten_khu}": hàng "${r.hang}" chưa có trong danh mục hàng hóa`);

// ---------- Bảng danh mục phụ (lưu ở bảng danh_muc_bang; cột lấy theo dòng tiêu đề của sheet) ----------
// nhom: tab chính (thiet_bi | hang | kho | ben); dòng trống tiêu đề thì bỏ cột
const BANG = [
  ["tb_gan", "Thiết bị gắn", "thiet_bi", "danh sách thiết bị gắn"],
  ["cau_ts", "Thông số cẩu cảng", "thiet_bi", "thông số cẩu cảng"],
  ["cau_dm", "Định mức cẩu cảng", "thiet_bi", "định mức cẩu cảng"],
  ["ts_xuc_dao", "Xe xúc đào", "ts_xe", "thông số xe xúc đào"],
  ["ts_xuc_lat", "Xe xúc lật", "ts_xe", "thông số xe xúc lật"],
  ["ts_xe_nang", "Xe nâng", "ts_xe", "thông số xe nâng"],
  ["ts_xe_ben", "Xe ben", "ts_xe", "thông số xe ben"],
  ["ts_dau_keo", "Xe đầu kéo", "ts_xe", "thông số xe đầu kéo"],
  ["ts_xe_bon", "Xe bồn bụi + bồn nước", "ts_xe", "thông số xe bồn bụi + bồn nước"],
  ["ts_hooklift", "Xe hooklift", "ts_xe", "Thông số xe hooklift"],
  ["bai_lon", "Khai báo kho / bãi", "kho", "khai báo thông tin kho-bãi"],
];
const slug = (t) => plain(t).replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "cot";
const dmBang = {}, bang = {};
for (const [key, ten, nhom, sh] of BANG) {
  const a = aoa(sh), tieuDe = a[0] || [], dong = a.slice(1).filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
  const cot = [], dung = new Set();
  tieuDe.forEach((t, j) => {
    const tt = str(t); if (!tt) return;
    let k = slug(tt); while (dung.has(k)) k += "_"; dung.add(k);
    const gt = dong.map((r) => r[j]).filter((x) => x != null && x !== "");
    cot.push([k, tt.replace(/\s*\n\s*/g, " "), gt.length && gt.every((x) => typeof x === "number") ? "so" : "text", j]);
  });
  dmBang[key] = { ten, nhom, sheet: sh, cot: cot.map(([k, t, l]) => [k, t, l]) };
  bang[key] = dong.map((r) => Object.fromEntries(cot.map(([k, , l, j]) => [k, l === "so" ? num(r[j]) : khong(r[j]) ?? (r[j] == null ? null : String(r[j]))])));
}

fs.writeFileSync(path.resolve(__dir, "../src/data/danhMuc.json"), JSON.stringify({ berths, cranes, xe, hanghoa, khoBai, bang }, null, 1));
fs.writeFileSync(path.resolve(__dir, "../src/data/dmBang.json"), JSON.stringify(dmBang, null, 1));

// ---------- SQL ----------
const q = (v) => (v == null ? "null" : typeof v === "number" ? String(v) : typeof v === "boolean" ? String(v) : Array.isArray(v) ? `'{${v.map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(",")}}'` : typeof v === "object" ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`);
const qj = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const dong = (cols, rows) => rows.map((r) => `  (${cols.map((c) => q(r[c])).join(", ")})`).join(",\n");
const cB = ["ma", "ten_khac", "dwt_max", "mon_max", "mon_cung", "loa_max", "loai_hang", "thu_tu", "ghi_chu", "bang_tai", "tuyen", "met_tu", "met_den", "goc_vuong"];
const cV = ["ma", "doi", "model", "to_xe", "che_do", "xuong", "he_so", "tai_trong", "ten_loai", "ben_phuc_vu", "tai_nang", "tam_voi", "nang_suat", "bang_tai"];
const cH = ["loai_hang", "loai_hh", "nhom", "don_vi", "ti_trong", "do_am", "don_trong", "ghi_chu"];
const cK = ["ten_bai", "ten_khu", "dien_tich", "so_lop", "chieu_cao", "hang", "suc_chua_dn", "he_so_luu_chua", "suc_chua_tay", "thiet_bi", "loai_kho", "kieu_bai"];
const xeVaCau = [...xe.map((v) => ({ ...v, ten_loai: null, ben_phuc_vu: [] })), ...cranes];
const dsBang = Object.entries(bang).flatMap(([b, rows]) => rows.map((data, i) => ({ bang: b, data, thu_tu: i + 1 })));
const doiMa = Object.entries(MA_BEN_CU);
const sql = `-- =====================================================================
-- 08. DANH MỤC TỔNG HỢP: thay toàn bộ danh mục cũ bằng file "Danh_muc_tong_hop.xlsx".
-- File này do máy sinh ra (scripts/danh-muc.mjs, lệnh: npm run danh-muc). Không sửa tay.
-- Sinh lúc ${new Date().toLocaleString("vi-VN")} từ ${path.basename(FILE)}. Chạy SAU 01…07. Chạy lại được (nạp lại theo file).
--   0. Cấu trúc: thêm cột cho xe / cẩu (xưởng, hệ số làm việc, tên thiết bị), hàng hóa (loại, đơn vị, độ ẩm, đơn trọng),
--      kho bãi (số lớp, sức chứa danh nghĩa, hệ số lưu chứa), cột tự thêm cho nhân sự; bảng danh_muc_bang cho các danh mục phụ.
--   A. Cầu bến: đổi mã 1A -> TL, 1…11 -> B01…B11 (chuyến tàu, khoảng dừng, cẩu đổi theo), nạp ${berths.length} bến kèm tuyến / mét.
--   B. Xe và cẩu: XÓA danh sách cũ, nạp ${xe.length} xe và ${cranes.length} cẩu cảng; cập nhật danh sách đội, tổ.
--   C. Hàng hóa: XÓA danh sách cũ, nạp ${hanghoa.filter((h) => h.loai_hh === "roi").length} hàng rời và ${hanghoa.filter((h) => h.loai_hh === "thanh_pham").length} hàng thành phẩm.
--   D. Kho bãi: XÓA danh sách cũ, nạp ${khoBai.length} gian / lô (thành phẩm, nguyên liệu).
--   E. Danh mục phụ: thiết bị gắn, thông số / định mức cẩu, thông số xe (7 loại), khai báo kho / bãi (${dsBang.length} dòng).
-- =====================================================================

-- 0. Cấu trúc
alter table public.vehicles add column if not exists xuong    text;     -- xưởng quản lý
alter table public.vehicles add column if not exists he_so    numeric;  -- hệ số làm việc
alter table public.vehicles add column if not exists ten_loai text;     -- cẩu: tên thiết bị (Cầu trục, Cẩu chân đế…)
alter table public.hang_hoa add column if not exists loai_hh   text;    -- roi | thanh_pham
alter table public.hang_hoa add column if not exists don_vi    text;    -- Tấn/m3, Tấn/cuộn…
alter table public.hang_hoa add column if not exists do_am     text;
alter table public.hang_hoa add column if not exists don_trong numeric; -- hàng thành phẩm: tấn / kiện
alter table public.kho_bai add column if not exists so_lop         numeric; -- kho thành phẩm: số lớp xếp khả dụng
alter table public.kho_bai add column if not exists suc_chua_dn    numeric; -- sức chứa danh nghĩa (tấn)
alter table public.kho_bai add column if not exists he_so_luu_chua numeric; -- hệ số lưu chứa
alter table public.staff add column if not exists them jsonb not null default '{}'; -- cột tự thêm của Nhân sự
-- Cột tự thêm (danh_muc_cot): quản trị Thiết bị cơ giới cũng thêm / sửa được (danh sách xe, nhân sự)
drop policy if exists danh_muc_cot_ghi on public.danh_muc_cot;
create policy danh_muc_cot_ghi on public.danh_muc_cot for all
  using (public.co_quyen('cang', array['quan_tri']) or public.co_quyen('kho', array['quan_tri']) or public.co_vai_tro(array['quan_tri']))
  with check (public.co_quyen('cang', array['quan_tri']) or public.co_quyen('kho', array['quan_tri']) or public.co_vai_tro(array['quan_tri']));

create table if not exists public.danh_muc_bang (
  id         bigint generated always as identity primary key,
  bang       text not null,                 -- ${Object.keys(dmBang).join(" | ")}
  data       jsonb not null default '{}',
  thu_tu     int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists danh_muc_bang_idx on public.danh_muc_bang (bang, thu_tu);
alter table public.danh_muc_bang enable row level security;
drop policy if exists danh_muc_bang_doc on public.danh_muc_bang;
drop policy if exists danh_muc_bang_ghi on public.danh_muc_bang;
create policy danh_muc_bang_doc on public.danh_muc_bang for select using (auth.uid() is not null);
create policy danh_muc_bang_ghi on public.danh_muc_bang for all
  using (public.co_quyen('cang', array['quan_tri']) or public.co_quyen('kho', array['quan_tri']) or public.co_vai_tro(array['quan_tri']))
  with check (public.co_quyen('cang', array['quan_tri']) or public.co_quyen('kho', array['quan_tri']) or public.co_vai_tro(array['quan_tri']));

-- A. Cầu bến: đổi mã cũ sang mã mới (chuyến tàu tự đổi theo khóa ngoại), rồi nạp theo file
${doiMa.map(([cu, moi]) => `update public.berths set ma = ${q(moi)} where ma = ${q(cu)} and not exists (select 1 from public.berths where ma = ${q(moi)});`).join("\n")}
${["voyages:ben_phu", "voyage_stops:ben_cu", "voyage_stops:ben_moi", "voyage_stops:ben_phu_cu", "voyage_stops:ben_phu_moi"].map((x) => { const [t, c] = x.split(":"); return `update public.${t} set ${c} = case ${c} ${doiMa.map(([cu, moi]) => `when ${q(cu)} then ${q(moi)}`).join(" ")} else ${c} end where ${c} in (${doiMa.map(([cu]) => q(cu)).join(", ")});`; }).join("\n")}
insert into public.berths (${cB.join(", ")}) values
${dong(cB, berths)}
on conflict (ma) do update set ${cB.filter((c) => c !== "ma").map((c) => `${c} = excluded.${c}`).join(", ")}, updated_at = now();
delete from public.berths where ma not in (${berths.map((b) => q(b.ma)).join(", ")});

-- B. Xe và cẩu: thay toàn bộ
delete from public.vehicles where ma not in (${xeVaCau.map((v) => q(v.ma)).join(", ")});
insert into public.vehicles (${cV.join(", ")}) values
${dong(cV, xeVaCau)}
on conflict (ma) do update set ${cV.filter((c) => c !== "ma").map((c) => `${c} = excluded.${c}`).join(", ")};
update public.danh_muc set data = data || jsonb_build_object('doi', ${qj(doiXe)}, 'to', ${qj(toXe)}), updated_at = now() where id = 'meta';

-- C. Hàng hóa: thay toàn bộ
delete from public.hang_hoa;
insert into public.hang_hoa (${cH.join(", ")}) values
${dong(cH, hanghoa)};

-- D. Kho bãi: thay toàn bộ
delete from public.kho_bai;
insert into public.kho_bai (${cK.join(", ")}) values
${dong(cK, khoBai)};

-- E. Danh mục phụ: nạp lại theo file
delete from public.danh_muc_bang where bang in (${Object.keys(dmBang).map(q).join(", ")});
${dsBang.length ? `insert into public.danh_muc_bang (bang, data, thu_tu) values\n${dong(["bang", "data", "thu_tu"], dsBang)};` : ""}

-- Kiểm tra
select 'berths' as bang, count(*) from public.berths
union all select 'vehicles (xe)', count(*) from public.vehicles where doi <> 'Cẩu'
union all select 'vehicles (Cẩu)', count(*) from public.vehicles where doi = 'Cẩu'
union all select 'hang_hoa', count(*) from public.hang_hoa
union all select 'kho_bai', count(*) from public.kho_bai
union all select 'danh_muc_bang', count(*) from public.danh_muc_bang;
`;
fs.writeFileSync(path.resolve(__dir, "../sql/08_danh_muc_tong_hop.sql"), sql);
console.log(`Bến ${berths.length} · cẩu ${cranes.length} · xe ${xe.length} · hàng hóa ${hanghoa.length} · kho bãi ${khoBai.length} · danh mục phụ ${dsBang.length} dòng`);
for (const c of canhBao) console.log("  Lưu ý:", c);
