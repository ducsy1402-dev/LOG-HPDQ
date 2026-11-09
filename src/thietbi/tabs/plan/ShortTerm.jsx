import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Plus, FileText, Printer, ClipboardList, Filter, ListChecks, Clock, AlertTriangle, CheckCircle2, Truck, Link2, Info, Settings2, HardHat, Pin, PinOff, CopyPlus, FilePenLine, FileSpreadsheet, Phone, Maximize2, Minimize2, CarFront, ChevronsUp, ChevronsDown, X } from "lucide-react";
import { useApp } from "../../store";
import { docSo } from "@/lib/format";
import { Card, Kpi, Badge, Select, Search, Modal, Field, Empty, ConfirmButton, Seg, MultiSelect } from "../../components/ui";
import logo from "../../assets/logo_hpdq.png?inline";
import { laNhuCauPA } from "@/lib/phuongAn";
import {
  MIN, rulesOf, mapLoaiPt, dungLoai, dungTaiTrong, readDemandFile, buildDemands, buildShifts, caList, caKeTiep, offsets, offTxt, gioChon, dodaiNC, thieuTT, khoaNC, mauTuPC, pcTuMau,
  hm, dm, dmy, hcWindow, planWarnings, SOFT_WARN, buildSignHtml, buildToHtml, buildBPHtml, printHtml, klCua, matchPlan,
  soPT, demPT, tenPT, sortPT, DEFAULT_NHA_THAU, exportPlanExcel, laNhuCauHC, caCuaGio,
} from "../../lib/plan";
import { shortTo } from "../../lib/utils";
import MapPtDialog from "./MapPtDialog";
import NhaThauDialog from "./NhaThauDialog";
import ToTruongDialog from "./ToTruongDialog";

const iso = (x) => new Date(x).toISOString();
// Bộ lọc chọn nhiều: mảng rỗng = tất cả
const NO_F = { ca: [], bp: [], lpt: [], doi: [], to: [], st: [], q: "" };
const NHA_THAU = "Nhà thầu";

