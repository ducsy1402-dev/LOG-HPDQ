import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEMO } from "./config";
import { makeDemoApi } from "./api/demoApi";
import { makeSupabaseApi } from "./api/supabaseApi";
import { canhBaoMo, NGUONG_MAC_DINH } from "./lib/checks";
import { thangKhoang, congThang, thangCua } from "./lib/format";
import { datThuTuBen } from "./lib/tenBen";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
const BAC = { xem: 0, nhap: 1, quan_ly: 2, quan_tri: 3 };

// Điều hướng bằng #/duong-dan để tải lại trang không lỗi (web chạy ở /logistics/)
export function useHash() {
  const doc = () => (location.hash.replace(/^#\/?/, "") || "tong-quan").split("?")[0];
  const [h, setH] = useState(doc);
  useEffect(() => { const f = () => setH(doc()); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  return [h, (p) => { location.hash = "/" + p; }];
}

export function AppProvider({ children }) {
  // Ghi lại các hàm ghi dữ liệu đã gọi trong một thao tác, để lưu xong biết chỉ cần tải lại phần chuyến tàu (nhanh) hay phải tải lại tất cả
  const luot = useRef(new Set());
  const api = useMemo(() => {
    const goc = DEMO ? makeDemoApi() : makeSupabaseApi();
    return new Proxy(goc, { get: (t, k) => { const f = t[k]; return typeof f === "function" ? (...a) => { luot.current.add(String(k)); return f.apply(t, a); } : f; } });
  }, []);
  const [phase, setPhase] = useState("loading"); // loading | login | norole | chua_sql | ready
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // { cang, ho_ten, admin }
  const [raw, setRaw] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [taiLuc, setTaiLuc] = useState(Date.now()); // lần tải đầy đủ dữ liệu Cảng / Kho gần nhất
  const capNhatRef = useRef(Date.now()); // lần gần nhất biết dữ liệu còn mới (vừa tải, hoặc kiểm tra thấy không đổi); hiện ở Tổng quan
  const cheDoRef = useRef("dinh-ky"); // "dau-van-tay": hỏi thay đổi mỗi 10 giây (SQL 23) · "dinh-ky": tải đầy đủ mỗi 1 phút
  const dauVTRef = useRef(null); // dấu vân tay dữ liệu lúc tải gần nhất
  const [voyageMo, setVoyageMo] = useState(null); // id chuyến đang mở phiếu
  // Tải chuyến từ đầu tháng trước trở đi (và mọi chuyến chưa rời); xem tháng cũ hơn thì nới khoảng tải
  const [tuThang, setTuThang] = useState(() => congThang(thangCua(Date.now()), -1));
  const [theme, setThemeState] = useState(() => (document.documentElement.classList.contains("dark") ? "dark" : "light"));
  const roleRef = useRef(null);

  const toast = useCallback((msg, tone = "ok") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "bad" ? 6500 : 3800);
  }, []);
  const fail = useCallback((e) => { console.error(e); toast(e?.message || String(e), "bad"); }, [toast]);

  // Hàm ghi chỉ đụng tới chuyến tàu và dữ liệu đi kèm chuyến: lưu xong tải lại nhẹ
const GHI_NHE = new Set(["insertVoyages", "updateVoyage", "deleteVoyage", "addStop", "updateStop", "deleteStop", "addEvent", "deleteEvent", "savePlan", "deletePlan", "addTraHang", "deleteTraHang", "saveTien", "saveThucTe"]);
  const RONG = { berths: [], vessels: [], agents: [], khoBai: [], voyages: [], stops: [], tien: [], plans: null, khoTon: null, khoLo: null, giaoDich: null, dmCot: null, coSql19: false, coSql24: false, coSql25: false, coSql26: false, coSql28: false, coSql12: false, coCotDan: false, traHang: null, mucTieu: null, khoKeHoach: null, dmBang: null };
  const load = useCallback(async (r = roleRef.current, thang = tuThang, nhe = false) => {
    // Chưa chạy SQL 13 hoặc không có quyền Cảng: phần Cảng trống, phần Thiết bị cơ giới vẫn dùng được
    if (!r?.cang && !r?.kho) { setRaw({ ...RONG }); setTaiLuc(Date.now()); return; }
    const tu = new Date(thangKhoang(thang)[0]).toISOString();
    // Dấu vân tay lấy cùng lúc với việc tải (thay đổi xảy ra trong lúc tải sẽ được phát hiện ở lượt kiểm tra sau)
    const [dvt, d] = await Promise.all([api.dauVanTay?.().catch(() => null) ?? null, api.loadAll({ tu, xemTien: BAC[r?.cang] >= 2, nhe })]);
    if (nhe) setRaw((cu) => (cu ? { ...cu, ...d } : cu)); // tải nhẹ: giữ danh mục, kho; không ghi dấu vân tay để lượt kiểm tra sau tải đủ nếu người khác sửa phần kia
    else setRaw(d);
    if (!nhe) dauVTRef.current = dvt;
    cheDoRef.current = dvt != null ? "dau-van-tay" : "dinh-ky";
    capNhatRef.current = Date.now();
    setTaiLuc(Date.now());
  }, [api, tuThang]);

  const boot = useCallback(async (session) => {
    if (!session) { setUser(null); setPhase("login"); return; }
    setUser(session.user);
    try {
      const r = await api.getRole(session.user.id);
      roleRef.current = r; setRole(r);
      // Vào được web khi có quyền ở ít nhất một phần (Thiết bị cơ giới: user_roles; Cảng: user_module_roles)
      if (!r.cang && !r.thietBi && !r.kho) { setPhase("norole"); return; }
      try { await load(r); } catch (e) { fail(e); setRaw({ ...RONG }); }
      setPhase("ready");
    } catch (e) { fail(e); setPhase(/relation .* does not exist|schema cache/i.test(e?.message || "") ? "chua_sql" : "login"); }
  }, [api, load, fail]);

  useEffect(() => {
    api.getSession().then(boot);
    const sub = api.onAuth((s) => { if (!s) { setUser(null); setPhase("login"); } });
    return () => sub?.unsubscribe?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60e3); return () => clearInterval(t); }, []);

  // Tự cập nhật dữ liệu Cảng / Kho: mỗi 10 giây hỏi "dấu vân tay" dữ liệu (rất nhẹ, SQL 23); đổi thì mới tải lại đầy đủ,
  // và vẫn tải lại đầy đủ mỗi 5 phút cho chắc. Chưa có SQL 23 thì tải lại đầy đủ mỗi 1 phút.
  // Bỏ qua lượt này nếu tab đang ẩn, đang lưu, hoặc đang gõ trong một ô (tải lại giữa chừng có thể làm mất chữ đang gõ).
  const tuTai = useRef({});
  tuTai.current = { phase, busy, taiLuc, load, api };
  const dangKiem = useRef(false);
  useEffect(() => {
    const kiem = async () => {
      const t = tuTai.current;
      if (dangKiem.current || t.phase !== "ready" || t.busy || document.hidden) return;
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return; // đang mở hộp nhập liệu / xem thông tin: không tải lại giữa chừng (lưu xong web vẫn tự tải lại)
      dangKiem.current = true;
      try {
        const fp = await t.api.dauVanTay?.().catch(() => null) ?? null;
        const nay = tuTai.current, tuoi = Date.now() - nay.taiLuc;
        if (nay.busy) return;
        if (fp != null) {
          cheDoRef.current = "dau-van-tay";
          if (fp !== dauVTRef.current || tuoi >= 300e3) await nay.load();
          else capNhatRef.current = Date.now();
        } else {
          cheDoRef.current = "dinh-ky";
          if (tuoi >= 60e3) await nay.load();
        }
      } catch { /* mất mạng thoáng qua: lượt sau thử lại, không báo lỗi */ } finally { dangKiem.current = false; }
    };
    const id = setInterval(kiem, 10e3);
    document.addEventListener("visibilitychange", kiem);
    window.addEventListener("focus", kiem);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", kiem); window.removeEventListener("focus", kiem); };
  }, []);

  const reload = useCallback(async () => { try { await load(); } catch (e) { fail(e); } }, [load, fail]);
  // Chạy một thao tác ghi: báo kết quả, tải lại dữ liệu. Trả về kết quả hoặc undefined nếu lỗi.
  const run = useCallback(async (fn, msg) => {
    setBusy(true);
    try {
      luot.current.clear();
      const r = await fn();
      // Chỉ ghi chuyến tàu, khoảng dừng, phương án, trả hàng: tải lại phần đó là đủ (nhanh hơn nhiều so với tải lại toàn bộ)
      const ghi = [...luot.current].filter((k) => !/^(load|get|dau|onAuth|sign)/.test(k));
      await load(undefined, undefined, ghi.length > 0 && ghi.every((k) => GHI_NHE.has(k)));
      if (msg) toast(msg); return r ?? true; } catch (e) { fail(e); return undefined; } finally { setBusy(false); }
  }, [load, toast, fail]);

  const moRongKhoang = useCallback(async (thang) => {
    if (thang >= tuThang) return;
    setTuThang(thang);
    try { await load(roleRef.current, thang); } catch (e) { fail(e); }
  }, [tuThang, load, fail]);

  const setTheme = (t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t; // phần Thiết bị cơ giới
    try { localStorage.setItem("qltb-theme", t); } catch { /* bỏ qua */ }
    setThemeState(t);
  };

  const D = useMemo(() => {
    if (!raw) return null;
    const bmap = Object.fromEntries(raw.berths.map((b) => [b.ma, b]));
    datThuTuBen(raw.berths); // để ghi tàu hai bến theo chiều tuyến (B07/08)
    // Hàng đã trả: cộng vào chuyến thành kl_tra (khối lượng cần làm = khối lượng chuyến − kl_tra, xem klCanLam)
    const traBy = new Map();
    for (const t of raw.traHang || []) (traBy.get(t.voyage_id) || traBy.set(t.voyage_id, []).get(t.voyage_id)).push(t);
    const traOf = (id) => (traBy.get(id) || []).sort((a, b) => String(a.thoi_diem).localeCompare(String(b.thoi_diem)));
    const voyages = raw.voyages.map((v) => { const kl = traOf(v.id).reduce((s, t) => s + (+t.khoi_luong || 0), 0); return kl > 0 ? { ...v, kl_tra: kl } : v; });
    const vmap = new Map(voyages.map((v) => [v.id, v]));
    const stopsBy = new Map(), tienBy = new Map();
    for (const s of raw.stops) (stopsBy.get(s.voyage_id) || stopsBy.set(s.voyage_id, []).get(s.voyage_id)).push(s);
    for (const t of raw.tien) tienBy.set(t.voyage_id, t);
    const stopsOf = (id) => stopsBy.get(id) || [];
    const tienOf = (id) => tienBy.get(id) || null;
    const nguong = NGUONG_MAC_DINH;
    // Phương án làm hàng theo chuyến (null = chưa chạy SQL 15)
    const plansBy = new Map();
    for (const p of raw.plans || []) (plansBy.get(p.voyage_id) || plansBy.set(p.voyage_id, []).get(p.voyage_id)).push(p);
    const plansOf = (id) => (plansBy.get(id) || []).sort((a, b) => a.ten.localeCompare(b.ten));
    const alerts = canhBaoMo(voyages, { berths: raw.berths, stopsOf, tienOf, plansOf, coSql15: raw.plans != null, coSql19: !!raw.coSql19, nguong, now });
    return { ...raw, voyages, traOf, bmap, vmap, stopsOf, tienOf, plansOf, alerts, nguong, now, coSql15: raw.plans != null && raw.khoTon != null, coSql17: (raw.khoBai || []).some((r) => "kieu_bai" in r), coSql18: raw.dmCot != null, coSql19: !!raw.coSql19, coSql24: !!raw.coSql24, coSql25: !!raw.coSql25, coSql26: !!raw.coSql26 && raw.traHang != null, coSql28: !!raw.coSql28, coCotDan: !!raw.coCotDan, coSql21: raw.mucTieu != null, coSql27: raw.khoKeHoach != null, coSql08: raw.dmBang != null };
  }, [raw, now]);

  const bac = BAC[role?.cang] ?? -1;
  // Quyền phần Cảng (xem / nhập / quản lý / quản trị); coCang = false khi chưa chạy SQL 13 hoặc chưa được cấp
  const bk = BAC[role?.kho] ?? -1;
  // kho: quyền phân hệ Khai thác kho bãi
  const kho = { co: bk >= 0, nhap: bk >= 1, quanLy: bk >= 2, quanTri: bk >= 3 };
  const quyen = { kho, coCang: bac >= 0, nhap: bac >= 1, quanLy: bac >= 2, quanTri: bac >= 3, chuaSql: role?.loi === "chua_sql", coThietBi: !!role?.thietBi, adminTB: role?.thietBi === "quan_tri" };
  const signIn = async (email, pw) => { const s = await api.signIn(email, pw); await boot(s); };
  const signOut = async () => { await api.signOut(); setRaw(null); setPhase("login"); };

  const value = { api, phase, user, role, quyen, D, busy, reload, run, toast, fail, toasts, signIn, signOut, theme, setTheme, voyageMo, setVoyageMo, tuThang, moRongKhoang, taiLuc, capNhatRef, cheDoRef };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
