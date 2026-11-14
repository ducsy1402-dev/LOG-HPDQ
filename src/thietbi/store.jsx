import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEMO } from "./config";
import { supabaseApi } from "./api/supabaseApi";
import { demoApi } from "./api/demoApi";
import { derive, DEFAULT_T } from "./lib/compute";
import { addDays, today } from "./lib/utils";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const errMsg = (e) => {
  const m = e?.message || String(e);
  if (/row-level security|permission denied/i.test(m)) return "Tài khoản không có quyền thực hiện thao tác này";
  if (/Invalid login credentials/i.test(m)) return "Sai email hoặc mật khẩu";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại";
  return m;
};

export function AppProvider({ children }) {
  const [api, setApi] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | login | norole | ready
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [raw, setRaw] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [toasts, setToasts] = useState([]);
  const [drawer, setDrawer] = useState(null); // mã xe đang xem chi tiết
  const [theme, setThemeState] = useState(() => document.documentElement.dataset.theme || "dark");
  const loadedAt = useRef(null);
  const capNhatRef = useRef(Date.now()); // lần gần nhất biết dữ liệu còn mới (vừa tải hoặc kiểm tra không đổi)
  const dauVTRef = useRef(null);         // dấu vân tay dữ liệu lúc tải gần nhất (SQL 23)
  const cheDoRef = useRef("dinh-ky");

  const toast = useCallback((msg, tone = "ok") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "bad" ? 6000 : 3500);
  }, []);
  const fail = useCallback((e) => { console.error(e); toast("Lỗi: " + errMsg(e), "bad"); }, [toast]);

  const setTheme = (t) => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("qltb-theme", t); } catch { /* bỏ qua */ }
    setThemeState(t);
  };
  useEffect(() => { if (!document.documentElement.dataset.theme) document.documentElement.dataset.theme = "dark"; }, []);

  useEffect(() => {
    (async () => {
      const a = DEMO ? await demoApi() : supabaseApi();
      setApi(a);
    })().catch(fail);
  }, [fail]);

  const reload = useCallback(async (quiet = true) => {
    if (!api) return;
    try {
      setBusy(true);
      const t = today();
      const dvt = await api.dauVanTay?.().catch(() => null) ?? null; // lấy trước khi tải
      const r = await api.loadAll({ cutoff: addDays(t, -30 * (DEFAULT_T.luu_thang)), from: addDays(t, -1) });
      setRaw({ ...r, today: t });
      dauVTRef.current = dvt;
      cheDoRef.current = dvt != null ? "dau-van-tay" : "dinh-ky";
      loadedAt.current = new Date();
      capNhatRef.current = Date.now();
      if (!quiet) toast("Đã tải dữ liệu mới");
    } catch (e) { fail(e); } finally { setBusy(false); }
  }, [api, toast, fail]);

  const enter = useCallback(async (u) => {
    setUser(u);
    try {
      const r = await api.getRole(u.id);
      if (!r) { setPhase("norole"); return; }
      setRole(r);
      setPhase("ready");
    } catch (e) { fail(e); setPhase("login"); }
  }, [api, fail]);

  useEffect(() => {
    if (!api) return;
    api.getSession().then((s) => (s ? enter(s.user) : setPhase("login"))).catch(() => setPhase("login"));
  }, [api, enter]);

  useEffect(() => {
    if (phase !== "ready") return;
    reload();
    // Mỗi 10 giây hỏi dấu vân tay dữ liệu (SQL 23), đổi thì mới tải lại; tải lại mỗi 5 phút cho chắc. Chưa có SQL 23: tải lại mỗi 1 phút.
    let dang = false;
    const kiem = async () => {
      if (dang || document.hidden || busyRef.current) return;
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return; // đang mở hộp nhập liệu / xem thông tin: không tải lại giữa chừng
      dang = true;
      try {
        const fp = await api.dauVanTay?.().catch(() => null) ?? null;
        const tuoi = Date.now() - (loadedAt.current ? +loadedAt.current : 0);
        if (busyRef.current) return;
        if (fp != null) {
          cheDoRef.current = "dau-van-tay";
          if (fp !== dauVTRef.current || tuoi >= 300e3) await reload();
          else capNhatRef.current = Date.now();
        } else {
          cheDoRef.current = "dinh-ky";
          if (tuoi >= 60e3) await reload();
        }
      } catch { /* lượt sau thử lại */ } finally { dang = false; }
    };
    const id = setInterval(kiem, 10000);
    document.addEventListener("visibilitychange", kiem);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", kiem); };
  }, [phase, reload, api]);

  const signIn = async (email, pw) => { const s = await api.signIn(email, pw); await enter(s.user); };
  const signOut = async () => { await api.signOut(); location.reload(); };

  // Chạy một thao tác ghi, báo kết quả, tải lại dữ liệu
  const run = useCallback(async (fn, okMsg) => {
    try { await fn(); if (okMsg) toast(okMsg); await reload(); return true; } catch (e) { fail(e); return false; }
  }, [reload, toast, fail]);

  const D = useMemo(() => (raw ? derive(raw) : null), [raw]);
  if (api?.demo) window.__qltb = D; // chỉ chế độ demo: hỗ trợ kiểm thử
  const vaiTro = role?.vai_tro;
  const value = {
    api, phase, user, role, D, busy, reload, run, toast, fail, signIn, signOut, theme, setTheme,
    drawer, openVehicle: setDrawer, closeVehicle: () => setDrawer(null), toasts, loadedAt: loadedAt.current, capNhatRef, cheDoRef,
    canWrite: vaiTro === "nhap" || vaiTro === "quan_tri", isAdmin: vaiTro === "quan_tri", demo: !!api?.demo,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