export default function ShortTerm() {
  const { D, api, run, toast, fail, canWrite, isAdmin, openVehicle, reload } = useApp();
  const P = D.plan;
  const [f, setF] = useState(NO_F);
  const [gan, setGan] = useState(null);       // nhu cầu đang gán xe
  const [demDlg, setDemDlg] = useState(null); // {} = thêm, demand = sửa
  const [imp, setImp] = useState(null);       // kết quả đọc file chờ xác nhận
  const [mapDlg, setMapDlg] = useState(false);
  const [ntDlg, setNtDlg] = useState(false);
  const [ttDlg, setTtDlg] = useState(false);
  const fileRef = useRef();

  const win = P.params.ngan_han || { winA: 30, winB: 30 };
  // Chỉ lưu 3 ngày: nhu cầu và xe đã gán của các ca đã kết thúc quá 3 ngày tự xóa.
  // Máy chủ Supabase dọn mỗi đêm (SQL 22); chưa có lịch đó (hoặc quá 26 giờ không chạy) thì web dọn khi người nhập liệu mở trang, mỗi ngày một lần.
  const [vn, setVn] = useState(undefined); // undefined = đang tải, null = chưa chạy SQL 22, mảng = nhật ký việc nền
  useEffect(() => { api.viecNenLog?.().then(setVn).catch(() => setVn(null)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const lanDon = Array.isArray(vn) ? vn.find((x) => x.viec === "don_nhu_cau" && !x.loi) : null;
  const mayChuDon = !!lanDon && Date.now() - new Date(lanDon.chay_luc).getTime() < 26 * 3600e3;
  useEffect(() => {
    if (!canWrite || vn === undefined || mayChuDon) return;
    const homNay = new Date().toDateString();
    try { if (localStorage.getItem("qltb-don-nc") === homNay) return; localStorage.setItem("qltb-don-nc", homNay); } catch { /* bỏ qua */ }
    const moc = new Date(Date.now() - 3 * 864e5).toISOString();
    api.donNhuCauCu(moc).then((n) => { if (n > 0) { toast(`Đã tự xóa ${n} nhu cầu đã kết thúc quá 3 ngày`); reload(); } }).catch(fail);
  }, [canWrite, vn, mayChuDon]); // eslint-disable-line react-hooks/exhaustive-deps
  // Xe của Phương án làm hàng nay đi vào Dài hạn (xe vận chuyển, be hầm: việc Cảng; hạ / vun hàng: việc bãi), không vào Ngắn hạn.
  // Nhu cầu mã "PA-…" do bản cũ tự đẩy sang đây: dọn các nhu cầu chưa bắt đầu và chưa gán xe (mỗi lần mở trang); nhu cầu đã gán xe giữ nguyên để người điều độ tự xử lý.
  const daDonPA = useRef(false);
  useEffect(() => {
    if (!canWrite || daDonPA.current) return;
    daDonPA.current = true;
    const dangDung = new Set(P.assignments.map((a) => `${a.ma_nhu_cau}|${new Date(a.ca_bat_dau).getTime()}`));
    const cu = P.demands.filter((d) => laNhuCauPA(d) && new Date(d.tg_bat_dau).getTime() > Date.now() && !dangDung.has(`${d.ma_nhu_cau}|${new Date(d.tg_bat_dau).getTime()}`));
    if (!cu.length) return;
    (async () => {
      for (const d of cu) await api.deleteDemand(d);
      toast(`Đã gỡ ${cu.length} nhu cầu xe do Phương án làm hàng tự đẩy trước đây (xe của phương án nay nằm ở Dài hạn)`);
      reload();
    })().catch(fail);
  }, [canWrite]); // eslint-disable-line react-hooks/exhaustive-deps
  const rules = rulesOf(D.mapPt);
  const demands = useMemo(() => P.demands.map((d) => ({ ...d, ca: iso(d.tg_bat_dau) })), [P.demands]);
  const shifts = useMemo(() => buildShifts(demands, D), [demands, D]);
  const cas = useMemo(() => caList(shifts), [shifts]);
  const shOf = (key) => shifts.find((s) => s.key === key);
  const shiftKeys = new Set(shifts.map((s) => s.key));
  const asg = useMemo(() => P.assignments.map((a) => ({ ...a, ca_bat_dau: iso(a.ca_bat_dau) })).filter((a) => shiftKeys.has(a.ca_bat_dau)), [P.assignments, shifts]); // eslint-disable-line react-hooks/exhaustive-deps
  // Cột khối lượng riêng từng xe (SQL 12). Chưa chạy SQL 12 thì chỉ xem KL nhu cầu.
  const coKL = P.assignments.some((a) => "khoi_luong" in a);
  const demOf = (ma) => demands.find((d) => d.ma_nhu_cau === ma);
  const asgOf = (d) => asg.filter((a) => a.ma_nhu_cau === d.ma_nhu_cau && a.ca_bat_dau === d.ca);
  const warn = useMemo(() => planWarnings(asg, { D, demOf, shOf, rules }), [asg, D, rules]); // eslint-disable-line react-hooks/exhaustive-deps

  // Khóa sắp xếp theo tổ: xe nhà thầu xếp sau xe nội bộ
  const toKey = (a) => (a.nha_thau ? "\uffff" + a.nha_thau : D.vmap[a.ma_xe]?.to_xe || "");
  const nhaThau = D.nhaThau?.list?.length ? D.nhaThau.list : DEFAULT_NHA_THAU;

  // ---- lọc (mỗi trường chọn được nhiều giá trị; trạng thái: khớp một trong các trạng thái đã chọn) ----
  const coCanhBao = (a) => (warn.get(a.id) || []).length > 0;
  const stPass = (d, a) => {
    if (!f.st.length) return true;
    const n = demPT(asgOf(d));
    return (f.st.includes("chua_gan") && n === 0) || (f.st.includes("thieu") && n < d.so_pt) || (f.st.includes("du") && n >= d.so_pt)
      || (f.st.includes("canh_bao") && (a ? coCanhBao(a) : asgOf(d).some(coCanhBao)))
      || (f.st.includes("thieu_tt") && thieuTT(d).length > 0);
  };
  const has = (arr, v) => !arr.length || arr.includes(v);
  // Đội / tổ của một dòng phân công (xe nhà thầu: đội theo loại PT yêu cầu, tổ = "Nhà thầu")
  const mpOf = (d) => mapLoaiPt(d.loai_pt, rules, D.taiTrongList);
  const doiPC = (a, d) => (a.nha_thau ? mpOf(d)?.doi : D.vmap[a.ma_xe]?.doi);
  const toPC = (a) => (a.nha_thau ? NHA_THAU : D.vmap[a.ma_xe]?.to_xe || "(Chưa có tổ)");
  const demPass = (d) => {
    if (!has(f.ca, shOf(d.ca)?.g)) return false;
    if (!has(f.bp, d.bp_yeu_cau) || !has(f.lpt, d.loai_pt) || !stPass(d)) return false;
    if (f.doi.length && !f.doi.includes(mpOf(d)?.doi) && !asgOf(d).some((a) => f.doi.includes(doiPC(a, d)))) return false;
    if (f.to.length && !asgOf(d).some((a) => f.to.includes(toPC(a)))) return false;
    return matchPlan(f.q, d.noi_dung, d.vi_tri_bd, d.vi_tri_kt, d.loai_hang, d.bp_yeu_cau, asgOf(d).map(tenPT).join(" "));
  };
  const shownDem = demands.filter(demPass).sort((a, b) => a.ca.localeCompare(b.ca) || String(a.stt).localeCompare(String(b.stt), "vi", { numeric: true }));
  const shownAsg = asg.filter((a) => {
    const d = demOf(a.ma_nhu_cau); if (!d) return false;
    if (!has(f.ca, shOf(a.ca_bat_dau)?.g)) return false;
    if (!has(f.bp, d.bp_yeu_cau) || !has(f.lpt, d.loai_pt) || !stPass(d, a)) return false;
    if (!has(f.doi, doiPC(a, d)) || !has(f.to, toPC(a))) return false;
    return matchPlan(f.q, a.ma_xe, a.nha_thau, d.noi_dung, d.vi_tri_bd, d.vi_tri_kt, a.ghi_chu);
  }).sort((a, b) => a.ca_bat_dau.localeCompare(b.ca_bat_dau) || toKey(a).localeCompare(toKey(b), "vi") || sortPT(a, b) || a.bat_dau_phut - b.bat_dau_phut);
  const uniqS = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));

  // ---- Nhu cầu lặp lại: mẫu cố định (SQL 10) và kế thừa sang ca tới ----
  const coDinh = P.coDinh; // null = chưa chạy SQL 10
  // Mẫu cố định áp cho MỌI ca (CA 1, CA 2) khi nhu cầu giống, cho đến khi bỏ ghim
  const mauOf = (d) => coDinh?.find((m) => m.khoa === khoaNC(d));
  const choCoDinh = coDinh ? demands.filter((d) => !asgOf(d).length && mauOf(d)) : [];
  // Dựng các dòng phân công từ danh sách xe mẫu; bỏ qua xe đang hỏng / BD chiến lược
  // (xe HC trong mẫu vẫn gán: người dùng đã chủ động mượn, dòng kế hoạch có cảnh báo mềm "Mượn xe HC")
  const dungDong = (xe, d) => {
    const rows = [], boQua = [];
    for (const x of xe) {
      if (x.ma_xe && !D.isReady(x.ma_xe)) boQua.push(`${x.ma_xe} (hỏng / BD)`);
      else rows.push(pcTuMau(x, d));
    }
    return { rows, boQua };
  };
  const apDungCoDinh = async (ds) => {
    let rows = [], boQua = [];
    for (const d of ds) { const r = dungDong(mauOf(d).xe, d); rows = rows.concat(r.rows); boQua = boQua.concat(r.boQua); }
    if (!rows.length) return toast(`Không có xe nào gán được: ${boQua.join(", ")}`, "bad");
    await run(() => api.insertAssignments(rows), `Đã gán theo mẫu cố định cho ${ds.length} nhu cầu${boQua.length ? `, bỏ qua: ${boQua.join(", ")}` : ""}`);
  };
  // Tự gán theo mẫu cố định mỗi khi có nhu cầu giống mẫu mà chưa có xe (sau khi nhập file, mở trang, đặt ghim mới).
  // Chỉ tự gán nhu cầu chưa từng có xe trong phiên: nhu cầu đã có xe (kể cả vừa bị gỡ) hoặc đã tự gán thì bỏ qua.
  const daTuGan = useRef(new Set());
  useEffect(() => {
    for (const d of demands) if (asgOf(d).length) daTuGan.current.add(d.id);
    if (!canWrite || !choCoDinh.length) return;
    const moi = choCoDinh.filter((d) => !daTuGan.current.has(d.id));
    if (!moi.length) return;
    moi.forEach((d) => daTuGan.current.add(d.id));
    apDungCoDinh(moi);
  }, [P.demands, P.assignments, coDinh]); // eslint-disable-line react-hooks/exhaustive-deps
  // So mẫu với xe đang gán: chỉ so mã xe / nhà thầu và số lượng (không so giờ, ghi chú)
  const xeKhoa = (xs) => xs.map((x) => `${x.ma_xe || x.nha_thau}×${x.nha_thau ? x.so_luong || 1 : 1}`).sort().join(",");
  const giongMau = (d, m) => xeKhoa(asgOf(d).map(mauTuPC)) === xeKhoa(m.xe);
  const datCoDinh = async (d) => {
    const as = asgOf(d);
    if (!as.length) return toast("Gán xe cho nhu cầu trước rồi mới đặt cố định", "bad");
    await run(() => api.upsertCoDinh({ khoa: khoaNC(d), ca_so: 0, mo_ta: { bp_yeu_cau: d.bp_yeu_cau, loai_pt: d.loai_pt, noi_dung: d.noi_dung, vi_tri_bd: d.vi_tri_bd, vi_tri_kt: d.vi_tri_kt }, xe: as.map(mauTuPC) }),
      `Đã cố định ${as.map(tenPT).join(", ")}: nhu cầu giống ở mọi ca sẽ tự gán các xe này cho đến khi bỏ ghim.`);
  };
  // Bỏ ghim: xóa mọi mẫu của nhu cầu này
  const boCoDinh = async (d) => {
    const ms = coDinh.filter((m) => m.khoa === khoaNC(d));
    await run(async () => { for (const m of ms) await api.deleteCoDinh(m.id); }, "Đã bỏ cố định: nhu cầu giống sẽ không tự gán nữa");
  };
  // Kế thừa: nếu ca sau có nhu cầu giống (cùng khóa) thì gán xe sang nhu cầu đó;
  // không có thì tạo bản sao nhu cầu (thủ công) ở ca kế tiếp theo lịch và gán các xe. Áp dụng cho mọi nhu cầu.
  const keThuaDich = (d) => {
    const sh = shOf(d.ca); if (!sh) return null;
    const k = khoaNC(d);
    const hc = laNhuCauHC(d); // nhu cầu hành chính (nằm trong CA 1): chỉ kế thừa sang CA 1 các ngày làm việc sau
    for (const c of cas) {
      if (c.start <= sh.gStart || (sh.so === "HC") !== (c.so === "HC") || (hc && c.so !== 1)) continue;
      const ds = demands.filter((x) => x.id !== d.id && shOf(x.ca)?.g === c.key && khoaNC(x) === k);
      if (ds.length) return { ca: c, d: ds.find((x) => !asgOf(x).length) || null };
    }
    return { ca: hc ? ca1NgayLamViecSau(sh) : caKeTiep(sh, D), d: null, taoMoi: true };
  };
  // CA 1 của ngày làm việc kế tiếp (bỏ Chủ nhật) cho nhu cầu hành chính
  const ca1NgayLamViecSau = (sh) => {
    let t = new Date(sh.gStart);
    do t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 12); while (t.getDay() === 0);
    const c = caCuaGio(t.getTime(), D), tay = (D.cakip || []).find((x) => x.ngay === c.ngay && x.ca === c.ten)?.kip;
    return { key: new Date(c.start).toISOString(), start: c.start, end: c.end, so: 1, ngay: c.ngay, label: `CA 1${tay || D.kipTheoLich(c.ngay, 1)}` };
  };
  const COT_NC = ["stt", "hinh_thuc", "hang_muc", "loai_pt", "bp_yeu_cau", "loai_hang", "noi_dung", "khoi_luong", "dvt", "ca_kip", "vi_tri_bd", "vi_tri_kt", "muc_do", "so_pt", "so_chuyen", "dau_moi", "sdt_dau_moi"];
  const keThua = async (d) => {
    const t = keThuaDich(d), sh = shOf(d.ca);
    if (!t || !sh) return;
    const noiCa = `${t.ca.label} · ${dm(t.ca.start)}`;
    if (!t.taoMoi && !t.d) return toast(`Nhu cầu giống ở ${noiCa} đã có xe`, "bad");
    const xe = asgOf(d).map(mauTuPC);
    if (!t.taoMoi) {
      if (!xe.length) return toast("Nhu cầu này chưa gán xe nên chưa có gì để kế thừa", "bad");
      const r = dungDong(xe, t.d);
      if (!r.rows.length) return toast("Các xe đều đang hỏng / BD, không kế thừa được", "bad");
      return run(() => api.insertAssignments(r.rows), `Đã kế thừa ${r.rows.length} dòng xe sang ${noiCa}${r.boQua.length ? `, bỏ qua ${r.boQua.join(", ")}` : ""}`);
    }
    // Tạo nhu cầu ở ca kế tiếp: giữ khoảng lệch so với đầu ca và thời lượng của nhu cầu gốc
    const bd = t.ca.start + (new Date(d.tg_bat_dau).getTime() - sh.gStart), dai = new Date(d.tg_ket_thuc) - new Date(d.tg_bat_dau);
    const rec = { ...Object.fromEntries(COT_NC.map((k) => [k, d[k] ?? null])), ma_nhu_cau: "KT-" + Date.now().toString(36).toUpperCase(), tg_bat_dau: new Date(bd).toISOString(), tg_ket_thuc: new Date(bd + dai).toISOString() };
    const r = dungDong(xe, rec);
    await run(async () => { await api.insertDemand(rec); if (r.rows.length) await api.insertAssignments(r.rows); },
      `Đã kế thừa sang ${noiCa}: tạo nhu cầu mới${r.rows.length ? ` và gán ${r.rows.map(tenPT).join(", ")}` : ""}${r.boQua.length ? `, bỏ qua ${r.boQua.join(", ")}` : ""}`);
  };
  const nThieuTT = demands.filter((d) => thieuTT(d).length).length;

  const need = shownDem.reduce((x, d) => x + d.so_pt, 0);
  const got = shownDem.reduce((x, d) => x + Math.min(d.so_pt, demPT(asgOf(d))), 0);
  const nWarn = asg.filter((a) => (warn.get(a.id) || []).some((w) => !SOFT_WARN.has(w))).length;

  // ---- nhập file ----
  const pickFile = async (file) => {
    if (!file) return;
    try {
      const res = buildDemands(await readDemandFile(file));
      if (res.error) return toast(res.error, "bad");
      const shs = buildShifts(res.rows.map((d) => ({ ...d, ca: d.tg_bat_dau })), D);
      setImp({ file: file.name, rows: res.rows, skip: res.skip, shifts: shs, cas: caList(shs) });
    } catch (e) { fail(e); }
  };
  const doImport = async () => {
    let r;
    const ok = await run(async () => { r = await api.importDemands(imp.file, imp.rows, win); });
    if (ok) {
      toast(`Đã nhập ${imp.rows.length} nhu cầu. Giữ ${r?.kept ?? 0} phân công, bỏ ${r?.dropped ?? 0} phân công của nhu cầu không còn trong file${r?.moved ? `, chuyển ca ${r.moved}` : ""}.`);
      setImp(null); setF(NO_F);
    }
  };

  const doPrint = async (kind) => {
    // In đúng các dòng đang hiển thị ở bảng "Kế hoạch đã gán xe" (theo bộ lọc)
    if (!shownAsg.length) return toast(asg.length ? "Không có dòng kế hoạch nào khớp bộ lọc để xuất" : "Chưa có xe nào được gán, chưa có gì để xuất", "bad");
    try {
      const x = { asgs: shownAsg, demOf, shOf, D };
      const html = kind === "ky" ? buildSignHtml({ ...x, logo }) : kind === "bp" ? buildBPHtml(x) : buildToHtml(x);
      toast('Hộp thoại in đang mở: chọn máy in "Lưu dưới dạng PDF" (đã đặt sẵn A4 ngang) rồi bấm Lưu.');
      await printHtml(html);
    } catch (e) { fail(e); }
  };

  const doExcel = async (ky, to, bp) => {
    if (!shownAsg.length) return toast(asg.length ? "Không có dòng kế hoạch nào khớp bộ lọc để xuất" : "Chưa có xe nào được gán, chưa có gì để xuất", "bad");
    const ten = [ky && "trình ký", to && "theo tổ", bp && "theo BPSD"].filter(Boolean).join(" + ");
    try { await exportPlanExcel({ asgs: shownAsg, demOf, shOf, D, ky, to, bp }); toast(`Đã xuất Excel ${ten} (${shownAsg.length} dòng)`); } catch (e) { fail(e); }
  };

  // Xe có kế hoạch / xe còn lại theo bộ lọc ca, đội, tổ: xe sẵn sàng trong phạm vi lọc, tính riêng từng ca
  const xePham = D.vehicles.filter((v) => D.isReady(v.ma) && has(f.doi, v.doi) && has(f.to, v.to_xe || "(Chưa có tổ)"));
  const theoCa = cas.filter((c) => has(f.ca, c.key)).map((c) => {
    const trongCa = shownAsg.filter((a) => shOf(a.ca_bat_dau)?.g === c.key);
    const ma = new Set(trongCa.filter((a) => !a.nha_thau).map((a) => a.ma_xe));
    const coKH = xePham.filter((v) => ma.has(v.ma)).length;
    return { c, coKH: ma.size, con: xePham.length - coKH, nt: trongCa.filter((a) => a.nha_thau).reduce((x, a) => x + soPT(a), 0) };
  });
  const motCa = theoCa.length === 1 ? theoCa[0] : null;

  // Khối nhu cầu: phóng to toàn màn hình (Esc để thoát)
  const [toanMH, setToanMH] = useState(false);
  // Thu gọn khay bộ lọc để bảng nhu cầu hiện được nhiều dòng hơn (nhớ theo máy)
  const [gonLoc, setGonLocState] = useState(() => { try { return localStorage.getItem("qltb-st-gon-loc") === "1"; } catch { return false; } });
  const setGonLoc = (v) => { setGonLocState(v); try { localStorage.setItem("qltb-st-gon-loc", v ? "1" : "0"); } catch { /* bỏ qua */ } };
  // Tóm tắt bộ lọc đang dùng (hiện khi thu gọn); bấm × để bỏ từng bộ lọc
  const ST_TEN = { chua_gan: "Chưa gán", thieu: "Còn thiếu xe", du: "Đã đủ xe", canh_bao: "Có cảnh báo", thieu_tt: "Thiếu thông tin" };
  const locDung = [
    ["ca", "Ca", f.ca.map((k) => { const c = cas.find((x) => x.key === k); return c ? `${c.label} · ${dm(c.start)}` : k; })],
    ["bp", "Bộ phận", f.bp], ["lpt", "Loại PT", f.lpt], ["doi", "Đội", f.doi], ["to", "Tổ", f.to], ["st", "Trạng thái", f.st.map((x) => ST_TEN[x] || x)],
  ].filter(([, , v]) => v.length);
  useEffect(() => {
    if (!toanMH) return;
    const k = (e) => e.key === "Escape" && !document.querySelector(".modal") && setToanMH(false);
    document.addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [toanMH]);

  const saveWin = (k, v) => run(() => api.savePlanParams("ngan_han", { ...win, [k]: Math.max(0, Number(v) || 0) }), "Đã lưu giờ làm việc");

  return (
    <>
      <Card toanManHinh={false} className={"mb nc-khoi" + (toanMH ? " card-fs" : "")} title={`Nhu cầu công việc (${shownDem.length}/${demands.length})`} icon={ClipboardList}
        right={<>
          {nThieuTT > 0 && <button className="btn sm" onClick={() => setF({ ...NO_F, st: ["thieu_tt"] })}><AlertTriangle size={14} className="warn" />{nThieuTT} nhu cầu thiếu thông tin</button>}
          <button className="btn sm ghost" onClick={() => setF(NO_F)} title="Bỏ toàn bộ bộ lọc"><Filter size={14} />Bỏ lọc</button>
          <button className="btn sm" onClick={() => setGonLoc(!gonLoc)} title={gonLoc ? "Mở khay bộ lọc" : "Thu gọn khay bộ lọc để xem được nhiều dòng hơn"} aria-expanded={!gonLoc}>
            {gonLoc ? <ChevronsDown size={14} /> : <ChevronsUp size={14} />}{gonLoc ? `Mở bộ lọc${locDung.length ? ` (${locDung.length})` : ""}` : "Thu gọn bộ lọc"}</button>
          <button className="btn sm" onClick={() => setToanMH((x) => !x)} title={toanMH ? "Thu nhỏ (Esc)" : "Toàn màn hình"} aria-label={toanMH ? "Thu nhỏ" : "Toàn màn hình"}>
            {toanMH ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{toanMH ? "Thu nhỏ" : "Toàn màn hình"}</button>
        </>}>
        <div className="st-bar nc-bar">
        {canWrite && <><input ref={fileRef} type="file" accept=".xlsx,.xls" hidden style={{ display: "none" }} onChange={(e) => { pickFile(e.target.files[0]); e.target.value = ""; }} />
          <button className="btn pri sm" onClick={() => fileRef.current.click()}><Upload size={14} />Nhập file nhu cầu</button>
          <button className="btn sm" onClick={() => setDemDlg({})}><Plus size={14} />Nhu cầu thủ công</button></>}
        {isAdmin && <button className="btn sm" onClick={() => setMapDlg(true)}><Settings2 size={14} />Ánh xạ loại PT</button>}
        <button className="btn sm" onClick={() => setNtDlg(true)}><HardHat size={14} />Nhà thầu</button>
        <button className="btn sm" onClick={() => setTtDlg(true)} title="Số điện thoại tổ trưởng từng kíp, in ở cột SĐT của PDF theo BPSD"><Phone size={14} />SĐT tổ trưởng</button>
        {canWrite && coDinh && <button className={"btn sm" + (choCoDinh.length ? " pri" : "")} disabled={!choCoDinh.length} onClick={() => apDungCoDinh(choCoDinh)}
          title={`${coDinh.length} nhu cầu đang cố định. Nhu cầu giống ở mọi ca mà chưa có xe sẽ được gán theo mẫu (tự chạy sau khi nhập file).`}><Pin size={14} />Gán cố định ({choCoDinh.length})</button>}
        <span className="spacer" />
        <span className="small mute" title={mayChuDon ? `Máy chủ Supabase tự dọn nhu cầu quá 3 ngày mỗi đêm (03:00). Lần cuối ${new Date(lanDon.chay_luc).toLocaleString("vi-VN")}: xóa ${lanDon.ket_qua?.nhu_cau_da_xoa ?? 0} nhu cầu, ${lanDon.ket_qua?.phan_cong_da_xoa ?? 0} dòng gán xe.` : "Chưa có lịch dọn trên máy chủ (SQL 22): web dọn khi người nhập liệu mở trang này, mỗi ngày một lần."}>{mayChuDon ? `Dọn tự động: máy chủ, ${new Date(lanDon.chay_luc).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}` : "Dọn tự động: khi mở trang"}</span>
        <span className="small mute row" style={{ gap: 6 }} title={`Xe đi ca làm ${D.gioLam["Đi ca"]}h; xe HC làm 07:30–17:00 (${D.gioLam.HC}h), thứ 2 – thứ 7. Nhập file mới sẽ thay toàn bộ danh sách nhu cầu; phân công của nhu cầu còn trong file mới (theo Mã nhu cầu) được giữ lại.`}>
          <Clock size={14} />Giờ làm: đầu ca +
          {isAdmin ? <input className="inp sm num mono" type="number" min="0" step="15" defaultValue={win.winA} onBlur={(e) => +e.target.value !== win.winA && saveWin("winA", e.target.value)} style={{ width: 56 }} aria-label="Phút lùi đầu ca" /> : <b>{win.winA}</b>}
          phút, cuối ca −
          {isAdmin ? <input className="inp sm num mono" type="number" min="0" step="15" defaultValue={win.winB} onBlur={(e) => +e.target.value !== win.winB && saveWin("winB", e.target.value)} style={{ width: 56 }} aria-label="Phút lùi cuối ca" /> : <b>{win.winB}</b>}
          phút
        </span>
        {P.batch?.file_name && <span className="small mute">· File: <b>{P.batch.file_name}</b></span>}
        </div>
        {gonLoc ? (
          <div className="row nc-gon">
            <Search value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Nội dung, vị trí, mã xe, nhà thầu…" style={{ width: 280 }} />
            {locDung.length ? locDung.map(([k, ten, v]) => (
              <span key={k} className="badge b-accent plain loc-chip" title={v.join(", ")}>{ten}: {v.length > 2 ? `${v.slice(0, 2).join(", ")} +${v.length - 2}` : v.join(", ")}
                <button type="button" onClick={() => setF({ ...f, [k]: [] })} aria-label={`Bỏ lọc ${ten}`}><X size={11} /></button></span>
            )) : <span className="small mute">Đang xem tất cả nhu cầu</span>}
          </div>
        ) : <>
        <div className="form-grid nc-loc">
          <Field label="Ca"><MultiSelect value={f.ca} onChange={(v) => setF({ ...f, ca: v })} options={cas.map((c) => [c.key, `${c.label} · ${dm(c.start)}`])} /></Field>
          <Field label="Bộ phận sử dụng"><MultiSelect value={f.bp} onChange={(v) => setF({ ...f, bp: v })} options={uniqS(demands.map((d) => d.bp_yeu_cau))} /></Field>
          <Field label="Loại phương tiện"><MultiSelect value={f.lpt} onChange={(v) => setF({ ...f, lpt: v })} options={uniqS(demands.map((d) => d.loai_pt))} /></Field>
          <Field label="Đội xe"><MultiSelect value={f.doi} onChange={(v) => setF({ ...f, doi: v })} options={D.doiList} /></Field>
          <Field label="Tổ"><MultiSelect value={f.to} onChange={(v) => setF({ ...f, to: v })} options={[...D.toList, NHA_THAU]} /></Field>
          <Field label="Trạng thái"><MultiSelect value={f.st} onChange={(v) => setF({ ...f, st: v })} options={[["chua_gan", "Nhu cầu chưa gán"], ["thieu", "Nhu cầu còn thiếu xe"], ["du", "Nhu cầu đã đủ xe"], ["canh_bao", "Kế hoạch có cảnh báo"], ["thieu_tt", "Nhu cầu thiếu thông tin"]]} /></Field>
          <Field label="Tìm"><Search value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Nội dung, vị trí, mã xe, nhà thầu…" /></Field>
        </div>
        </>}
        {canWrite && !gonLoc && <div className="small mute" style={{ margin: "2px 0 8px" }}>Gán xe · Kế thừa (<CopyPlus size={12} />): chép xe sang nhu cầu giống ở ca tới gần nhất · Cố định (<Pin size={12} />): nhu cầu giống ở mọi ca tự gán các xe này, đến khi bỏ ghim</div>}
        {shownDem.length ? (
          <div className="tw nc-tw" style={{ maxHeight: gonLoc ? "max(520px, calc(100vh - 230px))" : 520 }}>
            <table className="t">
              <thead><tr><th>Ca</th><th>STT</th><th>BP</th><th>Loại phương tiện</th><th>Nội dung</th><th>Điểm đi → đến</th><th className="n">KL</th><th>Mức độ</th><th className="n">Gán / cần</th><th>Xe đã gán</th><th className="act"></th></tr></thead>
              <tbody>
                {shownDem.map((d) => {
                  const as = asgOf(d).sort(sortPT), n = demPT(as), mp = mapLoaiPt(d.loai_pt, rules, D.taiTrongList);
                  const thieu = thieuTT(d), mau = mauOf(d), kt = keThuaDich(d);
                  return (
                    <tr key={d.id}>
                      <td className="mono">{shOf(d.ca)?.label}</td>
                      <td className="mono">{d.stt}</td>
                      <td>{d.bp_yeu_cau}</td>
                      <td>{d.loai_pt}<div className="small mute">{mp ? `→ ${mp.doi}${mp.taiTrong ? " " + mp.taiTrong.join("/") : ""}` : <span className="warn">chưa ánh xạ</span>}</div></td>
                      <td className="wrap" style={{ maxWidth: 340 }}><b>{d.noi_dung}</b>{d.loai_hang && <div className="small mute">{d.loai_hang}</div>}{d.thu_cong && <Badge tone="accent" plain>thủ công</Badge>}
                        {thieu.length > 0 && <div><Badge tone="warn" plain>Thiếu: {thieu.join(", ")}</Badge></div>}
</td>
                      <td className="wrap" style={{ minWidth: 150 }}>{d.vi_tri_bd}{d.vi_tri_kt && d.vi_tri_kt !== d.vi_tri_bd ? " → " + d.vi_tri_kt : ""}</td>
                      <td className="n">{d.khoi_luong ?? ""} <span className="mute small">{d.dvt}</span></td>
                      <td className={d.muc_do === "Cao" ? "bad" : ""}>{d.muc_do}</td>
                      <td className={"n " + (n >= d.so_pt ? "ok" : n ? "warn" : "mute")}><b>{n}/{d.so_pt}</b></td>
                      <td className="wrap" style={{ minWidth: 110 }}>{mau && <span title={`Cố định mọi ca: ${mau.xe.map((x) => x.nha_thau ? `${x.nha_thau} × ${x.so_luong || 1}` : x.ma_xe).join(", ")}`} style={{ marginRight: 6 }}><Badge tone="accent" plain><Pin size={11} />cố định</Badge></span>}{as.map((a) => a.nha_thau
                        ? <span key={a.id} style={{ marginRight: 6 }}><Badge tone="orange" plain>{tenPT(a)}</Badge></span>
                        : <button key={a.id} className="ma" style={{ marginRight: 6 }} onClick={() => openVehicle(a.ma_xe)}>{a.ma_xe}</button>)}</td>
                      <td className="act">
                        <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                          {canWrite && <button className="btn sm pri" onClick={() => setGan(d)}>Gán xe</button>}
                          {canWrite && kt && <button className="btn sm icon" disabled={!kt.taoMoi && !kt.d} onClick={() => keThua(d)}
                            title={kt.taoMoi ? `Kế thừa: tạo nhu cầu này ở ${kt.ca.label} · ${dm(kt.ca.start)}${as.length ? ` và gán ${as.map(tenPT).join(", ")}` : ""}`
                              : kt.d ? `Kế thừa: chép ${as.length} dòng xe sang nhu cầu giống ở ${kt.ca.label} · ${dm(kt.ca.start)}` : `Nhu cầu giống ở ${kt.ca.label} · ${dm(kt.ca.start)} đã có xe`}><CopyPlus size={14} /></button>}
                          {canWrite && coDinh && (as.length || mau) ? (mau
                            ? <button className={"btn sm icon" + (giongMau(d, mau) ? " on-pin" : "")} title={giongMau(d, mau) ? "Đang cố định cho mọi ca. Bấm để bỏ ghim" : "Xe đang gán khác mẫu cố định. Bấm để bỏ ghim, hoặc bấm \"Cập nhật mẫu\""}
                                onClick={() => boCoDinh(d)}><PinOff size={14} /></button>
                            : <button className="btn sm icon" title="Cố định: nhu cầu giống (cùng bộ phận, loại PT, nội dung, điểm đi, điểm đến) ở mọi ca tự gán các xe này, đến khi bỏ ghim" onClick={() => datCoDinh(d)}><Pin size={14} /></button>) : null}
                          {canWrite && mau && !giongMau(d, mau) && as.length > 0 && <button className="btn sm" title="Cập nhật mẫu cố định theo các xe đang gán" onClick={() => datCoDinh(d)}>Cập nhật mẫu</button>}
                          {canWrite && <button className="btn sm" onClick={() => setDemDlg(d)} title={thieu.length ? `Sửa / bổ sung: còn thiếu ${thieu.join(", ")}` : "Sửa thông tin nhu cầu"}><FilePenLine size={14} />Sửa</button>}
                          {canWrite && d.thu_cong && <ConfirmButton onConfirm={() => run(() => api.deleteDemand(d), "Đã xóa nhu cầu")} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>{demands.length ? "Không có nhu cầu phù hợp bộ lọc." : "Chưa có nhu cầu."}</Empty>}
      </Card>

      <Card title={`Kế hoạch đã gán xe (${shownAsg.length})`} icon={ListChecks} hint="Sắp theo ca, tổ, mã xe; xe nhà thầu xếp cuối ca. PDF in đúng các dòng đang hiển thị (theo bộ lọc)."
        right={<>
          <button className="btn sm" onClick={() => doPrint("ky")}><FileText size={14} />PDF trình ký</button>
          <button className="btn sm" onClick={() => doPrint("to")}><Printer size={14} />PDF theo tổ</button>
          <button className="btn sm" onClick={() => doPrint("bp")} title="Nhóm theo bộ phận sử dụng; cột SĐT là SĐT tổ trưởng của tổ xe theo kíp của ca"><Printer size={14} />PDF theo BPSD</button>
          <XuatExcel onXuat={doExcel} />
        </>}>
        {shownAsg.length ? (
          <div className="tw" style={{ maxHeight: 560 }}>
            <table className="t">
              <thead><tr><th>Ca</th><th>Tổ</th><th>Mã xe</th><th>Loại xe</th><th>Nội dung</th><th>Điểm đi → đến</th><th className="n">KL</th><th>Từ</th><th>Đến</th><th>Ghi chú</th><th>Cảnh báo</th><th className="act"></th></tr></thead>
              <tbody>
                {shownAsg.map((a) => <PlanRow key={a.id} a={a} d={demOf(a.ma_nhu_cau)} sh={shOf(a.ca_bat_dau)} warns={warn.get(a.id) || []} coKL={coKL} />)}
              </tbody>
            </table>
          </div>
        ) : <Empty>{asg.length ? "Không có dòng phù hợp bộ lọc." : "Chưa gán xe nào."}</Empty>}
      </Card>

      {gan && <GanDialog d={gan} sh={shOf(gan.ca)} win={win} rules={rules} asg={asg} asgOf={asgOf} nhaThau={nhaThau} onClose={() => setGan(null)} onBoSung={() => { setDemDlg(gan); setGan(null); }} />}
      {ntDlg && <NhaThauDialog list={nhaThau} onClose={() => setNtDlg(false)} />}
      {ttDlg && <ToTruongDialog onClose={() => setTtDlg(false)} />}
      {demDlg && <DemandDialog d={demDlg.id ? demDlg : null} cas={cas} win={win} asg={asg} onClose={() => setDemDlg(null)} />}
      {mapDlg && <MapPtDialog demands={demands} onClose={() => setMapDlg(false)} />}
      {imp && (
        <Modal title={<span className="row" style={{ gap: 8 }}><Upload size={16} />Nhập file nhu cầu</span>} onClose={() => setImp(null)} width={640}
          footer={<><button className="btn" onClick={() => setImp(null)}>Hủy</button><button className="btn pri" onClick={doImport}><CheckCircle2 size={15} />Thay danh sách nhu cầu</button></>}>
          <div className="balance">
            <div className="bal ok"><div className="d">Nhu cầu đọc được</div><div className="big ok">{imp.rows.length}</div></div>
            <div className="bal"><div className="d">Số ca</div><div className="big">{imp.cas.length}</div></div>
            <div className={"bal " + (imp.skip ? "bad" : "")}><div className="d">Dòng bỏ qua (thiếu giờ/nội dung)</div><div className="big">{imp.skip}</div></div>
          </div>
          <div className="tw short mb"><table className="t"><thead><tr><th>Ca</th><th>Ngày</th><th>Giờ</th><th className="n">Nhu cầu</th></tr></thead>
            <tbody>{imp.cas.map((c) => { const ks = new Set(imp.shifts.filter((s) => s.g === c.key).map((s) => s.key)); return <tr key={c.key}><td className="mono"><b>{c.label}</b></td><td>{dmy(c.start)}</td><td className="mono">{hm(c.start)} → {hm(c.end)}</td><td className="n">{imp.rows.filter((r) => ks.has(r.tg_bat_dau)).length}</td></tr>; })}</tbody></table></div>
          <div className="alert warn"><Info size={16} /><span>File <b>{imp.file}</b> sẽ <b>thay toàn bộ</b> danh sách nhu cầu hiện tại{P.batch ? ` (${P.batch.file_name})` : ""}. Phân công của nhu cầu còn trong file mới được giữ, phân công của nhu cầu không còn sẽ bị bỏ.</span></div>
        </Modal>
      )}
    </>
  );
}

// Khối lượng riêng của một dòng xe. Để trống = dùng khối lượng của nhu cầu.
function KlO({ a, d, upd, sua }) {
  const kl = klCua(a, d), rieng = a.khoi_luong != null;
  const goc = d.khoi_luong == null || d.khoi_luong === "" ? null : Number(d.khoi_luong);
  const luu = (val) => {
    const moiS = val.trim() === "" ? null : docSo(val) ?? NaN;
    let moi = moiS;
    if (moi != null && (!Number.isFinite(moi) || moi < 0)) return;
    if (moi === goc) moi = null; // bằng KL nhu cầu thì quay về dùng KL nhu cầu
    if (moi !== (a.khoi_luong ?? null)) upd({ khoi_luong: moi }, moi == null ? "Đã trả khối lượng về theo nhu cầu" : "Đã lưu khối lượng của xe");
  };
  if (!sua) return <>{kl ?? ""} <span className="mute small">{d.dvt}</span>{rieng && <div className="small mute">NC {goc ?? "—"}</div>}</>;
  return (
    <>
      <input key={`${a.id}-${a.khoi_luong}`} className="inp sm num mono" type="number" min="0" step="any" defaultValue={kl ?? ""} placeholder="—" style={{ width: 74, ...(rieng ? { borderColor: "var(--accent)" } : null) }}
        title={rieng ? `KL riêng của xe này. KL nhu cầu: ${goc ?? "chưa có"} (xóa trống để dùng lại KL nhu cầu)` : "Khối lượng của nhu cầu. Sửa để ghi KL riêng cho xe này"}
        aria-label="Khối lượng" onBlur={(e) => luu(e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
      {" "}<span className="mute small">{d.dvt}</span>{rieng && <div className="small mute">NC {goc ?? "—"}</div>}
    </>
  );
}

// Một dòng kế hoạch: sửa giờ, ghi chú, khối lượng, gỡ xe
function PlanRow({ a, d, sh, warns, coKL }) {
  const { D, api, run, canWrite, openVehicle } = useApp();
  const v = D.vmap[a.ma_xe];
  const opts = () => gioChon(sh, a.bat_dau_phut, a.ket_thuc_phut).map((o) => [String(o), offTxt(sh, o)]);
  const upd = (patch, msg) => run(() => api.updateAssignment(a.id, patch), msg);
  const hard = warns.filter((w) => !SOFT_WARN.has(w));
  const nt = !!a.nha_thau;
  return (
    <tr style={hard.length ? { background: "color-mix(in srgb, var(--bad) 7%, transparent)" } : undefined}>
      <td className="mono">{sh?.label}</td>
      <td>{nt ? <Badge tone="orange" plain>Nhà thầu</Badge> : shortTo(v?.to_xe)}</td>
      <td>{nt ? <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}><b>{a.nha_thau}</b>
        {canWrite ? <input className="inp sm num mono" type="number" min="1" title="Số xe" defaultValue={soPT(a)} style={{ width: 56 }}
          onBlur={(e) => { const n = Math.max(1, parseInt(e.target.value, 10) || 1); if (n !== soPT(a)) upd({ so_luong: n }, "Đã đổi số xe nhà thầu"); }} /> : <span className="mono">× {soPT(a)}</span>}</span>
        : <button className="ma" onClick={() => openVehicle(a.ma_xe)}>{a.ma_xe}</button>}</td>
      <td className="small">{nt ? <span className="mute">{d.loai_pt}</span> : v ? <>{v.doi}{v.tai_trong ? ` · ${v.tai_trong}` : ""}<div className="mute">{v.model}</div></> : ""}</td>
      <td className="wrap" style={{ maxWidth: 300 }}>{d.noi_dung}<div className="small mute">{d.bp_yeu_cau}</div></td>
      <td className="wrap" style={{ minWidth: 140 }}>{d.vi_tri_bd}{d.vi_tri_kt && d.vi_tri_kt !== d.vi_tri_bd ? " → " + d.vi_tri_kt : ""}</td>
      <td className="n nw"><KlO a={a} d={d} upd={upd} sua={canWrite && coKL} /></td>
      <td>{canWrite && sh ? <Select className="inp sm mono" value={String(a.bat_dau_phut)} onChange={(x) => upd({ bat_dau_phut: +x }, "Đã đổi giờ bắt đầu")} options={opts(a.bat_dau_phut)} style={{ width: 84 }} /> : sh && offTxt(sh, a.bat_dau_phut)}</td>
      <td>{canWrite && sh ? <Select className="inp sm mono" value={String(a.ket_thuc_phut)} onChange={(x) => upd({ ket_thuc_phut: +x }, "Đã đổi giờ kết thúc")} options={opts(a.ket_thuc_phut)} style={{ width: 84 }} /> : sh && offTxt(sh, a.ket_thuc_phut)}</td>
      <td>{canWrite ? <input className="inp sm" defaultValue={a.ghi_chu || ""} onBlur={(e) => e.target.value !== (a.ghi_chu || "") && upd({ ghi_chu: e.target.value.trim() || null }, "Đã lưu ghi chú")} style={{ width: 150 }} /> : a.ghi_chu}</td>
      <td><div className="row" style={{ gap: 4 }}>{warns.map((w) => <Badge key={w} tone={SOFT_WARN.has(w) ? "warn" : "bad"} plain>{w}</Badge>)}</div></td>
      <td className="act">{canWrite && <ConfirmButton confirmText="Xác nhận gỡ" onConfirm={() => run(() => api.deleteAssignment(a.id), `Đã gỡ ${tenPT(a)}`)}>Gỡ xe</ConfirmButton>}</td>
    </tr>
  );
}

// Hộp thoại gán xe: mặc định chỉ xe rảnh, đúng loại (và đúng tải trọng với xe nâng)
function GanDialog({ d, sh, win, rules, asg, asgOf, nhaThau, onClose, onBoSung }) {
  const { D, api, run } = useApp();
  const os = offsets(sh, win);
  const mp = mapLoaiPt(d.loai_pt, rules, D.taiTrongList);
  const [doi, setDoi] = useState(mp?.doi ? [mp.doi] : []); // chọn nhiều đội, rỗng = tất cả
  const [dungTT, setDungTT] = useState(!!mp?.taiTrong);
  const [s, setS] = useState(os[0]);
  const [e, setE] = useState(os[os.length - 1]);
  const [onlyFree, setOnlyFree] = useState(true);
  const [muonHC, setMuonHC] = useState(false);
  const [gcNb, setGcNb] = useState(""); // ghi chú cho các xe nội bộ được gán lần này // mượn xe HC cho nhu cầu đi ca: mở xe HC ở ca đêm / Chủ nhật, không thu giờ về 07:30–17:00
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(new Set());
  const [err, setErr] = useState("");
  const hw = hcWindow(sh);
  const da = asgOf(d);
  const conThieu = Math.max(1, d.so_pt - demPT(da));
  const ntList = nhaThau.filter((x) => x.dang_dung !== false);
  const [mode, setMode] = useState("noi_bo"); // noi_bo | nha_thau
  // Nhiều dòng nhà thầu: mỗi dòng một đơn vị thực hiện, số xe, ghi chú (giờ dùng chung Từ / Đến)
  const [ntRows, setNtRows] = useState(() => [{ nt: ntList[0]?.ten || "", sl: conThieu, gc: "" }]);
  const setNtRow = (i, k, v) => setNtRows((o) => o.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const tongNt = ntRows.reduce((a, r) => a + (r.nt ? Math.max(1, parseInt(r.sl, 10) || 1) : 0), 0);

  // Xe bận: trùng khung giờ thật (so cả các khung giờ khác trong ngày, không chỉ cùng khung nhu cầu)
  const tg = (a, o) => new Date(a.ca_bat_dau).getTime() + o * MIN;
  const busyOf = (ma) => asg.filter((a) => a.ma_xe === ma && tg(a, a.bat_dau_phut) < sh.start + e * MIN && sh.start + s * MIN < tg(a, a.ket_thuc_phut));
  const coXeNang = !doi.length || doi.includes("Xe nâng");
  // Đội đúng yêu cầu đang được chọn thì chỉ hiện xe đúng loại (lọc model) của đội đó
  const list = D.vehicles.filter((v) => (!doi.length || doi.includes(v.doi)) && (!mp || !doi.includes(mp.doi) || v.doi !== mp.doi || dungLoai(v, mp))
    && (!dungTT || !doi.includes("Xe nâng") || v.doi !== "Xe nâng" || !v.tai_trong || dungTaiTrong(v, mp))
    && matchPlan(q, v.ma, v.model, v.to_xe, v.tai_trong)).map((v) => {
    const st = D.stateOf(v.ma), busy = busyOf(v.ma), daGan = da.some((a) => a.ma_xe === v.ma);
    const hcOff = v.che_do === "HC" && !hw && !muonHC;
    const block = st === "hong" ? "Đang hỏng" : st === "bdcl" ? "Đang BD chiến lược" : hcOff ? (sh.so === 2 ? "Xe HC không làm ca đêm" : "Xe HC nghỉ Chủ nhật") : daGan ? "Đã gán cho nhu cầu này" : "";
    return { v, st, busy, block };
  }).filter((x) => !onlyFree || (!x.block && !x.busy.length))
    .sort((a, b) => !!a.block - !!b.block || a.busy.length - b.busy.length || a.v.ma.localeCompare(b.v.ma, "vi", { numeric: true }));

  const saveNt = async () => {
    if (e <= s) return setErr("Giờ đến phải sau giờ từ.");
    const ds = ntRows.filter((r) => r.nt);
    if (!ds.length) return setErr("Chọn nhà thầu.");
    const rows = ds.map((r) => ({ ma_nhu_cau: d.ma_nhu_cau, ca_bat_dau: sh.key, ma_xe: null, nha_thau: r.nt, so_luong: Math.max(1, parseInt(r.sl, 10) || 1), bat_dau_phut: s, ket_thuc_phut: e, ghi_chu: r.gc.trim() || null }));
    if (await run(() => api.insertAssignments(rows), `Đã gán ${rows.map((r) => `${r.so_luong} xe ${r.nha_thau}`).join(", ")}`)) onClose();
  };
  const toggle = (ma) => setSel((o) => { const n = new Set(o); n.has(ma) ? n.delete(ma) : n.add(ma); return n; });
  const save = async () => {
    if (e <= s) return setErr("Giờ đến phải sau giờ từ.");
    const rows = [...sel].map((ma) => {
      const v = D.vmap[ma]; let a = s, b = e;
      // Xe HC: thu giờ về trong khung 07:30–17:00, trừ khi đang mượn xe HC (giữ đúng giờ đã chọn)
      if (v?.che_do === "HC" && hw && !muonHC) { a = Math.max(s, (hw[0] - sh.start) / MIN); b = Math.min(e, (hw[1] - sh.start) / MIN); if (b <= a) { a = s; b = e; } }
      const muon = v?.che_do === "HC" && (!hw || sh.start + a * MIN < hw[0] || sh.start + b * MIN > hw[1]);
      const gc = [muon ? "Mượn xe HC" : "", gcNb.trim()].filter(Boolean).join(" · ");
      return { ma_nhu_cau: d.ma_nhu_cau, ca_bat_dau: sh.key, ma_xe: ma, bat_dau_phut: a, ket_thuc_phut: b, ghi_chu: gc || null };
    });
    if (await run(() => api.insertAssignments(rows), `Đã gán ${rows.length} xe`)) onClose();
  };
  // Giờ chọn được không giới hạn trong giờ nhu cầu (24h kể từ đầu ca)
  const optT = gioChon(sh, s, e).map((o) => [String(o), offTxt(sh, o)]);
  const ngoaiGio = s < 0 || e > dodaiNC(sh);
  const thieu = thieuTT(d);
  const gioNC = <div className={"small " + (ngoaiGio ? "warn" : "mute")} style={{ marginTop: -6, marginBottom: 10 }}>
    Giờ nhu cầu: <b>{hm(sh.start)} → {hm(sh.end)}</b> (giờ làm {offTxt(sh, os[0])} → {offTxt(sh, os[os.length - 1])}).
    {ngoaiGio ? " Đang chọn ngoài giờ nhu cầu: vẫn gán được, dòng kế hoạch sẽ có cảnh báo mềm." : " Chọn ngoài khoảng này vẫn được."}</div>;

  return (
    <Modal width={880} onClose={onClose} title={<span className="row" style={{ gap: 8 }}><Link2 size={16} />Gán xe · <span className="mono accent">{sh.label}</span> · {dm(sh.start)}</span>}
      footer={<><span className="small bad" style={{ marginRight: "auto" }}>{err}</span><button className="btn" onClick={onClose}>Hủy</button>
        {mode === "noi_bo" ? <button className="btn pri" disabled={!sel.size} onClick={save}>Gán {sel.size} xe</button>
          : <button className="btn pri" disabled={!tongNt} onClick={saveNt}>Gán {tongNt} xe nhà thầu</button>}</>}>
      <div className="mb">
        <b>{d.noi_dung}</b>
        <div className="small mute">{d.bp_yeu_cau} · {d.loai_pt}{mp ? ` → ${mp.doi}${mp.taiTrong ? " " + mp.taiTrong.join("/") : ""}` : " (chưa ánh xạ)"} · {d.vi_tri_bd}{d.vi_tri_kt && d.vi_tri_kt !== d.vi_tri_bd ? " → " + d.vi_tri_kt : ""} · {d.khoi_luong ?? ""} {d.dvt} · cần {d.so_pt} PT, đã gán {demPT(da)}{d.sdt_dau_moi ? ` · đầu mối ${d.dau_moi} ${d.sdt_dau_moi}` : ""}</div>
      </div>
      {thieu.length > 0 && <div className="alert warn mb"><AlertTriangle size={15} /><span>Nhu cầu thiếu thông tin: <b>{thieu.join(", ")}</b>. PDF trình ký sẽ để trống các cột này.</span>
        {onBoSung && <button className="btn sm" style={{ marginLeft: "auto" }} onClick={onBoSung}><FilePenLine size={14} />Bổ sung thông tin</button>}</div>}
      <div className="mb"><Seg value={mode} onChange={(m) => { setMode(m); setErr(""); }} options={[["noi_bo", "Xe nội bộ"], ["nha_thau", "Xe nhà thầu"]]} /></div>
      {mode === "nha_thau" ? (
        <>
          <div className="tw mb" style={{ maxHeight: 260 }}>
            <table className="t compact nt-rows">
              <thead><tr><th>Đơn vị thực hiện (nhà thầu) *</th><th className="n">Số xe</th><th>Ghi chú (in vào PDF trình ký)</th><th></th></tr></thead>
              <tbody>{ntRows.map((r, i) => (
                <tr key={i}>
                  <td><Select className="inp sm" value={r.nt} onChange={(v) => setNtRow(i, "nt", v)} options={ntList.map((x) => x.ten)} blank={ntList.length ? "— chọn —" : "— chưa có nhà thầu —"} style={{ width: 200 }} /></td>
                  <td className="n"><input className="inp sm num mono" type="number" min="1" value={r.sl} onChange={(x) => setNtRow(i, "sl", x.target.value)} style={{ width: 64 }} aria-label="Số xe" /></td>
                  <td><input className="inp sm" value={r.gc} onChange={(x) => setNtRow(i, "gc", x.target.value)} placeholder="VD: biển số, người liên hệ…" style={{ width: 230 }} aria-label="Ghi chú" /></td>
                  <td>{ntRows.length > 1 && <button className="btn ghost icon danger" title="Bỏ dòng" onClick={() => setNtRows((o) => o.filter((_, j) => j !== i))}><X size={14} /></button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="row mb">
            <button className="btn sm" onClick={() => setNtRows((o) => [...o, { nt: ntList.find((x) => !o.some((r) => r.nt === x.ten))?.ten || "", sl: 1, gc: "" }])}><Plus size={14} />Thêm nhà thầu</button>
            <span className="spacer" />
            <Field label="Từ"><Select className="inp sm mono" value={String(s)} onChange={(x) => setS(+x)} options={optT} style={{ width: 100 }} /></Field>
            <Field label="Đến"><Select className="inp sm mono" value={String(e)} onChange={(x) => setE(+x)} options={optT} style={{ width: 100 }} /></Field>
          </div>
          {gioNC}
          <div className="small mute">Xe nhà thầu không cần mã xe / biển số. Nhu cầu cần {d.so_pt} PT, đã gán {demPT(da)}.{!ntList.length && " Chưa có nhà thầu nào: bấm nút \"Nhà thầu\" ở trang Ngắn hạn để thêm (quản trị)."}</div>
        </>
      ) : (<>
      <div className="form-grid mb">
        <Field label="Đội xe"><MultiSelect value={doi} onChange={setDoi} options={D.doiList} /></Field>
        <Field label="Từ"><Select className="inp mono" value={String(s)} onChange={(x) => setS(+x)} options={optT} /></Field>
        <Field label="Đến"><Select className="inp mono" value={String(e)} onChange={(x) => setE(+x)} options={optT} /></Field>
        <Field label="Tìm"><Search value={q} onChange={setQ} placeholder="Mã xe, model, tổ…" /></Field>
        <Field label="Ghi chú (áp cho các xe được chọn)" className="full"><input className="inp" value={gcNb} onChange={(x) => setGcNb(x.target.value)} placeholder="VD: làm theo chỉ đạo ca trưởng, hỗ trợ bãi B…" /></Field>
      </div>
      {gioNC}
      <div className="row mb small">
        <label className="row" style={{ gap: 6, cursor: "pointer" }}><input type="checkbox" checked={onlyFree} onChange={(x) => setOnlyFree(x.target.checked)} />Chỉ xe rảnh trong khung giờ</label>
        <label className="row" style={{ gap: 6, cursor: "pointer" }} title="Khi xe đi ca sẵn sàng không đủ: cho gán xe HC vào ca đêm, Chủ nhật hoặc ngoài 07:30–17:00, giữ đúng giờ đã chọn">
          <input type="checkbox" checked={muonHC} onChange={(x) => setMuonHC(x.target.checked)} /><b className={muonHC ? "warn" : ""}>Mượn xe HC</b>{!hw && !muonHC && <span className="mute">({sh.so === 2 ? "ca đêm" : "Chủ nhật"}: xe HC đang bị khóa)</span>}</label>
        {mp?.taiTrong && doi.includes("Xe nâng") && <label className="row" style={{ gap: 6, cursor: "pointer" }}><input type="checkbox" checked={dungTT} onChange={(x) => setDungTT(x.target.checked)} />Chỉ tải trọng {mp.taiTrong.join("/")}</label>}
        <span className="mute">{list.length} xe</span>
      </div>
      <div className="tw" style={{ maxHeight: 340 }}>
        <table className="t">
          <thead><tr><th></th><th>Mã xe</th><th>Model</th>{coXeNang ? <th>Tải trọng</th> : null}<th>Tổ</th><th>Chế độ</th><th>Tình trạng</th></tr></thead>
          <tbody>
            {list.map(({ v, st, busy, block }) => (
              <tr key={v.ma} style={{ opacity: block ? 0.55 : 1, cursor: block ? "default" : "pointer" }} onClick={() => !block && toggle(v.ma)}>
                <td><input type="checkbox" checked={sel.has(v.ma)} disabled={!!block} readOnly /></td>
                <td className="mono"><b>{v.ma}</b></td>
                <td className="small">{v.model}</td>
                {coXeNang ? <td>{v.doi === "Xe nâng" ? <Badge tone={!v.tai_trong ? "warn" : mp?.taiTrong && !dungTaiTrong(v, mp) ? "bad" : "info"} plain>{v.tai_trong || "Chưa rõ"}</Badge> : ""}</td> : null}
                <td>{shortTo(v.to_xe)}</td>
                <td>{v.che_do}</td>
                <td className={block ? "bad" : busy.length ? "warn" : "ok"}>{block || (busy.length ? "Đã có việc " + busy.map((a) => `${hm(tg(a, a.bat_dau_phut))}–${hm(tg(a, a.ket_thuc_phut))}`).join(", ") : st === "bddk" ? "Rảnh · đang BD định kỳ" : v.che_do === "HC" && muonHC && !hw ? "Rảnh · mượn xe HC" : "Rảnh")}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="mute">Không có xe phù hợp. Đổi đội xe hoặc bỏ lọc "chỉ xe rảnh".</td></tr>}
          </tbody>
        </table>
      </div>
      {[...sel].some((ma) => D.vmap[ma]?.che_do === "HC") && <div className={"small " + (muonHC ? "warn" : "mute")} style={{ marginTop: 8 }}>{muonHC
        ? "Đang mượn xe HC: giữ đúng giờ đã chọn, dòng kế hoạch ghi chú \"Mượn xe HC\" và có cảnh báo mềm. Nhớ bố trí người lái cho xe HC ở ca này."
        : "Xe HC được thu giờ về trong khung 07:30–17:00. Tích \"Mượn xe HC\" để giữ đúng giờ đi ca."}</div>}
      </>)}
    </Modal>
  );
}

// Thêm / sửa nhu cầu thủ công; bổ sung thông tin còn thiếu của nhu cầu nhập từ file (không đổi ca, giờ)
function DemandDialog({ d, cas, win, asg, onClose }) {
  const tuFile = d && !d.thu_cong;
  const { D, api, run, toast } = useApp();
  // Ca chọn được: các ca đang có + 2 ca đi ca sắp tới
  const caOpts = useMemo(() => {
    const m = new Map(cas.map((s) => [s.key, { key: s.key, start: s.start, end: s.end, label: `${s.label} · ${dm(s.start)}` }]));
    D.upcomingShifts().forEach((x) => {
      const st = x.start.getTime(), key = new Date(st).toISOString();
      if (!m.has(key)) m.set(key, { key, start: st, end: x.hc ? x.end.getTime() : st + 12 * 36e5, label: `${x.hc ? "CA HC" : `CA ${x.so}${D.shiftKip(x)}`} · ${dm(st)}` });
    });
    return [...m.values()].sort((a, b) => a.start - b.start);
  }, [cas, D]);
  const [f, setF] = useState(() => d ? { ...d, bp_yeu_cau: d.bp_yeu_cau || "", loai_pt: d.loai_pt || "", noi_dung: d.noi_dung || "", vi_tri_bd: d.vi_tri_bd || "", vi_tri_kt: d.vi_tri_kt || "", dvt: d.dvt || "", dau_moi: d.dau_moi || "", sdt_dau_moi: d.sdt_dau_moi || "", ca: new Date(d.tg_bat_dau).toISOString() } : { ca: caOpts[0]?.key || "", bp_yeu_cau: "", loai_pt: "", noi_dung: "", vi_tri_bd: "", vi_tri_kt: "", khoi_luong: "", dvt: "Tấn", so_pt: 1, dau_moi: "", sdt_dau_moi: "" });
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v?.target ? v.target.value : v }));
  const miss = (k) => (d && (f[k] == null || String(f[k]).trim() === "") ? " miss" : "");
  const lpts = [...new Set([...D.plan.demands.map((x) => x.loai_pt), ...rulesOf(D.mapPt).map((r) => r.tu_khoa)])].filter(Boolean);
  const save = async () => {
    if (!f.bp_yeu_cau.trim() || !f.loai_pt.trim() || !f.noi_dung.trim()) return toast("Cần nhập bộ phận, loại phương tiện và nội dung", "bad");
    const ca = caOpts.find((x) => x.key === f.ca);
    if (!ca && !tuFile) return toast("Chọn ca", "bad");
    const rec = {
      bp_yeu_cau: f.bp_yeu_cau.trim(), loai_pt: f.loai_pt.trim(), noi_dung: f.noi_dung.trim(), vi_tri_bd: f.vi_tri_bd.trim(), vi_tri_kt: f.vi_tri_kt.trim(),
      khoi_luong: f.khoi_luong === "" || f.khoi_luong == null ? null : Number(f.khoi_luong), dvt: f.dvt, so_pt: Math.max(1, +f.so_pt || 1),
      dau_moi: f.dau_moi, sdt_dau_moi: f.sdt_dau_moi,
      ...(tuFile ? {} : { tg_bat_dau: new Date(ca.start).toISOString(), tg_ket_thuc: new Date(ca.end).toISOString() }),
    };
    for (const k of ["vi_tri_bd", "vi_tri_kt", "dvt", "dau_moi", "sdt_dau_moi"]) rec[k] = String(rec[k] ?? "").trim();
    const ok = await run(async () => {
      if (!d) return api.insertDemand({ ...rec, ma_nhu_cau: "TC-" + Date.now().toString(36).toUpperCase(), stt: "TC" });
      await api.updateDemand(d.id, rec);
      if (tuFile) return;
      // Đổi ca: chuyển các xe đã gán sang ca mới, đặt lại giờ bằng cả cửa sổ làm việc
      const oldKey = new Date(d.tg_bat_dau).toISOString();
      if (oldKey !== ca.key) for (const a of asg.filter((x) => x.ma_nhu_cau === d.ma_nhu_cau && x.ca_bat_dau === oldKey))
        await api.updateAssignment(a.id, { ca_bat_dau: ca.key, bat_dau_phut: win.winA, ket_thuc_phut: (ca.end - ca.start) / MIN - win.winB });
    }, tuFile ? "Đã bổ sung thông tin nhu cầu" : d ? "Đã sửa nhu cầu" : "Đã thêm nhu cầu thủ công");
    if (ok) onClose();
  };
  return (
    <Modal title={tuFile ? "Bổ sung thông tin nhu cầu" : d ? "Sửa nhu cầu thủ công" : "Thêm nhu cầu thủ công"} onClose={onClose} width={720}
      footer={<><button className="btn" onClick={onClose}>Hủy</button><button className="btn pri" onClick={save}>Lưu</button></>}>
      {tuFile && <div className="alert info mb"><Info size={15} /><span>Nhu cầu từ file <b>{d.ma_nhu_cau}</b> · {hm(new Date(d.tg_bat_dau).getTime())} → {hm(new Date(d.tg_ket_thuc).getTime())}. Ô viền vàng là thông tin còn thiếu. Nhập lại file nhu cầu sẽ thay bằng dữ liệu trong file.</span></div>}
      <div className="form-grid">
        {!tuFile && <Field label="Ca *"><Select value={f.ca} onChange={set("ca")} options={caOpts.map((x) => [x.key, x.label])} /></Field>}
        <Field label="Bộ phận sử dụng *"><input className={"inp" + miss("bp_yeu_cau")} value={f.bp_yeu_cau} onChange={set("bp_yeu_cau")} /></Field>
        <Field label="Loại phương tiện *"><input className={"inp" + miss("loai_pt")} list="dl-lpt" value={f.loai_pt} onChange={set("loai_pt")} /><datalist id="dl-lpt">{lpts.map((x) => <option key={x} value={x} />)}</datalist></Field>
        <Field label="Số phương tiện"><input className="inp num" type="number" min="1" value={f.so_pt} onChange={set("so_pt")} /></Field>
        <Field label="Nội dung công việc *" className="wide"><input className={"inp" + miss("noi_dung")} value={f.noi_dung} onChange={set("noi_dung")} /></Field>
        <Field label="Điểm đi"><input className={"inp" + miss("vi_tri_bd")} value={f.vi_tri_bd} onChange={set("vi_tri_bd")} /></Field>
        <Field label="Điểm đến"><input className={"inp" + miss("vi_tri_kt")} value={f.vi_tri_kt} onChange={set("vi_tri_kt")} /></Field>
        <Field label="Khối lượng"><input className={"inp num" + miss("khoi_luong")} type="number" value={f.khoi_luong ?? ""} onChange={set("khoi_luong")} /></Field>
        <Field label="ĐVT"><input className={"inp" + miss("dvt")} value={f.dvt} onChange={set("dvt")} /></Field>
        <Field label="Đầu mối"><input className="inp" value={f.dau_moi} onChange={set("dau_moi")} /></Field>
        <Field label="SĐT đầu mối"><input className="inp" value={f.sdt_dau_moi} onChange={set("sdt_dau_moi")} /></Field>
      </div>
    </Modal>
  );
}

// Nút xuất Excel: chọn sheet trình ký / theo tổ / theo BPSD (cùng dữ liệu với PDF, theo bộ lọc)
function XuatExcel({ onXuat }) {
  const [mo, setMo] = useState(false);
  const [ky, setKy] = useState(true);
  const [to, setTo] = useState(true);
  const [bp, setBp] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!mo) return;
    const h = (e) => { if (!ref.current?.contains(e.target)) setMo(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [mo]);
  return (
    <div className="xl-wrap" ref={ref}>
      <button className="btn sm" onClick={() => setMo((x) => !x)} aria-expanded={mo}><FileSpreadsheet size={14} />Xuất Excel</button>
      {mo && (
        <div className="menu xl-pop">
          <label className="msel-it"><input type="checkbox" checked={ky} onChange={(e) => setKy(e.target.checked)} />Excel trình ký <span className="small mute">(BM.07D/HD.05.02)</span></label>
          <label className="msel-it"><input type="checkbox" checked={to} onChange={(e) => setTo(e.target.checked)} />Excel theo tổ</label>
          <label className="msel-it"><input type="checkbox" checked={bp} onChange={(e) => setBp(e.target.checked)} />Excel theo BPSD</label>
          <div className="small mute" style={{ padding: "2px 8px 6px" }}>Chọn nhiều: một file, mỗi mẫu một sheet. Xuất đúng các dòng đang hiển thị.</div>
          <button className="btn sm pri" style={{ width: "100%" }} disabled={!ky && !to && !bp} onClick={() => { setMo(false); onXuat(ky, to, bp); }}><FileSpreadsheet size={14} />Xuất</button>
        </div>
      )}
    </div>
  );
}
