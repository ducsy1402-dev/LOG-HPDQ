// Kết nối Supabase thật. Cùng tên miền với web Thiết bị cơ giới nên phiên đăng nhập (lưu trong trình duyệt) dùng chung.
import { supabase } from "../lib/supabase";
import { NHOM } from "../lib/sanLuongTT";
import { congThang } from "../lib/format";

const ok = (r) => { if (r.error) throw r.error; return r.data; };
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
async function fetchAll(q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = ok(await q().range(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}
// Đọc bảng có thể chưa tạo (chưa chạy SQL 13): trả null thay vì lỗi
const thu = async (p) => { const r = await p; return r.error ? null : r.data; };
const theoVoyage = async (sb, bang, ids) => {
  const out = [];
  for (const c of chunk(ids, 150)) out.push(...ok(await sb.from(bang).select("*").in("voyage_id", c)));
  return out;
};

// Cờ SQL đã biết là có (nhớ trong phiên làm việc; chưa có thì lần tải sau hỏi lại)
const coSql = {};

export function makeSupabaseApi() {
  const sb = supabase();
  const now = () => new Date().toISOString();
  return {
    demo: false,
    async getSession() { return (await sb.auth.getSession()).data.session; },
    onAuth(cb) { return sb.auth.onAuthStateChange((_e, s) => cb(s)).data.subscription; },
    async signIn(email, password) { return ok(await sb.auth.signInWithPassword({ email, password })).session; },
    signOut: () => sb.auth.signOut(),

    // Dấu vân tay dữ liệu Cảng / Kho (SQL 23): đổi nghĩa là có người sửa dữ liệu. null = chưa chạy SQL 23 hoặc lỗi tạm thời
    async dauVanTay() {
      const r = await sb.rpc("dau_van_tay_du_lieu", { p_nhom: "cang" });
      return r.error || r.data == null ? null : String(r.data);
    },

    // Vai trò ở phân hệ Cảng + họ tên (từ user_roles của web cũ). Chưa chạy SQL 13 -> loi = "chua_sql"
    async getRole(userId) {
      const cu = await thu(sb.from("user_roles").select("vai_tro,ho_ten").eq("user_id", userId).maybeSingle());
      const r = await sb.rpc("vai_tro_phan_he", { p_phan_he: "cang" });
      const rk = await sb.rpc("vai_tro_phan_he", { p_phan_he: "kho" });
      const chung = { ho_ten: cu?.ho_ten, admin: cu?.vai_tro === "quan_tri", thietBi: cu?.vai_tro || null };
      if (r.error) return { ...chung, cang: null, loi: "chua_sql" };
      return { ...chung, cang: r.data, kho: rk.error ? null : rk.data };
    },

    // tu: ISO, chuyến có mốc từ ngày này trở đi hoặc chưa rời bến.
    // Mọi truy vấn không phụ thuộc nhau chạy song song (trước đây nối đuôi nhau hơn chục lượt, mỗi lượt vài trăm ms nên lưu xong phải chờ 3 – 4 giây).
    // nhe = true: chỉ tải phần hay đổi khi ghi chuyến (chuyến, khoảng dừng, tiền, phương án, trả hàng); danh mục, kho giữ nguyên bản đã có.
    async loadAll({ tu, xemTien, nhe = false }) {
      // Cờ SQL: chỉ đổi khi anh chạy SQL mới (rồi tải lại trang), nên đã có thì nhớ luôn, không hỏi lại mỗi lần tải
      const dò = async (khoa, bang, cot) => { if (coSql[khoa]) return true; const co = !(await sb.from(bang).select(cot).limit(1)).error; if (co) coSql[khoa] = true; return co; };
      const phanChuyen = async () => {
        const voyages = await fetchAll(() => sb.from("voyages").select("*").or(`atd.is.null,atd.gte.${tu},etd.gte.${tu},eta.gte.${tu}`).order("id"));
        const ids = voyages.map((v) => v.id);
        const traHangP = dò("26", "voyage_stops", "loai").then((co) => (co ? theoVoyage(sb, "voyage_tra_hang", ids).catch(() => null) : null));
        const [stops, traHang] = await Promise.all([theoVoyage(sb, "voyage_stops", ids), traHangP]);
        return { voyages, stops, tien: [], traHang };
      };
      // Bản này không có phương án làm hàng: luôn là danh sách rỗng (store và các phần tính toán vẫn nhận mảng plans)
      const plansP = Promise.resolve([]);
      // Số máng, tàu ưu tiên, vét / be hầm (SQL 19); cẩu tàu (SQL 24); thiết bị gắn của cẩu cảng (SQL 25); chuyển bến, ra neo, trả hàng (SQL 26); bến phụ (SQL 28)
      const coP = Promise.all([dò("19", "voyages", "uu_tien"), dò("24", "voyages", "cau_tau"), dò("25", "voyages", "cau_gan"), dò("26", "voyage_stops", "loai"), dò("28", "voyages", "ben_phu")]);
      if (nhe) {
        const [c, plans, [coSql19, coSql24, coSql25, coSql26, coSql28]] = await Promise.all([phanChuyen(), plansP, coP]);
        return { ...c, plans, coSql19, coSql24, coSql25, coSql26, coSql28 };
      }
      const tuNgay = new Date(Date.now() - 35 * 864e5).toISOString().slice(0, 10);
      const [[berths, vessels, agents, khoBai], c, plans, khoTon, khoLo, giaoDich, dmCot, mucTieu, khoKeHoach, dmBang, [coSql19, coSql24, coSql25, coSql26, coSql28]] = await Promise.all([
        Promise.all([
          sb.from("berths").select("*").order("thu_tu").then(ok),
          fetchAll(() => sb.from("vessels").select("*").order("ten")),
          sb.from("agents").select("*").order("ten").then(ok),
          fetchAll(() => sb.from("kho_bai").select("*").order("id")),
        ]),
        phanChuyen(), plansP,
        thu(sb.from("kho_ton").select("*").range(0, 9999)),
        thu(sb.from("kho_lo").select("*").range(0, 9999)),
        fetchAll(() => sb.from("kho_giao_dich").select("*").gte("ngay", tuNgay).order("id")).catch(() => null),
        // Cột tự thêm của danh mục (SQL 18). Chưa chạy SQL 18 thì null: ẩn chức năng thêm cột.
        thu(sb.from("danh_muc_cot").select("*").order("thu_tu")),
        // Mục tiêu sản lượng tháng (SQL 21). Chưa chạy SQL 21 thì null: Tổng quan báo cần chạy SQL.
        thu(sb.from("muc_tieu_san_luong").select("*").order("thang").range(0, 9999)),
        // Kế hoạch xuất / nhập tồn kho theo tháng và bãi nhỏ (SQL 27). Chưa chạy SQL 27 thì null: tab Kế hoạch báo cần chạy SQL.
        thu(sb.from("kho_ke_hoach").select("*").order("thang").order("id").range(0, 9999)),
        // Danh mục phụ: thiết bị gắn, thông số / định mức cẩu, thông số xe, khai báo kho / bãi (SQL 08). Chưa chạy SQL 08 thì null.
        thu(sb.from("danh_muc_bang").select("*").order("bang").order("thu_tu").order("id").range(0, 9999)),
        coP,
      ]);
      return { berths, vessels, agents, khoBai, ...c, plans, khoTon, khoLo, giaoDich, dmCot, coSql19, coSql24, coSql25, coSql26, coSql28, mucTieu, khoKeHoach, dmBang };
    },
    loadEvents: async (voyageId) => ok(await sb.from("voyage_events").select("*").eq("voyage_id", voyageId).order("thoi_diem")),
    loadEventsMany: async (ids) => theoVoyage(sb, "voyage_events", ids),
    loadAudit: async (voyageId) => ok(await sb.from("audit_log").select("*").in("bang", ["voyages", "voyage_stops"]).eq("khoa", String(voyageId)).order("luc", { ascending: false }).limit(100)),

    // Thêm nhiều chuyến. PostgREST gộp các dòng thành một lệnh: dòng thiếu cột nào (VD kieu_tp chỉ có ở tàu CQD) thì ghi NULL,
    // không dùng mặc định của cột, nên lỗi "null value … violates not-null". Vì vậy gom các dòng cùng bộ cột thành từng lệnh riêng;
    // kết quả giữ đúng thứ tự dòng nhập.
    async insertVoyages(rows) {
      const out = new Array(rows.length), nhom = new Map();
      rows.forEach((r, i) => { const k = Object.keys(r).sort().join("|"); nhom.set(k, [...(nhom.get(k) || []), i]); });
      for (const idx of nhom.values()) for (const c of chunk(idx, 200)) {
        const kq = ok(await sb.from("voyages").insert(c.map((i) => rows[i])).select());
        c.forEach((i, j) => { out[i] = kq[j]; });
      }
      return out;
    },
    async updateVoyage(id, patch) { return ok(await sb.from("voyages").update({ ...patch, updated_at: now() }).eq("id", id).select())[0]; },
    // Mục tiêu sản lượng: mỗi dòng một tháng – hướng – loại hàng; tan = null thì xóa dòng đó
    async saveMucTieu(rows) {
      for (const r of rows.filter((x) => x.tan == null))
        ok(await sb.from("muc_tieu_san_luong").delete().eq("thang", r.thang).eq("huong", r.huong).eq("loai_hang", r.loai_hang));
      const ghi = rows.filter((x) => x.tan != null).map((r) => ({ thang: r.thang, huong: r.huong, loai_hang: r.loai_hang, tan: r.tan, ghi_chu: r.ghi_chu || null, updated_at: now() }));
      if (ghi.length) ok(await sb.from("muc_tieu_san_luong").upsert(ghi, { onConflict: "thang,huong,loai_hang" }));
    },
    // Mục tiêu tháng + sản lượng thực tế theo ca / ngày của một nhóm (cang | van_tai) trong một tháng (SQL 06). null = chưa chạy SQL 06
    async docSanLuongThang(nhom, thang) {
      const c = NHOM[nhom];
      const [mt, tt] = await Promise.all([
        sb.from(c.bangMT).select("*").eq("thang", thang).range(0, 9999),
        sb.from(c.bangTT).select("*").gte("ngay", thang + "-01").lt("ngay", congThang(thang, 1) + "-01").order("ngay").range(0, 9999),
      ]);
      if (mt.error || tt.error) return null;
      return { mucTieu: mt.data, thucTe: tt.data };
    },
    // rows: [{ thang, huong, loai, donVi, tan, ghi_chu }]; tan = null thì xóa dòng đó
    async saveMucTieuNhom(nhom, rows) {
      const c = NHOM[nhom], lien = (q, r) => (nhom === "van_tai" ? q.eq("loai_xe", r.loai).eq("don_vi", r.donVi).eq("loai_hang", r.hang || "") : q.eq("loai_hang", r.loai));
      for (const r of rows.filter((x) => x.tan == null)) ok(await lien(sb.from(c.bangMT).delete().eq("thang", r.thang).eq("huong", r.huong), r));
      const ghi = rows.filter((x) => x.tan != null).map((r) => ({ thang: r.thang, huong: r.huong, ...(nhom === "van_tai" ? { loai_xe: r.loai, don_vi: r.donVi, loai_hang: r.hang || "" } : { loai_hang: r.loai }), tan: r.tan, ghi_chu: r.ghi_chu || null, updated_at: now() }));
      if (ghi.length) ok(await sb.from(c.bangMT).upsert(ghi, { onConflict: nhom === "van_tai" ? "thang,huong,loai_xe,don_vi,loai_hang" : "thang,huong,loai_hang" }));
    },
    // rows: [{ ngay, ca, huong, loai, donVi, tan }]; tan = null thì xóa số của ô đó
    async saveThucTe(nhom, rows) {
      const c = NHOM[nhom], lien = (q, r) => (nhom === "van_tai" ? q.eq("loai_xe", r.loai).eq("don_vi", r.donVi).eq("loai_hang", r.hang || "") : q.eq("loai_hang", r.loai));
      for (const r of rows.filter((x) => x.tan == null)) ok(await lien(sb.from(c.bangTT).delete().eq("ngay", r.ngay).eq("ca", r.ca).eq("huong", r.huong), r));
      const ghi = rows.filter((x) => x.tan != null).map((r) => ({ ngay: r.ngay, ca: r.ca, huong: r.huong, ...(nhom === "van_tai" ? { loai_xe: r.loai, don_vi: r.donVi, loai_hang: r.hang || "" } : { loai_hang: r.loai }), tan: r.tan, updated_at: now() }));
      for (const g of chunk(ghi, 300)) ok(await sb.from(c.bangTT).upsert(g, { onConflict: nhom === "van_tai" ? "ngay,ca,huong,loai_xe,don_vi,loai_hang" : "ngay,ca,huong,loai_hang" }));
    },
    // Kế hoạch xuất / nhập tồn kho: { them: [dòng mới], sua: [{ id, ...cột đổi }], xoa: [id] }
    async saveKeHoachKho({ them = [], sua = [], xoa = [] }) {
      if (xoa.length) ok(await sb.from("kho_ke_hoach").delete().in("id", xoa));
      for (const c of chunk(them, 300)) ok(await sb.from("kho_ke_hoach").insert(c));
      for (const { id, ...r } of sua) ok(await sb.from("kho_ke_hoach").update({ ...r, updated_at: now() }).eq("id", id));
    },
    // Danh mục phụ (SQL 08): mỗi dòng { id, bang, data, thu_tu }. rows: [{ id?, ...giá trị cột }]
    async saveDmBang(bang, rows) {
      const cu = rows.filter((r) => r.id != null), moi = rows.filter((r) => r.id == null);
      for (const { id, ...data } of cu) ok(await sb.from("danh_muc_bang").update({ data, updated_at: now() }).eq("id", id));
      if (moi.length) ok(await sb.from("danh_muc_bang").insert(moi.map(({ id, ...data }, i) => ({ bang, data, thu_tu: 100000 + i }))));
    },
    deleteDmBang: async (ids) => ok(await sb.from("danh_muc_bang").delete().in("id", ids)),
    // Phân loại tồn kho: cần giải phóng / đầu cơ (SQL 07). null = chưa chạy SQL 07
    async loadTonPhanLoai() { const r = await sb.from("kho_ton_phan_loai").select("*").order("ngay").order("id").range(0, 9999); return r.error ? null : r.data; },
    async addTonPhanLoai(rows) { ok(await sb.from("kho_ton_phan_loai").insert(rows)); },
    deleteTonPhanLoai: async (id) => ok(await sb.from("kho_ton_phan_loai").delete().eq("id", id)),
    // Kho: sổ nhập – xuất, lô thành phẩm
    async addGiaoDich(rows) { for (const c of chunk(rows, 300)) ok(await sb.from("kho_giao_dich").insert(c)); },
    updateGiaoDich: async (id, patch) => ok(await sb.from("kho_giao_dich").update(patch).eq("id", id)),
    deleteGiaoDich: async (id) => ok(await sb.from("kho_giao_dich").delete().eq("id", id)),
    async saveLo(rows) { for (const c of chunk(rows, 300)) ok(await sb.from("kho_lo").upsert(c.map((r) => ({ ...r, updated_at: now() })), { onConflict: "so_lo", ignoreDuplicates: false })); },
    loadGiaoDichKhoang: async (tu, den) => fetchAll(() => sb.from("kho_giao_dich").select("*").gte("ngay", tu).lte("ngay", den).order("id")),
    deleteVoyage: async (id) => ok(await sb.from("voyages").delete().eq("id", id)),
    addEvent: async (rec) => ok(await sb.from("voyage_events").insert(rec).select())[0],
    deleteEvent: async (id) => ok(await sb.from("voyage_events").delete().eq("id", id)),
    // Trả hàng (hàng không đạt chất lượng bị trả lại tàu): ghi nhận, không tính vào khối lượng xếp dỡ
    addTraHang: async (rec) => ok(await sb.from("voyage_tra_hang").insert(rec).select())[0],
    deleteTraHang: async (id) => ok(await sb.from("voyage_tra_hang").delete().eq("id", id)),
    addStop: async (rec) => ok(await sb.from("voyage_stops").insert(rec).select())[0],
    updateStop: async (id, patch) => ok(await sb.from("voyage_stops").update(patch).eq("id", id)),
    deleteStop: async (id) => ok(await sb.from("voyage_stops").delete().eq("id", id)),

    // Danh mục: bang = berths | vessels | agents | kho_bai; khoa = cột khóa.
    // Bảng khóa "id" (kho bãi): dòng chưa có id thì thêm mới, có id thì sửa từng dòng.
    async upsertRows(bang, rows, khoa) {
      if (khoa === "id") {
        const moi = rows.filter((r) => r.id == null).map(({ id, ...r }) => ({ ...r, updated_at: now() }));
        for (const c of chunk(moi, 300)) ok(await sb.from(bang).insert(c));
        for (const { id, ...r } of rows.filter((x) => x.id != null)) ok(await sb.from(bang).update({ ...r, updated_at: now() }).eq("id", id));
        return;
      }
      for (const c of chunk(rows, 300)) ok(await sb.from(bang).upsert(c.map((r) => ({ ...r, updated_at: now() })), { onConflict: khoa }));
    },
    deleteRow: async (bang, khoa, val) => ok(await sb.from(bang).delete().eq(khoa, val)),
    // Xóa nhiều dòng một lần (Danh mục: tick chọn rồi xóa); chia nhóm 200 để câu lệnh không quá dài
    async deleteRows(bang, khoa, vals) { for (const c of chunk(vals, 200)) ok(await sb.from(bang).delete().in(khoa, c)); },
    // Cột tự thêm của một danh mục: ghi lại cả danh sách (cột bỏ đi thì xóa định nghĩa, giá trị cũ trong dòng giữ nguyên)
    async saveCot(bang, cols) {
      const giu = cols.map((c) => c.ma);
      const cu = ok(await sb.from("danh_muc_cot").select("ma").eq("bang", bang));
      for (const c of cu.filter((x) => !giu.includes(x.ma))) ok(await sb.from("danh_muc_cot").delete().eq("bang", bang).eq("ma", c.ma));
      if (cols.length) ok(await sb.from("danh_muc_cot").upsert(cols.map((c) => ({ ...c, bang, updated_at: now() }))));
    },

    listUsers: async () => ok(await sb.rpc("ds_nguoi_dung")),
    listModuleRoles: async () => ok(await sb.from("user_module_roles").select("*")),
    async setModuleRole(user_id, phan_he, vai_tro) {
      if (!vai_tro) return ok(await sb.from("user_module_roles").delete().eq("user_id", user_id).eq("phan_he", phan_he));
      return ok(await sb.from("user_module_roles").upsert({ user_id, phan_he, vai_tro, updated_at: now() }));
    },
  };
}
