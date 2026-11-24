// Logic nghiệp vụ: trạng thái xe, tổng hợp theo đội/tổ, ca làm việc, quân số
import { addDays, diffDays, iso, sortBy, uniq, maModel, plain } from "./utils";

export const DEFAULT_T = { ss: 0.85, red: 0.7, qh: 3, lau: 7, cm: 0.9, tl: 3, luu_thang: 3 };
export const ST = {
  ss: { key: "ss", label: "Sẵn sàng", short: "SS" },
  bddk: { key: "bddk", label: "BD định kỳ", short: "BDĐK" },
  bdcl: { key: "bdcl", label: "BD chiến lược / CBM", short: "BDCL" },
  hong: { key: "hong", label: "Hỏng", short: "Hỏng" },
};
// Loại sự kiện (anh Sỹ 24/11/2026): "BD định kỳ" tách thành hai loại theo số giờ máy, thêm "Bảo trì CBM".
// Bảo dưỡng định kỳ: xe VẪN sẵn sàng (trạng thái bddk). Bảo trì CBM: xe KHÔNG sẵn sàng, tính chung nhóm bdcl cùng BD chiến lược.
// "BD định kỳ" là giá trị cũ của các sự kiện đã ghi từ trước: vẫn đọc đúng như Bảo dưỡng định kỳ, nhưng không còn trong danh sách chọn.
export const LOAI_BDDK = ["Bảo dưỡng định kỳ (2000H)", "Bảo dưỡng định kỳ (5000H)"];
export const LOAI_CBM = "Bảo trì CBM";
export const laBDDK = (loai) => loai === "BD định kỳ" || LOAI_BDDK.includes(loai);
const LOAI_KEY = { "Hỏng": "hong", "BD chiến lược": "bdcl", [LOAI_CBM]: "bdcl", "BD định kỳ": "bddk", ...Object.fromEntries(LOAI_BDDK.map((l) => [l, "bddk"])) };
// Danh mục dùng chung (meta) lưu trong CSDL còn danh sách loại sự kiện / PIC cũ: chuẩn hóa ở đây, không cần chạy SQL
export const PIC_BAO_TRI = "Tổ bảo trì bảo dưỡng";
export function chuanHoaMeta(meta) {
  const loai = [];
  for (const l of meta.loai || ["Hỏng", "BD định kỳ", "BD chiến lược"]) {
    if (l === "BD định kỳ") { for (const x of LOAI_BDDK) if (!loai.includes(x)) loai.push(x); } else if (!loai.includes(l)) loai.push(l);
  }
  for (const x of [...LOAI_BDDK, LOAI_CBM]) if (!loai.includes(x)) loai.push(x);
  const sapXep = ["Hỏng", ...LOAI_BDDK, LOAI_CBM, "BD chiến lược"];
  loai.sort((a, b) => (sapXep.indexOf(a) + 1 || 99) - (sapXep.indexOf(b) + 1 || 99));
  const loaiDung = [...new Set([...(meta.loaiDung || ["Hỏng", "BD chiến lược"]), LOAI_CBM])];
  const pic = [...(meta.pic || [])];
  if (!pic.includes(PIC_BAO_TRI)) pic.push(PIC_BAO_TRI);
  return { ...meta, loai, loaiDung, pic };
}
const RANK = { hong: 3, bdcl: 2, bddk: 1, ss: 0 };
export const ACTIVE = "Đang làm việc";
export const TAI_TRONG = ["3T", "5T", "10T", "15T", "28T"];
export const CHUA_PL = "Chưa phân loại";
export const CHUA_KB = "Chưa khai báo";
const DEFAULT_CA = [
  { ten: "CA 1 (08h–20h)", so: 1, gio: 8, ketThuc: 20, hc: false },
  { ten: "CA 2 (20h–08h)", so: 2, gio: 20, ketThuc: 8, hc: false },
  { ten: "CA HC (07h30–17h)", so: "HC", gio: 7.5, ketThuc: 17, hc: true, boNgay: [0] },
];
const DEFAULT_KIP_LICH = { goc: "2022-07-07", ca1: ["B", "A", "C"], ca2: { B: "C", C: "A", A: "B" } };

