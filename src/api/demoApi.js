// Backend giả lập cho ?demo: cùng giao diện với supabaseApi, dữ liệu nằm trong bộ nhớ (mất khi tải lại trang).
// Kiểm tra quyền giống RLS để thử vai trò: ?demo=xem | nhap | quan_ly (mặc định quản trị).
import { chiaDeuTheoGio } from "../lib/keHoachNgay";
import { klCanLam } from "../lib/linetime";
import { demoData } from "../data/demoData";
import { DEMO_ROLE, DEMO_NHOM } from "../config";
import { NHOM, khoaDong, tuDb } from "../lib/sanLuongTT";
import { congThang } from "../lib/format";

const clone = (x) => JSON.parse(JSON.stringify(x));
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const BAC = { xem: 0, nhap: 1, quan_ly: 2, quan_tri: 3 };

// Tồn theo bãi – hàng – lô tính từ sổ (giống view kho_ton trên Supabase)
function tonKho(gd) {
  const m = new Map();
  const cong = (bai, hang, lo, ngay, sl, khu) => { const k = `${bai}|${khu || ""}|${hang}|${lo || ""}`; const r = m.get(k) || { ten_bai: bai, ten_khu: khu || "", hang, so_lo: lo || "", ton: 0, ngay_dau: ngay, ngay_cuoi: ngay }; r.ton += sl; if (ngay < r.ngay_dau) r.ngay_dau = ngay; if (ngay > r.ngay_cuoi) r.ngay_cuoi = ngay; m.set(k, r); };
  for (const g of gd) {
    cong(g.ten_bai, g.hang, g.so_lo, g.ngay, g.loai === "xuat" || g.loai === "dieu_chuyen" ? -g.so_luong : +g.so_luong, g.ten_khu);
    if (g.loai === "dieu_chuyen" && g.den_bai) cong(g.den_bai, g.hang, g.so_lo, g.ngay, +g.so_luong, g.den_khu);
  }
  return [...m.values()];
}

