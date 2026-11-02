// Backend giả lập cho ?demo: cùng giao diện với supabaseApi, dữ liệu nằm trong bộ nhớ (mất khi tải lại trang).
// Kiểm tra quyền giống RLS để thử vai trò: ?demo=xem | nhap | quan_ly (mặc định quản trị).
import { demoData } from "../data/demoData";
import { DEMO_ROLE } from "../config";

const clone = (x) => JSON.parse(JSON.stringify(x));
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const BAC = { xem: 0, nhap: 1, quan_ly: 2, quan_tri: 3 };

// Tồn theo bãi – hàng – lô tính từ sổ (giống view kho_ton trên Supabase)
function tonKho(gd) {
  const m = new Map();
  const cong = (bai, hang, lo, ngay, sl) => { const k = `${bai}|${hang}|${lo || ""}`; const r = m.get(k) || { ten_bai: bai, hang, so_lo: lo || "", ton: 0, ngay_dau: ngay, ngay_cuoi: ngay }; r.ton += sl; if (ngay < r.ngay_dau) r.ngay_dau = ngay; if (ngay > r.ngay_cuoi) r.ngay_cuoi = ngay; m.set(k, r); };
  for (const g of gd) {
    cong(g.ten_bai, g.hang, g.so_lo, g.ngay, g.loai === "xuat" || g.loai === "dieu_chuyen" ? -g.so_luong : +g.so_luong);
    if (g.loai === "dieu_chuyen" && g.den_bai) cong(g.den_bai, g.hang, g.so_lo, g.ngay, +g.so_luong);
  }
  return [...m.values()];
}

export function makeDemoApi() {
  const db = demoData();
  db.traHang = db.traHang || [];
  db.nextId.t = db.nextId.t || 0;
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
  const moduleRoles = [{ user_id: "u2", phan_he: "cang", vai_tro: "nhap" }, { user_id: "u3", phan_he: "cang", vai_tro: "quan_ly" }];

  return {
    demo: true,
    async getSession() { return { user: { id: "demo", email: "demo@local" } }; },
    onAuth() { return { unsubscribe() {} }; },
    async signIn() { return this.getSession(); },
    async signOut() { location.href = location.pathname + "?demo"; },
    async dauVanTay() { return "demo"; }, // demo một người dùng: dữ liệu chỉ đổi qua chính thao tác của mình (đã tự tải lại)
    async getRole() { return { cang: role, kho: role, ho_ten: "Chế độ demo", admin: role === "quan_tri", thietBi: role === "quan_ly" ? "nhap" : role }; },

    async loadAll({ xemTien }) {
      await wait();
      return clone({
        berths: db.berths, vessels: db.vessels, agents: db.agents, khoBai: db.khoBai,
        voyages: db.voyages, stops: db.stops, tien: [],
        plans: [], khoTon: tonKho(db.giaoDich), khoLo: db.khoLo, giaoDich: db.giaoDich, dmCot: db.dmCot, coSql19: true, coSql24: true, coSql25: true, coSql26: true, coSql28: true, traHang: db.traHang, mucTieu: db.mucTieu, khoKeHoach: db.khoKeHoach,
      });
    },
    // Kho
    async addGiaoDich(rows) { can("nhap"); await wait(); for (const r of rows) db.giaoDich.push({ ...clone(r), id: ++db.nextId.g, created_at: new Date().toISOString() }); },
    async updateGiaoDich(id, patch) { can("nhap"); await wait(); Object.assign(db.giaoDich.find((x) => x.id === id), clone(patch)); },
    async deleteGiaoDich(id) { can("quan_ly"); await wait(); db.giaoDich = db.giaoDich.filter((x) => x.id !== id); },
    async saveLo(rows) { can("nhap"); await wait(); for (const r of rows) { const i = db.khoLo.findIndex((x) => x.so_lo === r.so_lo); if (i >= 0) db.khoLo[i] = { ...db.khoLo[i], ...clone(r) }; else db.khoLo.push(clone(r)); } },
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
    async saveKeHoachKho({ them = [], sua = [], xoa = [] }) {
      can("nhap"); await wait();
      const ds = new Set(xoa);
      db.khoKeHoach = db.khoKeHoach.filter((x) => !ds.has(x.id));
      for (const { id, ...r } of sua) Object.assign(db.khoKeHoach.find((x) => x.id === id) || {}, clone(r), { updated_at: new Date().toISOString() });
      for (const r of them) db.khoKeHoach.push({ ...clone(r), id: ++db.nextId.k, created_at: new Date().toISOString() });
      db.khoKeHoach.sort((a, b) => a.thang.localeCompare(b.thang) || a.id - b.id);
    },
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
    async setModuleRole(user_id, phan_he, vai_tro) {
      can("quan_tri"); await wait(60);
      const i = moduleRoles.findIndex((x) => x.user_id === user_id && x.phan_he === phan_he);
      if (!vai_tro) { if (i >= 0) moduleRoles.splice(i, 1); } else if (i >= 0) moduleRoles[i].vai_tro = vai_tro; else moduleRoles.push({ user_id, phan_he, vai_tro });
    },
  };
}