const MAC_DINH_GAN_CAU = ["Mâm từ (cẩu cảng)", "Nhóp (cẩu cảng)", "Ngáng", "Móc C", "Gầu ngoạm"];
export function derive(raw) {
  const meta = chuanHoaMeta(raw.meta || {});
  const T = { ...DEFAULT_T, ...(raw.nguong || {}) };
  const t = raw.today;
  const loaiDung = meta.loaiDung;
  const vmap = Object.fromEntries(raw.vehicles.map((v) => [v.ma, v]));
  const open = raw.events.filter((e) => !e.ngay_xong);

  // Trạng thái: Hỏng > BD chiến lược > BD định kỳ > Sẵn sàng. Chỉ Hỏng và BD chiến lược làm xe KHÔNG sẵn sàng.
  const state = {};
  for (const e of open) {
    const k = LOAI_KEY[e.loai] || (loaiDung.includes(e.loai) ? "hong" : "bddk");
    if (!state[e.ma_xe] || RANK[k] > RANK[state[e.ma_xe]]) state[e.ma_xe] = k;
  }
  const stateOf = (ma) => state[ma] || "ss";
  const isReady = (ma) => { const s = stateOf(ma); return s === "ss" || s === "bddk"; };

  const doiList = meta.doi?.length ? uniq([...meta.doi, ...raw.vehicles.map((v) => v.doi)]).sort(sortBy(meta.doi)) : uniq(raw.vehicles.map((v) => v.doi));
  const toList = uniq([...(meta.to || []), ...raw.vehicles.map((v) => v.to_xe)]).sort(sortBy(meta.to || []));
  const dinhBienXe = meta.dinhBien || { "Đi ca": 3, HC: 1 };
  const staffActive = raw.staff.filter((s) => (s.trang_thai || ACTIVE) === ACTIVE);
  // Lái xe đang làm việc: dùng cho định biên kíp và cân đối người – xe ở Tab 3 (không tính tổ trưởng, nhóm khác).
  // Người chưa ghi nhóm vẫn tính là lái xe.
  const laLaiXe = (s) => !s.nhom || plain(s.nhom) === "lai xe";
  const laiXeActive = staffActive.filter(laLaiXe);

  const specMap = Object.fromEntries(raw.specs.map((s) => [s.ma_model || maModel(s.model), s]));
  const specOf = (v) => (v?.model ? specMap[maModel(v.model)] || raw.specs.find((s) => s.model === v.model) || null : null);

  const flags = (e) => {
    const f = [], d = diffDays(e.ngay_vao, t);
    if (!e.ngay_xong) {
      if (e.loai === "Hỏng" && d > T.lau) f.push({ k: "lau", label: `Hỏng lâu ${d} ngày`, tone: "bad" });
      if (e.ngay_du_kien && e.ngay_du_kien < t) f.push({ k: "qh", label: `Quá hạn ${diffDays(e.ngay_du_kien, t)} ngày`, tone: "bad" });
      if (e.phu_tung === "Chờ phụ tùng") f.push({ k: "pt", label: "Chờ phụ tùng", tone: "warn" });
    }
    return f;
  };

  function summarize(vs) {
    const r = { tong: vs.length, ss: 0, bddk: 0, bdcl: 0, hong: 0, ready: 0, dinhBien: 0, diCa: 0, hc: 0 };
    for (const v of vs) {
      const s = stateOf(v.ma); r[s]++;
      if (s === "ss" || s === "bddk") r.ready++;
      r.dinhBien += dinhBienXe[v.che_do] ?? 1;
      if (v.che_do === "HC") r.hc++; else r.diCa++;
    }
    r.dung = r.hong + r.bdcl;
    r.rate = r.tong ? r.ready / r.tong : NaN;
    return r;
  }

  // Xe nâng chia theo tải trọng; xe nâng chưa có tải trọng hiện "Chưa phân loại" (không ẩn)
  const taiTrongList = meta.tai_trong_xe_nang || TAI_TRONG;
  // Thiết bị gắn của xe xúc đào (danh_muc.meta.thietBiGan); xe xúc đào chưa khai báo hiện "Chưa khai báo"
  // Mỗi loại thiết bị gắn dùng cho xe ("Gắn xe") hoặc cẩu cảng ("Cẩu cảng", meta.thietBiGanDung[tên]). Chưa khai báo lần nào thì có sẵn 5 loại của cẩu cảng
  // (trùng tên với loại gắn xe thì ghi thêm "(cẩu cảng)"; ở phiếu chuyến / phương án chỉ hiện tên trước dấu ngoặc).
  const gocGan = meta.thietBiGan?.length ? meta.thietBiGan : ["Gầu", "Búa", "Nhóp", "Mâm từ", "Xới"];
  const thietBiGanAll = meta.thietBiGanDung ? gocGan : [...gocGan, ...MAC_DINH_GAN_CAU.filter((x) => !gocGan.includes(x))];
  const thietBiGanDungOf = (ten) => ((meta.thietBiGanDung ? meta.thietBiGanDung[ten] === "Cẩu cảng" : MAC_DINH_GAN_CAU.includes(ten)) ? "Cẩu cảng" : "Gắn xe");
  const thietBiGanList = thietBiGanAll.filter((t) => thietBiGanDungOf(t) === "Gắn xe"); // gắn cho xe xúc đào
  const thietBiGanCauList = thietBiGanAll.filter((t) => thietBiGanDungOf(t) === "Cẩu cảng");
  const thietBiGanOf = (v) => (v?.doi === "Xúc đào" ? v.thiet_bi_gan || CHUA_KB : null);
  const taiTrongOf = (v) => (v?.doi === "Xe nâng" ? v.tai_trong || CHUA_PL : null);

  function groupSummary(vs, key, staffFilter) {
    const order = key === "doi" ? doiList : key === "tai_trong" ? [...taiTrongList, CHUA_PL] : toList;
    const g = {};
    for (const v of vs) (g[(key === "tai_trong" ? taiTrongOf(v) : v[key]) || "(trống)"] ||= []).push(v);
    const st = staffActive.filter(staffFilter || (() => true));
    return Object.keys(g).sort(sortBy(order)).map((k) => ({
      k, ...summarize(g[k]),
      nhanSu: st.filter((s) => (s[key === "doi" ? "doi" : "to_xe"] || "(trống)") === k).length,
    }));
  }

  // Lịch sử tỷ lệ sẵn sàng N ngày (dựng lại từ sự kiện)
  function readinessTrend(days, vs) {
    const set = new Set(vs.map((v) => v.ma));
    const evs = raw.events.filter((e) => set.has(e.ma_xe) && loaiDung.includes(e.loai));
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(t, -i);
      const down = new Set(evs.filter((e) => e.ngay_vao <= d && (!e.ngay_xong || e.ngay_xong > d)).map((e) => e.ma_xe)).size;
      const moi = raw.events.filter((e) => set.has(e.ma_xe) && e.ngay_vao === d).length;
      const xong = raw.events.filter((e) => set.has(e.ma_xe) && e.ngay_xong === d).length;
      out.push({ d, dung: down, ss: set.size - down, rate: set.size ? (set.size - down) / set.size : 0, moi, xong });
    }
    return out;
  }

  // ---------- Ca làm việc ----------
  // Quy ước công ty: CA 1 = ngày 08h–20h, CA 2 = đêm 20h–08h, CA HC 07h30–17h (thứ 2 – thứ 7)
  const caDef = meta.caDef?.length && meta.caDef[0].ten.startsWith("CA ") ? meta.caDef : DEFAULT_CA;
  const kipLich = meta.kipLich || DEFAULT_KIP_LICH;
  const gioLam = meta.gioLam || { "Đi ca": 11, HC: 8 };
  // Kíp theo lịch luân phiên: CA 1 = ca1[MOD(ngày − gốc, 3)], CA 2 cùng ngày theo bảng ca2
  function kipTheoLich(ngay, so) {
    const i = ((diffDays(kipLich.goc, ngay) % 3) + 3) % 3;
    const k1 = kipLich.ca1[i];
    return so === 2 ? kipLich.ca2[k1] : k1;
  }
  // Ngày trong tuần không có ca (0 = Chủ nhật). Ca hành chính mặc định nghỉ Chủ nhật.
  const ngayNghi = (c) => c.boNgay ?? (c.hc ? [0] : []);
  // Các ca cần điền quân số: ca đi ca đang diễn ra + 2 ca đi ca kế tiếp + ca hành chính chưa kết thúc.
  // VD 05h sáng 15/10 (đang là CA 2C của ngày 14/10) -> CA 2C 14/10, CA 1A 15/10, CA 2B 15/10, CA HC 15/10.
  function upcomingShifts(now = new Date()) {
    const all = [];
    for (let k = -1; k < 4; k++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
      for (const c of caDef) {
        if (ngayNghi(c).includes(d.getDay())) continue;
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(c.gio), Math.round((c.gio % 1) * 60));
        const kt = c.ketThuc ?? (c.hc ? 17 : (c.gio + 12) % 24);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (kt <= c.gio ? 1 : 0), Math.floor(kt), Math.round((kt % 1) * 60));
        if (end > now) all.push({ ngay: iso(d), ca: c.ten, so: c.so, hc: !!c.hc, start, end, dangChay: start <= now });
      }
    }
    all.sort((a, b) => a.start - b.start);
    return [...all.filter((x) => !x.hc).slice(0, 3), ...all.filter((x) => x.hc).slice(0, 1)].sort((a, b) => a.start - b.start);
  }

  // Kíp của ca: ưu tiên kíp đã chọn tay (bảng ca_kip), không có thì lấy theo lịch luân phiên
  function shiftKip(sh) {
    if (sh.hc) return "HC";
    return raw.cakip.find((x) => x.ngay === sh.ngay && x.ca === sh.ca)?.kip || kipTheoLich(sh.ngay, sh.so);
  }
  const shiftLich = (sh) => (sh.hc ? "HC" : kipTheoLich(sh.ngay, sh.so));
  const shiftLabel = (sh) => (sh.hc ? "CA HC" : `CA ${sh.so}${shiftKip(sh)}`);

  // Quân số thực tế theo TỔ (bảng headcount_to, SQL 14). Chưa chạy SQL 14 thì raw.headcountTo = null: nhập theo đội như cũ.
  const headcountTo = raw.headcountTo || [];
  const coSql14 = Array.isArray(raw.headcountTo);
  // Thông tin đầu / cuối ca theo xe (SQL 18). Chưa chạy SQL 18 thì raw.thongTinCa = null
  const thongTinCa = raw.thongTinCa || [];
  const coSql18 = Array.isArray(raw.thongTinCa);
  // Đội của một tổ = đội có nhiều xe nhất trong tổ (tổ chưa có xe thì theo nhân sự)
  const doiCuaTo = (() => {
    const dem = {};
    for (const v of raw.vehicles) if (v.to_xe && v.doi) { const m = (dem[v.to_xe] ||= {}); m[v.doi] = (m[v.doi] || 0) + 1; }
    for (const s of staffActive) if (s.to_xe && s.doi && !dem[s.to_xe]) dem[s.to_xe] = { [s.doi]: 1 };
    return Object.fromEntries(Object.entries(dem).map(([to, m]) => [to, Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]]));
  })();

  // Quân số một ca theo đội: định biên kíp, thực tế nhập, số xe sẵn sàng cần người, chênh lệch.
  // Thực tế của đội = cộng các tổ đã nhập (SQL 14); đội chưa có tổ nào nhập thì lấy số nhập theo đội cũ.
  function shiftRows(sh) {
    const kip = shiftKip(sh);
    const cheDo = sh.hc ? "HC" : "Đi ca";
    const hcTo = headcountTo.filter((x) => x.ngay === sh.ngay && x.ca === sh.ca && x.thuc_te != null);
    return doiList.map((doi) => {
      const xeCan = raw.vehicles.filter((v) => v.doi === doi && v.che_do === cheDo && isReady(v.ma)).length;
      const xeTong = raw.vehicles.filter((v) => v.doi === doi && v.che_do === cheDo).length;
      const dinhBien = kip ? laiXeActive.filter((s) => s.doi === doi && s.kip === kip).length : 0;
      const tos = hcTo.filter((x) => (x.doi || doiCuaTo[x.to_xe]) === doi); // quân số của đội = cộng các tổ ghi riêng cho đội này (SQL 19)
      const h = raw.headcount.find((x) => x.ngay === sh.ngay && x.ca === sh.ca && x.doi === doi);
      const thucTe = tos.length ? tos.reduce((a, x) => a + (+x.thuc_te || 0), 0) : h?.thuc_te ?? null;
      let chenh = thucTe == null ? null : thucTe - xeCan, toChua = 0;
      if (tos.length) {
        // Chênh lệch chỉ tính các tổ ĐÃ nhập (tổ chưa nhập không bị coi là thiếu người); toChua = số tổ có xe sẵn sàng mà chưa nhập
        const xeCanTo = (to) => raw.vehicles.filter((v) => v.to_xe === to && v.doi === doi && v.che_do === cheDo && isReady(v.ma)).length;
        const daNhap = new Set(tos.map((x) => x.to_xe));
        chenh = tos.reduce((a, x) => a + (+x.thuc_te || 0) - xeCanTo(x.to_xe), 0);
        toChua = uniq(raw.vehicles.filter((v) => v.doi === doi && v.to_xe && v.che_do === cheDo && isReady(v.ma)).map((v) => v.to_xe)).filter((to) => !daNhap.has(to)).length;
      }
      return { doi, kip, xeCan, xeTong, dinhBien, thucTe, ghiChu: h?.ghi_chu || "", chenh, theoTo: tos.length > 0, toChua };
    }).filter((r) => r.xeTong > 0 || r.dinhBien > 0 || r.thucTe != null);
  }

  // Quân số một ca theo TỔ, tách theo ĐỘI (anh Sỹ chốt 16/11/2026): một tổ có xe của nhiều đội (VD tổ PVC: 34 xe Xúc đào + 9 xe Xúc lật)
  // thì mỗi đội một dòng riêng, chỉ đếm xe của đội đó; quân số nhập riêng từng (đội, tổ) — cột doi của headcount_to, SQL 19.
  // Dòng quân số cũ chưa ghi đội (doi trống) tính cho đội chính của tổ (doiCuaTo).
  // Mỗi dòng: xe sẵn sàng cần người, định biên kíp (nhân sự của đội đó trong tổ), thực tế đã nhập, chênh lệch.
  function shiftByTo(sh) {
    const kip = shiftKip(sh);
    const cheDo = sh.hc ? "HC" : "Đi ca";
    const KEY = (doi, to) => doi + "|" + to;
    const doiHc = (h) => h.doi || doiCuaTo[h.to_xe] || "";
    const doiNs = (s) => s.doi || doiCuaTo[s.to_xe] || "";
    const cap = new Map();
    const them = (doi, to) => { if (to && !cap.has(KEY(doi, to))) cap.set(KEY(doi, to), { doi, to }); };
    for (const v of raw.vehicles) if (v.che_do === cheDo) them(v.doi || "", v.to_xe);
    if (kip) for (const s of laiXeActive) if (s.kip === kip) them(doiNs(s), s.to_xe);
    for (const h of headcountTo) if (h.ngay === sh.ngay && h.ca === sh.ca) them(doiHc(h), h.to_xe);
    const thuTuTo = (to) => { const i = toList.indexOf(to); return i < 0 ? 999 : i; };
    return [...cap.values()].sort((a, b) => thuTuTo(a.to) - thuTuTo(b.to) || String(a.doi).localeCompare(String(b.doi), "vi")).map(({ doi, to }) => {
      const vs = raw.vehicles.filter((v) => v.to_xe === to && (v.doi || "") === doi && v.che_do === cheDo);
      const h = headcountTo.find((x) => x.ngay === sh.ngay && x.ca === sh.ca && x.to_xe === to && doiHc(x) === doi);
      const xeCan = vs.filter((v) => isReady(v.ma)).length;
      const thucTe = h?.thuc_te ?? null;
      return {
        to, doi, doiChinh: doi, key: KEY(doi, to), xeTong: vs.length, xeCan,
        dinhBien: kip ? laiXeActive.filter((s) => s.to_xe === to && s.kip === kip && doiNs(s) === doi).length : 0,
        thucTe, ghiChu: h?.ghi_chu || "", chenh: thucTe == null ? null : thucTe - xeCan,
      };
    }).filter((r) => r.xeTong > 0 || r.dinhBien > 0 || r.thucTe != null);
  }

  return {
    ...raw, meta, T, today: t, vmap, open, state, stateOf, isReady, doiList, toList, dinhBienXe,
    staffActive, laiXeActive, laLaiXe, specOf, flags, summarize, groupSummary, readinessTrend, caDef, upcomingShifts, shiftKip, shiftLich, shiftLabel, kipTheoLich, gioLam, shiftRows, shiftByTo, headcountTo, coSql14, thongTinCa, coSql18, doiCuaTo,
    taiTrongList, taiTrongOf, thietBiGanList, thietBiGanOf, thietBiGanAll, thietBiGanCauList, thietBiGanDungOf,
    loaiList: meta.loai,
    kipList: meta.kip || ["A", "B", "C", "HC"],
  };
}

export const rateTone = (r, T) => (!Number.isFinite(r) ? "" : r < T.red ? "bad" : r < T.ss ? "warn" : "ok");
export const chenhTone = (c) => (c == null ? "" : c < 0 ? "bad" : c > 0 ? "info" : "ok");
export const chenhLabel = (c) => (c == null ? "Chưa nhập" : c < 0 ? `Thiếu ${-c}` : c > 0 ? `Thừa ${c}` : "Đủ");