export function makeDemoApi() {
  const db = demoData();
  db.traHang = db.traHang || [];
  db.nextId.t = db.nextId.t || 0;
  db.tonPhanLoai = db.tonPhanLoai || [];
  db.dmBang = db.dmBang || [];
  db.nextId.dm = db.dmBang.length;
  db.nextId.pl = db.tonPhanLoai.length;
  // Kế hoạch ngày mẫu: mỗi chuyến đang / sắp làm hàng chia 90% khối lượng cần làm theo giờ làm hàng
  db.keHoachNgay = []; db.nextId.kn = 0;
  for (const v of db.voyages) {
    if (v.huy || !(klCanLam(v) > 0)) continue;
    for (const [ngay, tan] of chiaDeuTheoGio(v, klCanLam(v) * 0.9)) if (tan > 0) db.keHoachNgay.push({ id: ++db.nextId.kn, voyage_id: v.id, ngay, khoi_luong: tan, ghi_chu: null, updated_at: null });
  }
  // Kế hoạch tổng hợp mẫu (tháng hiện tại): xuất bán, sản xuất, nhập mua
  { const d = new Date(), ky = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const t = (loai, hang, bo, bien, tong) => ({ loai, ky, hang, bo, bien, tong: tong ?? bo + bien });
    const x = (loai, hang, hinh_thuc, loai_xe, don_vi, tan) => ({ loai, ky, hang, hinh_thuc, loai_xe, don_vi, tan });
    db.khTH = { nextId: 100,
      th: [t("xuat_ban", "Thép cuộn HRC", 10000, 20000), t("xuat_ban", "Thép thanh", 3000, 5000), t("xuat_ban", "Phôi vuông", 0, 7000), t("san_xuat", "Thép cuộn HRC", 0, 0, 35000), t("san_xuat", "Thép thanh", 0, 0, 9000), t("nhap_mua", "Phế", 4000, 12000)],
      xe: [x("xuat_ban", "Thép cuộn HRC", "bo", "Xe đầu kéo", "hoa_phat", 6000), x("xuat_ban", "Thép cuộn HRC", "bo", "Xe đầu kéo", "nha_thau", 4000), x("xuat_ban", "Thép cuộn HRC", "bien", "Xe đầu kéo", "hoa_phat", 12000), x("xuat_ban", "Thép cuộn HRC", "bien", "Xe đầu kéo", "nha_thau", 8000),
        x("xuat_ban", "Thép thanh", "bo", "Xe đầu kéo", "hoa_phat", 3000), x("xuat_ban", "Thép thanh", "bien", "", "hoa_phat", 5000), x("xuat_ban", "Phôi vuông", "bien", "Xe đầu kéo", "nha_thau", 7000), x("nhap_mua", "Phế", "bien", "Xe ben", "nha_thau", 12000)],
      kho: [] }; }
  const role = DEMO_ROLE;
  const can = (r) => { if (BAC[role] < BAC[r]) throw new Error(`Chế độ demo đang thử vai trò "${role}": không đủ quyền thao tác này`); };
  const KHOA = { berths: "ma", vessels: "ten", agents: "ten", kho_bai: "id" };
  const BANG = { berths: "berths", vessels: "vessels", agents: "agents", kho_bai: "khoBai" };
  const audit = [];
  const ghi = (bang, khoa, hanh_dong, cu, moi) => audit.unshift({ id: audit.length + 1, bang, khoa: String(khoa), hanh_dong, cu: clone(cu ?? null), moi: clone(moi ?? null), user_id: "demo", luc: new Date().toISOString() });
  const users = [
    { user_id: "demo", email: "demo@local", ho_ten: "Chế độ demo", vai_tro_cu: "quan_tri" },
    { user_id: "u2", email: "kehoach@local", ho_ten: "Nhân viên kế hoạch", vai_tro_cu: "nhap" },
    { user_id: "u3", email: "truongca@local", ho_ten: "Trưởng ca cảng", vai_tro_cu: "xem" },
  ];
  const nhomDs = [{ user_id: "u4", nhom: "van_tai" }];
  const moduleRoles = [{ user_id: "u2", phan_he: "cang", vai_tro: "nhap" }, { user_id: "u3", phan_he: "cang", vai_tro: "quan_ly" }];

  return {
    demo: true,
    async getSession() { return { user: { id: "demo", email: "demo@local" } }; },
    onAuth() { return { unsubscribe() {} }; },
    async signIn() { return this.getSession(); },
    async signOut() { location.href = location.pathname + "?demo"; },
    async doiMatKhau() { throw new Error("Chế độ demo không có mật khẩu"); },
    async dauVanTay() { return "demo"; }, // demo một người dùng: dữ liệu chỉ đổi qua chính thao tác của mình (đã tự tải lại)
    async getRole() {
      // Tài khoản nhóm quyền: vai trò chung "xem" + nhóm (giao diện khóa nút ngoài khu vực của nhóm)
      if (DEMO_NHOM) return { cang: "xem", kho: "xem", ho_ten: "Demo nhóm " + DEMO_NHOM, admin: false, thietBi: "xem", nhom: DEMO_NHOM === "chi_xem" ? [] : [DEMO_NHOM] };
      return { cang: role, kho: role, ho_ten: "Chế độ demo", admin: role === "quan_tri", thietBi: role === "quan_ly" ? "nhap" : role, nhom: [] };
    },

    async loadAll({ xemTien }) {
      await wait();
      return clone({
        berths: db.berths, vessels: db.vessels, agents: db.agents, khoBai: db.khoBai,
        voyages: db.voyages, stops: db.stops, tien: [],
        plans: [], khoTon: tonKho(db.giaoDich), khoLo: db.khoLo, giaoDich: db.giaoDich, dmCot: db.dmCot, coSql12: true, coCotDan: true, coSql19: true, coSql24: true, coSql25: true, coSql26: true, coSql28: true, traHang: db.traHang, mucTieu: db.mucTieu, khoKeHoach: db.khoKeHoach, dmBang: db.dmBang,
      });
    },
    // Kho
    async addGiaoDich(rows) { can("nhap"); await wait(); for (const r of rows) db.giaoDich.push({ ...clone(r), id: ++db.nextId.g, created_at: new Date().toISOString() }); },
    async updateGiaoDich(id, patch) { can("nhap"); await wait(); Object.assign(db.giaoDich.find((x) => x.id === id), clone(patch)); },
    async deleteGiaoDich(id) { can("quan_ly"); await wait(); db.giaoDich = db.giaoDich.filter((x) => x.id !== id); },
    async saveLo(rows) { can("nhap"); await wait(); for (const r of rows) { const i = db.khoLo.findIndex((x) => x.so_lo === r.so_lo); if (i >= 0) db.khoLo[i] = { ...db.khoLo[i], ...clone(r) }; else db.khoLo.push(clone(r)); } },
    async docMaChuyen(ten, nam) { await wait(); const p = `${ten} / ${nam} / `.toLowerCase(); return db.voyages.map((v) => v.ma_chuyen).filter((m) => String(m || "").toLowerCase().startsWith(p)); },
    async loadGiaoDichKhoang(tu, den) { await wait(); return clone(db.giaoDich.filter((g) => g.ngay >= tu && g.ngay <= den)); },
    async loadEvents(vid) { await wait(60); return clone(db.events.filter((e) => e.voyage_id === vid).sort((a, b) => a.thoi_diem.localeCompare(b.thoi_diem))); },
    async loadEventsMany(ids) { await wait(60); const s = new Set(ids); return clone(db.events.filter((e) => s.has(e.voyage_id))); },
    async loadAudit(vid) { can("quan_ly"); await wait(60); return clone(audit.filter((a) => a.khoa === String(vid))); },

    async insertVoyages(rows) {
      can("nhap"); await wait();
      const out = rows.map((r) => {
        if (db.voyages.some((v) => v.ma_chuyen === r.ma_chuyen)) throw new Error(`Mã chuyến ${r.ma_chuyen} đã có`);
        const v = { huy: false, cau: [], moc_tinh_tp: "nor_12h", kieu_tp: "laytime", tru_hoa_tieu: true, ...clone(r), id: ++db.nextId.v };
        db.voyages.push(v); ghi("voyages", v.id, "INSERT", null, v); return v;
      });
      return clone(out);
    },
    async updateVoyage(id, patch) {
      can("nhap"); await wait();
      const v = db.voyages.find((x) => x.id === id), cu = clone(v);
      Object.assign(v, clone(patch)); ghi("voyages", id, "UPDATE", cu, v); return clone(v);
    },
    async deleteAllVoyages() {
      can("quan_tri"); await wait();
      for (const v of db.voyages) ghi("voyages", v.id, "DELETE", v, null);
      db.voyages = []; db.stops = []; db.traHang = []; db.events = []; db.tien = []; db.keHoachNgay = [];
    },
    async deleteVoyage(id) {
      can("quan_ly"); await wait();
      ghi("voyages", id, "DELETE", db.voyages.find((x) => x.id === id), null);
      db.voyages = db.voyages.filter((x) => x.id !== id);
      db.stops = db.stops.filter((x) => x.voyage_id !== id); db.traHang = db.traHang.filter((x) => x.voyage_id !== id); db.events = db.events.filter((x) => x.voyage_id !== id); db.tien = db.tien.filter((x) => x.voyage_id !== id);
    },
    async addTraHang(rec) { can("nhap"); await wait(60); const t = { ...clone(rec), id: ++db.nextId.t, created_at: new Date().toISOString() }; db.traHang.push(t); ghi("voyage_tra_hang", t.voyage_id, "INSERT", null, t); return clone(t); },
    async deleteTraHang(id) { can("quan_ly"); await wait(60); const t = db.traHang.find((x) => x.id === id); ghi("voyage_tra_hang", t?.voyage_id, "DELETE", t, null); db.traHang = db.traHang.filter((x) => x.id !== id); },
    async addEvent(rec) { can("nhap"); await wait(60); const e = { ...clone(rec), id: ++db.nextId.e, created_at: new Date().toISOString() }; db.events.push(e); return clone(e); },
    async deleteEvent(id) { can("nhap"); await wait(60); db.events = db.events.filter((x) => x.id !== id); },
    async addStop(rec) { can("nhap"); await wait(60); const s = { tru_tp: true, trong_mang: false, ...clone(rec), id: ++db.nextId.s }; db.stops.push(s); ghi("voyage_stops", s.voyage_id, "INSERT", null, s); return clone(s); },
    async updateStop(id, patch) { can("nhap"); await wait(60); const s = db.stops.find((x) => x.id === id), cu = clone(s); Object.assign(s, clone(patch)); ghi("voyage_stops", s.voyage_id, "UPDATE", cu, s); },
    async deleteStop(id) { can("quan_ly"); await wait(60); const s = db.stops.find((x) => x.id === id); ghi("voyage_stops", s?.voyage_id, "DELETE", s, null); db.stops = db.stops.filter((x) => x.id !== id); },

    async upsertRows(bang, rows) {
      can(bang === "berths" || bang === "kho_bai" ? "quan_tri" : "nhap"); await wait();
      const k = KHOA[bang], ds = db[BANG[bang]];
      for (const r of rows) { const i = r[k] == null ? -1 : ds.findIndex((x) => x[k] === r[k]); if (i >= 0) ds[i] = { ...ds[i], ...clone(r) }; else ds.push({ ...clone(r), id: r.id ?? Math.max(0, ...ds.map((x) => +x.id || 0)) + 1 }); }
    },
    async saveMucTieu(rows) {
      can("quan_ly"); await wait();
      const khoa = (r) => `${r.thang}|${r.huong}|${r.loai_hang}`;
      for (const r of rows) {
        db.mucTieu = db.mucTieu.filter((x) => khoa(x) !== khoa(r));
        if (r.tan != null) db.mucTieu.push({ ...clone(r), ghi_chu: r.ghi_chu || null, updated_at: new Date().toISOString() });
      }
      db.mucTieu.sort((a, b) => a.thang.localeCompare(b.thang));
    },
    // Mục tiêu tháng + sản lượng thực tế theo ca / ngày (SQL 06): dữ liệu mẫu trong bộ nhớ
    async docSanLuongThang(nhom, thang) {
      await wait(60);
      const c = NHOM[nhom], mt = nhom === "cang" ? db.mucTieu : db.mucTieuVanTai, tt = nhom === "cang" ? db.sanLuongCang : db.sanLuongVanTai;
      return clone({ mucTieu: mt.filter((x) => x.thang === thang), thucTe: tt.filter((x) => x.ngay >= thang + "-01" && x.ngay < congThang(thang, 1) + "-01") });
    },
    async saveMucTieuNhom(nhom, rows) {
      can("quan_ly"); await wait();
      const kho = (r) => khoaDong(r.huong, r.loai, r.donVi, r.hang);
      const bang = nhom === "cang" ? "mucTieu" : "mucTieuVanTai";
      for (const r of rows) {
        db[bang] = db[bang].filter((x) => !(x.thang === r.thang && kho(tuDb(nhom, x)) === kho(r)));
        if (r.tan != null) db[bang].push({ thang: r.thang, huong: r.huong, ...(nhom === "van_tai" ? { loai_xe: r.loai, don_vi: r.donVi, loai_hang: r.hang || "" } : { loai_hang: r.loai }), tan: r.tan, ghi_chu: r.ghi_chu || null, updated_at: new Date().toISOString() });
      }
    },
    // Mục tiêu theo quý / năm (SQL 10), lưu trong bộ nhớ
    async docMucTieuKy(nhom, ky) { await wait(60); return clone(db.mucTieuKy.filter((x) => x.nhom === nhom && x.thang === ky).map(({ nhom: _n, ...r }) => r)); },
    async saveMucTieuKy(nhom, rows) {
      can("quan_ly"); await wait();
      const kho = (r) => khoaDong(r.huong, r.loai, r.donVi, r.hang);
      for (const r of rows) {
        db.mucTieuKy = db.mucTieuKy.filter((x) => !(x.nhom === nhom && x.thang === r.thang && kho(tuDb(nhom, x)) === kho(r)));
        if (r.tan != null) db.mucTieuKy.push({ nhom, thang: r.thang, huong: r.huong, ...(nhom === "van_tai" ? { loai_xe: r.loai, don_vi: r.donVi, loai_hang: r.hang || "" } : { loai_hang: r.loai }), tan: r.tan, ghi_chu: r.ghi_chu || null });
      }
    },
    async saveThucTe(nhom, rows) {
      can("nhap"); await wait();
      const kho = (r) => khoaDong(r.huong, r.loai, r.donVi, r.hang);
      const bang = nhom === "cang" ? "sanLuongCang" : "sanLuongVanTai";
      for (const r of rows) {
        db[bang] = db[bang].filter((x) => !(x.ngay === r.ngay && x.ca === r.ca && kho(tuDb(nhom, x)) === kho(r)));
        if (r.tan != null) db[bang].push({ ngay: r.ngay, ca: r.ca, huong: r.huong, ...(nhom === "van_tai" ? { loai_xe: r.loai, don_vi: r.donVi, loai_hang: r.hang || "" } : { loai_hang: r.loai }), tan: r.tan, updated_at: new Date().toISOString() });
      }
    },
    // Kế hoạch sản lượng theo ngày, theo chuyến tàu (SQL 13): dữ liệu mẫu trong bộ nhớ
    async docKeHoachTH(ky) { await wait(60); const k = db.khTH; return clone({ th: k.th.filter((x) => x.ky === ky), xe: k.xe.filter((x) => x.ky === ky), kho: k.kho.filter((x) => x.ky === ky) }); },
    async luuKhDong(loai, ky, { ghi = [], xoa = [] }) {
      can("nhap"); await wait(); const k = db.khTH, kh = (r, h) => r.loai === loai && r.ky === ky && r.hang === h;
      for (const h of xoa) { k.th = k.th.filter((r) => !kh(r, h)); k.xe = k.xe.filter((r) => !kh(r, h)); k.kho = k.kho.filter((r) => !kh(r, h)); }
      for (const r of ghi) { k.th = k.th.filter((x) => !kh(x, r.hang)); k.th.push({ loai, ky, hang: r.hang, bo: r.bo || 0, bien: r.bien || 0, tong: r.tong || 0 }); }
    },
    async luuKhPhanXe(loai, ky, hang, hinh, rows) {
      can("nhap"); await wait(); const k = db.khTH;
      k.xe = k.xe.filter((x) => !(x.loai === loai && x.ky === ky && x.hang === hang && x.hinh_thuc === hinh));
      for (const r of rows) if (r.tan > 0) k.xe.push({ loai, ky, hang, hinh_thuc: hinh, loai_xe: r.loai_xe || "", don_vi: r.don_vi, tan: r.tan });
    },
    async luuKhPhanKho(loai, ky, hang, rows) {
      can("nhap"); await wait(); const k = db.khTH;
      k.kho = k.kho.filter((x) => !(x.loai === loai && x.ky === ky && x.hang === hang));
      for (const r of rows) if (r.tan > 0) k.kho.push({ loai, ky, hang, ten_bai: r.ten_bai, ten_khu: r.ten_khu || "", tan: r.tan });
    },
    async docKhNgayBo(tu, den) { await wait(60); return clone((db.khNgayBo ||= []).filter((x) => x.ngay >= tu && x.ngay <= den)); },
    async luuKhNgayBo(ngay, rows) {
      can("nhap"); await wait(); db.khNgayBo ||= [];
      db.khNgayBo = db.khNgayBo.filter((x) => x.ngay !== ngay);
      for (const r of rows) if (r.tan > 0) db.khNgayBo.push({ id: (db.nextId.khnb = (db.nextId.khnb || 0) + 1), ngay, hang: r.hang, huong: r.huong, ten_bai: r.ten_bai || "", ten_khu: r.ten_khu || "", tan: r.tan });
    },
    async docKhNgayTau(voyageId, ngay) { await wait(60); const k = (db.khNgayTau ||= { xe: [], kho: [] }); return clone({ xe: k.xe.filter((x) => x.voyage_id === voyageId && x.ngay === ngay), kho: k.kho.filter((x) => x.voyage_id === voyageId && x.ngay === ngay) }); },
    async luuKhNgayTau(voyageId, ngay, { xe = [], kho = [] }) {
      can("nhap"); await wait(); const k = (db.khNgayTau ||= { xe: [], kho: [] }), la = (x) => x.voyage_id === voyageId && x.ngay === ngay;
      k.xe = k.xe.filter((x) => !la(x)); k.kho = k.kho.filter((x) => !la(x));
      for (const r of xe) if (r.tan > 0) k.xe.push({ voyage_id: voyageId, ngay, loai_xe: r.loai_xe || "", don_vi: r.don_vi, tan: r.tan });
      for (const r of kho) if (r.tan > 0) k.kho.push({ voyage_id: voyageId, ngay, ten_bai: r.ten_bai, ten_khu: r.ten_khu || "", tan: r.tan });
    },
    async docKeHoachNgay(tu, den) { await wait(60); return clone(db.keHoachNgay.filter((x) => x.ngay >= tu && x.ngay <= den)); },
    async saveKeHoachNgay(rows) {
      can("nhap"); await wait();
      for (const r of rows) {
        db.keHoachNgay = db.keHoachNgay.filter((x) => !(x.voyage_id === r.voyage_id && x.ngay === r.ngay));
        if (r.khoi_luong != null) db.keHoachNgay.push({ id: ++db.nextId.kn, voyage_id: r.voyage_id, ngay: r.ngay, khoi_luong: r.khoi_luong, ghi_chu: null, updated_at: new Date().toISOString() });
      }
    },
    async saveKeHoachKho({ them = [], sua = [], xoa = [] }) {
      can("nhap"); await wait();
      const ds = new Set(xoa);
      db.khoKeHoach = db.khoKeHoach.filter((x) => !ds.has(x.id));
      for (const { id, ...r } of sua) Object.assign(db.khoKeHoach.find((x) => x.id === id) || {}, clone(r), { updated_at: new Date().toISOString() });
      for (const r of them) db.khoKeHoach.push({ ...clone(r), id: ++db.nextId.k, created_at: new Date().toISOString() });
      db.khoKeHoach.sort((a, b) => a.thang.localeCompare(b.thang) || a.id - b.id);
    },
    // Danh mục phụ (SQL 08)
    async saveDmBang(bang, rows) {
      can("quan_tri"); await wait();
      for (const { id, ...data } of rows) {
        const cu = id != null && db.dmBang.find((x) => x.id === id);
        if (cu) cu.data = clone(data); else db.dmBang.push({ id: ++db.nextId.dm, bang, data: clone(data), thu_tu: 100000 + db.nextId.dm });
      }
    },
    async deleteDmBang(ids) { can("quan_tri"); await wait(); const bo = new Set(ids); db.dmBang = db.dmBang.filter((x) => !bo.has(x.id)); },
    // Phân loại tồn kho (SQL 07): dữ liệu mẫu trong bộ nhớ
    async loadTonPhanLoai() { await wait(60); return clone(db.tonPhanLoai); },
    async addTonPhanLoai(rows) { can("nhap"); await wait(); for (const r of rows) db.tonPhanLoai.push({ ...clone(r), id: ++db.nextId.pl, created_at: new Date().toISOString() }); },
    async deleteTonPhanLoai(id) { can("quan_ly"); await wait(); db.tonPhanLoai = db.tonPhanLoai.filter((x) => x.id !== id); },
    async saveCot(bang, cols) { can("quan_tri"); await wait(); db.dmCot = [...db.dmCot.filter((c) => c.bang !== bang), ...clone(cols).map((c) => ({ ...c, bang }))]; },
    async deleteRow(bang, khoa, val) {
      can(bang === "berths" || bang === "kho_bai" ? "quan_tri" : "quan_ly"); await wait();
      db[BANG[bang]] = db[BANG[bang]].filter((x) => x[khoa] !== val);
    },
    async deleteRows(bang, khoa, vals) {
      can(bang === "berths" || bang === "kho_bai" ? "quan_tri" : "quan_ly"); await wait();
      const bo = new Set(vals);
      db[BANG[bang]] = db[BANG[bang]].filter((x) => !bo.has(x[khoa]));
    },

    async listUsers() { can("quan_tri"); await wait(); return clone(users); },
    async listModuleRoles() { await wait(); return clone(moduleRoles); },
    async listNhom() { await wait(); return clone(nhomDs); },
    async setNhom(user_id, nhom) { can("quan_tri"); await wait(60); for (let i = nhomDs.length - 1; i >= 0; i--) if (nhomDs[i].user_id === user_id) nhomDs.splice(i, 1); for (const n of nhom) nhomDs.push({ user_id, nhom: n }); },
    async setModuleRole(user_id, phan_he, vai_tro) {
      can("quan_tri"); await wait(60);
      const i = moduleRoles.findIndex((x) => x.user_id === user_id && x.phan_he === phan_he);
      if (!vai_tro) { if (i >= 0) moduleRoles.splice(i, 1); } else if (i >= 0) moduleRoles[i].vai_tro = vai_tro; else moduleRoles.push({ user_id, phan_he, vai_tro });
    },
  };
}
