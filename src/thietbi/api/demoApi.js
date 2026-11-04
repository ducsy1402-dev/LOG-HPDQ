// Backend giả lập chạy trong trình duyệt (mở trang với ?demo).
// Dữ liệu xe/thông số/hàng hóa là dữ liệu thật; sự kiện và quân số được sinh ngẫu nhiên.
// Mọi thay đổi chỉ nằm trong bộ nhớ, tải lại trang là mất.
import { today, addDays, diffDays } from "../lib/utils";
import { buildDemands, mapLoaiPt, dungLoai, dungTaiTrong, rulesOf } from "../lib/plan";

// Dữ liệu mẫu Book12 của demo đã duyệt (mốc gốc 13/10/2026, được dời theo ngày hiện tại)
const GOC = "2026-10-13";
const TAU = [
  ["PARAGON TRADE", "cuộn", "CTH", 17500, 6233, 81.7826, "2026-09-30T16:00", 2], ["FORTUNE RISE", "phế", "4", 4900, 783, 58.4348, "2026-10-07T15:00", 2],
  ["MARAN HOPE", "quặng", "10", 175000, 138488, 1700, "2026-10-09T13:00", 8], ["GOUVERNEUR", "quặng", "11", 175000, 151947, 1700, "2026-10-09T13:00", 8],
  ["TRƯỜNG GIANG 86", "phế", "4", 1600, 1200, 21, "2026-10-11T08:00", null], ["GOLDEN ROSE", "than", "5", 75000, null, 750, "2026-10-11T20:00", 6],
  ["VIỆT THUẬN 26-01", "quặng", "6", 25000, null, 500, "2026-10-12T08:00", null], ["STRATEGIC RESOLVE", "phế", "CTH1", 29563, null, 200, "2026-10-13T08:00", null],
  ["MERCHANT MARINER", "quặng", "11", 149614, null, 1700, "2026-10-14T08:00", 8], ["AQUACHARM", "quặng", "10", 175000, null, 1700, "2026-10-14T15:00", 8],
  ["PATRIA NAWASEN", "đá", "6", 52000, null, 450, "2026-10-15T08:00", 4], ["NEW GOLD", "đá", "HH", 25000, null, 350, "2026-10-15T08:00", null],
  ["MISTRAL I", "than", "5", 52483, null, 650, "2026-10-16T08:00", 6], ["NEW ADMIRE", "quặng", "11", 175000, null, 1700, "2026-10-18T08:00", 8],
  ["CAPE SEAGULL", "quặng", "10", 175000, null, 1700, "2026-10-19T08:00", 8], ["CORNELIE OLDENDORFF", "than", "6", 82500, null, 850, "2026-10-20T08:00", 7],
  ["CELINA", "than", "5", 55000, null, 650, "2026-10-20T08:00", 6],
];
const BAI = [
  ["Đào tạo", "", "", "2026-10-01", "2026-10-12", 1, 0], ["Xỉ hạt/thỉ thép (GĐ1)", "", "", "2026-10-01", "2026-10-30", 1, 1],
  ["Phế/KLM", "phế", "", "2026-10-01", "2026-10-20", 1, 1], ["Vun phế (GĐ2)", "phế", "", "2026-10-13", "2026-10-20", 4, 4],
  ["Đá (GĐ1)", "đá", "", "2026-10-15", "2026-10-19", 2, 2], ["Đá (GĐ2) hoa mai bến 4", "đá", "4", "2026-10-16", "2026-10-19", 0, 0],
];

// Bảng phân bổ phương tiện cố định (file "Bảng phân bổ phương tiện cố định.xlsx", 15/10/2026)
const PHAN_BO = {
  "Xúc đào": [["NM.HRC2", 3, "Bánh xích"], ["NM.HRC1", 10, "Bánh xích"], ["Tuyển xỉ 1", 3, "Bánh xích"], ["Tuyển xỉ 2", 2, "Bánh xích"], ["KSC_Bãi D", 1, "Bánh xích"],
    ["KSC_Bãi C", 1, "Bánh xích"], ["KSC_Bãi A", 1, "Bánh xích"], ["NM.TKVV1", 2, "Bánh xích"], ["BP.K_xỉ thép", 1, "Bánh xích"], ["NM.NL_xỉ hạt", 1, "Bánh xích"],
    ["NM.LG1", 2, "Mini"], ["NM.LG2", 2, "Mini"], ["KLH", 1, "Bánh lốp"]].map(([vi_tri, so_xe, loai]) => ({ vi_tri, loai, thiet_bi_gan: null, so_xe })),
  "Xúc lật": [["NM.HRC2", 4], ["Tuyển xỉ 1", 2], ["Tuyển xỉ 2", 2], ["KSC_Bãi D", 2], ["KSC_Bãi C", 2], ["NM.TKVV1", 4], ["NM.TKVV2", 2], ["NM.LG1", 1], ["NM.LG2", 1]]
    .map(([vi_tri, so_xe]) => ({ vi_tri, so_xe, ghi_chu: "" })),
};

const clone = (x) => JSON.parse(JSON.stringify(x));

export async function demoApi() {
  const seed = (await import("../data/seed.json")).default;
  // ?demo=quan_ly (vai trò của phần Cảng) dùng như Nhập liệu ở phần Thiết bị cơ giới
  const q = new URLSearchParams(location.search).get("demo");
  const role = q === "quan_ly" ? "nhap" : ["xem", "nhap", "quan_tri"].includes(q) ? q : "quan_tri";
  const db = clone(seed);
  // Danh mục dùng chung từ file "Danh_muc_tong_hop.xlsx" (src/data/danhMuc.json): xe, cẩu (đội "Cẩu"), hàng hóa thay hẳn
  const DM = (await import("../../data/danhMuc.json")).default;
  db.vehicles = [...clone(DM.xe), ...DM.cranes.map(({ thu_tu, ...c }) => clone(c))];
  db.meta.doi = [...new Set([...DM.xe.map((v) => v.doi), "Cẩu"])];
  db.meta.to = [...new Set(DM.xe.map((v) => v.to_xe).filter(Boolean))];
  db.hanghoa = clone(DM.hanghoa);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const t = today();

  // Sinh sự kiện mẫu
  db.events = []; let id = 0;
  const vs = [...db.vehicles].sort(() => rnd() - 0.5);
  const mk = (v, loai, vao, xong) => {
    const nhom = pick(db.meta.nhom[loai]);
    db.events.push({
      id: ++id, ma_xe: v.ma, loai, nhom, mo_ta: loai === "Hỏng" ? pick(["Rò dầu thủy lực", "Không đề được máy", "Mòn xích", "Kẹt hộp số", "Báo lỗi ECU", "Nổ lốp"]) : nhom,
      ngay_vao: vao, ngay_du_kien: addDays(vao, 1 + Math.floor(rnd() * 8)), ngay_xong: xong,
      phu_tung: pick(db.meta.pt), pic: pick(db.meta.pic), created_at: vao, updated_at: vao,
    });
  };
  vs.slice(0, 11).forEach((v) => mk(v, "Hỏng", addDays(t, -Math.floor(rnd() * 12)), null));
  vs.slice(11, 15).forEach((v) => mk(v, "BD chiến lược", addDays(t, -Math.floor(rnd() * 20)), null));
  vs.slice(15, 20).forEach((v) => mk(v, "BD định kỳ", addDays(t, -Math.floor(rnd() * 2)), null));
  for (let i = 0; i < 70; i++) {
    const vao = addDays(t, -2 - Math.floor(rnd() * 85));
    mk(pick(db.vehicles), pick(["Hỏng", "Hỏng", "Hỏng", "BD định kỳ", "BD chiến lược"]), vao, addDays(vao, 1 + Math.floor(rnd() * 6)));
  }
  db.events.forEach((e) => { if (e.ngay_xong && e.ngay_xong > t) e.ngay_xong = t; });
  db.cakip = [];
  db.headcount = [];

  // ---- Kế hoạch (Giai đoạn 2) ----
  const lech = diffDays(GOC, t);
  const doiNgay = (x) => (x ? addDays(x.slice(0, 10), lech) + x.slice(10) : x);
  const isoLocal = (x) => new Date(x).toISOString();
  let jid = 0, aid = 0, bid = 1, did = 0;
  const plan = {
    params: {
      dai_han: { p: { bd: doiNgay("2026-10-12T00:00"), gioN: 8, caLen: 12, capCang: 32, capBai: 9, ramp1: 0.6, ramp2: 0.85, ramp3: 0.6, flag: 1, moc: doiNgay("2026-10-12T08:00"), nShifts: 60, daoTao: 1 },
        phanBo: PHAN_BO,
        prod: [{ hang: "quặng", ns: 200, min: 3, max: 11, pt: "gầu" }, { hang: "than", ns: 100, min: 3, max: 11, pt: "gầu" }, { hang: "đá", ns: 250, min: 3, max: 7, pt: "gầu" }, { hang: "phế", ns: 30, min: 2, max: 6, pt: "nhóp" }, { hang: "cuộn", ns: 100, min: 1, max: 4, pt: "mooc" }] },
      ngan_han: { winA: 30, winB: 30 },
    },
    jobs: [
      ...TAU.map(([ten, hang, vi_tri, khoi_luong, con_lai, nang_suat, bd, so_xe_tay]) => ({ id: ++jid, loai: "tau", ten, hang, vi_tri, khoi_luong, con_lai, nang_suat, gio_dung: 0, bat_dau: isoLocal(doiNgay(bd)), so_xe_tay, xe_ngay: 0, xe_dem: 0 })),
      ...BAI.map(([ten, hang, vi_tri, tu, den, xe_ngay, xe_dem]) => ({ id: ++jid, loai: "bai", ten, hang, vi_tri, tu_ngay: doiNgay(tu), den_ngay: doiNgay(den), xe_ngay, xe_dem, gio_dung: 0 })),
    ],
    batch: { id: 1, file_name: "DS_Nhu_Cau (mẫu của demo)", is_current: true, imported_at: new Date().toISOString() },
    demands: [], assignments: [], coDinh: [],
  };
  // Bỏ cột "Ca Kíp" của file mẫu: ngày đã bị dời nên kíp ghi sẵn không còn khớp lịch luân phiên
  const built = buildDemands((seed.demandSample || []).map((r) => ({ ...r, "Ca Kíp": "",
    "TG Bắt Đầu Yêu Cầu": doiNgay(String(r["TG Bắt Đầu Yêu Cầu"]).replace(" ", "T")),
    "TG Kết Thúc Yêu Cầu": doiNgay(String(r["TG Kết Thúc Yêu Cầu"]).replace(" ", "T")) })));
  plan.demands = (built.rows || []).map((d) => ({ ...d, id: ++did, batch_id: 1, thu_cong: false }));
  // Gán sẵn vài xe để có dữ liệu xem
  const ready = (v) => !db.events.some((e) => e.ma_xe === v.ma && !e.ngay_xong && ["Hỏng", "BD chiến lược"].includes(e.loai));
  plan.demands.slice(0, 10).forEach((d) => {
    const mp = mapLoaiPt(d.loai_pt, rulesOf({ rules: db.mapPt }), db.meta.tai_trong_xe_nang);
    const dur = (new Date(d.tg_ket_thuc) - new Date(d.tg_bat_dau)) / 60000;
    const v = db.vehicles.find((x) => mp && dungLoai(x, mp) && dungTaiTrong(x, mp) && x.che_do === "Đi ca" && ready(x) && !plan.assignments.some((a) => a.ma_xe === x.ma && a.ca_bat_dau === d.tg_bat_dau));
    if (v) plan.assignments.push({ id: ++aid, ma_nhu_cau: d.ma_nhu_cau, ca_bat_dau: d.tg_bat_dau, ma_xe: v.ma, bat_dau_phut: 30, ket_thuc_phut: dur - 30, ghi_chu: "", khoi_luong: null });
  });
  const dNt = plan.demands.find((d) => !plan.assignments.some((a) => a.ma_nhu_cau === d.ma_nhu_cau));
  if (dNt) plan.assignments.push({ id: ++aid, ma_nhu_cau: dNt.ma_nhu_cau, ca_bat_dau: dNt.tg_bat_dau, ma_xe: null, nha_thau: "NT Bảo Hưng", so_luong: Math.max(1, dNt.so_pt),
    bat_dau_phut: 30, ket_thuc_phut: (new Date(dNt.tg_ket_thuc) - new Date(dNt.tg_bat_dau)) / 60000 - 30, ghi_chu: "" });

  const upsert = (arr, rows, key) => rows.forEach((r) => {
    const i = arr.findIndex((x) => key.every((k) => x[k] === r[k]));
    if (i >= 0) arr[i] = { ...arr[i], ...r }; else arr.push({ ...r });
  });
  const wait = () => new Promise((r) => setTimeout(r, 120));
  const guard = (roles) => { if (!roles.includes(role)) throw new Error("Không có quyền (chế độ demo: " + role + ")"); };
  const W = ["nhap", "quan_tri"], A = ["quan_tri"];

  return {
    demo: true,
    async getSession() { return { user: { id: "demo", email: "demo@local" } }; },
    onAuth() { return { unsubscribe() {} }; },
    async signIn() { return this.getSession(); },
    async signOut() { location.href = location.pathname; },
    async getRole() { return { vai_tro: role, ho_ten: "Chế độ demo" }; },
    async loadAll({ cutoff, from }) {
      await wait();
      // Thiết bị gắn theo loại: tổng tạm = số xúc đào đang lắp, thêm thiết bị gắn của cẩu cảng
      if (!db.tbGanSl) db.tbGanSl = [
        ...(db.meta.thietBiGan?.length ? db.meta.thietBiGan : ["Gầu", "Búa", "Nhóp", "Mâm từ", "Xới"]).map((ten, i) => {
          const tong = db.vehicles.filter((v) => v.thiet_bi_gan === ten).length + 2;
          return { id: i + 1, ten, dung_cho: "Xúc đào", tong, hong: i === 1 ? 1 : 0, ghi_chu: null, thu_tu: i };
        }),
        { id: 90, ten: "Mâm từ", dung_cho: "Cẩu cảng", tong: 4, hong: 1, ghi_chu: "1 chiếc chờ thay cuộn dây", thu_tu: 90 },
        { id: 91, ten: "Gầu ngoạm", dung_cho: "Cẩu cảng", tong: 6, hong: 0, ghi_chu: null, thu_tu: 91 },
      ];
      return clone({
        tbGanSl: db.tbGanSl, meta: db.meta, nguong: db.nguong, mapPt: { rules: db.mapPt }, nhaThau: db.nhaThau, toTruong: db.toTruong || null, plan, vehicles: db.vehicles, staff: db.staff, specs: db.specs, hanghoa: db.hanghoa,
        events: db.events.filter((e) => !e.ngay_xong || e.ngay_xong >= cutoff),
        cakip: db.cakip.filter((x) => x.ngay >= from), headcount: db.headcount.filter((x) => x.ngay >= from),
      });
    },
    async insertEvent(rec) { guard(W); await wait(); db.events.push({ ...rec, id: ++id, created_at: t, updated_at: t }); },
    async updateEvent(eid, patch) { guard(W); await wait(); Object.assign(db.events.find((e) => e.id === +eid), patch); },
    async deleteEvent(eid) { guard(A); await wait(); db.events = db.events.filter((e) => e.id !== +eid); },
    async upsertVehicles(rows) { guard(A); await wait(); upsert(db.vehicles, rows, ["ma"]); },
    async deleteVehicle(ma) { guard(A); await wait(); db.vehicles = db.vehicles.filter((v) => v.ma !== ma); },
    async deleteVehicles(mas) { guard(A); await wait(); const bo = new Set(mas); db.vehicles = db.vehicles.filter((v) => !bo.has(v.ma)); },
    async renameTo(cu, moi) {
      guard(A); await wait();
      db.vehicles.forEach((v) => { if (v.to_xe === cu) v.to_xe = moi; });
      db.staff.forEach((x) => { if (x.to_xe === cu) x.to_xe = moi; });
      db.meta.to = [...new Set((db.meta.to || []).map((t) => (t === cu ? moi : t)))];
      (db.toTruong?.list || []).forEach((x) => { if (x.to === cu) x.to = moi; });
    },
    async upsertStaff(rows) { guard(A); await wait(); upsert(db.staff, rows, ["ma"]); },
    async deleteStaff(ma) { guard(A); await wait(); db.staff = db.staff.filter((s) => s.ma !== ma); },
    async deleteStaffs(mas) { guard(A); await wait(); const bo = new Set(mas); db.staff = db.staff.filter((s) => !bo.has(s.ma)); },
    async deleteSampleStaff() { guard(A); await wait(); db.staff = db.staff.filter((s) => !s.ma.startsWith("MAU-")); },
    async upsertCaKip(rec) { guard(W); await wait(); upsert(db.cakip, [rec], ["ngay", "ca"]); },
    async upsertHeadcount(rows) { guard(W); await wait(); upsert(db.headcount, rows, ["ngay", "ca", "doi"]); },
    async savePlanParams(pid, data) { guard(A); await wait(); plan.params[pid] = clone(data); },
    async insertPlanJob(rec) { guard(W); await wait(); plan.jobs.push({ ...rec, id: ++jid }); },
    async updatePlanJob(pid, patch) { guard(W); await wait(); Object.assign(plan.jobs.find((j) => j.id === +pid), patch); },
    async deletePlanJob(pid) { guard(A); await wait(); plan.jobs = plan.jobs.filter((j) => j.id !== +pid); },
    async reorderPlanJobs(rows) { guard(W); await wait(); rows.forEach((r) => { const j = plan.jobs.find((x) => x.id === +r.id); if (j) j.thu_tu = r.thu_tu; }); },
    async importDemands(file, rows, win) {
      guard(W); await wait();
      const batch = ++bid;
      plan.batch = { id: batch, file_name: file, is_current: true, imported_at: new Date().toISOString() };
      // Nhu cầu từ Phương án làm hàng (mã "PA-") chưa kết thúc được giữ sang đợt mới (như sql/15)
      const giuPA = plan.demands.filter((d) => String(d.ma_nhu_cau || "").startsWith("PA-") && new Date(d.tg_ket_thuc).getTime() > Date.now()).map((d) => ({ ...d, batch_id: batch }));
      plan.demands = [...rows.map((r) => ({ ...r, id: ++did, batch_id: batch, thu_cong: false })), ...giuPA];
      const min = Math.min(...rows.map((r) => new Date(r.tg_bat_dau).getTime()));
      const byMa = Object.fromEntries(plan.demands.map((d) => [d.ma_nhu_cau, d]));
      const before = plan.assignments.length;
      plan.assignments = plan.assignments.filter((a) => new Date(a.ca_bat_dau).getTime() < min || byMa[a.ma_nhu_cau]);
      const dropped = before - plan.assignments.length;
      let moved = 0;
      plan.assignments.forEach((a) => {
        const d = byMa[a.ma_nhu_cau], ca = new Date(a.ca_bat_dau).getTime();
        if (d && ca >= min && ca !== new Date(d.tg_bat_dau).getTime()) {
          moved++; a.ca_bat_dau = d.tg_bat_dau; a.bat_dau_phut = win.winA;
          a.ket_thuc_phut = (new Date(d.tg_ket_thuc) - new Date(d.tg_bat_dau)) / 60000 - win.winB;
        }
      });
      return { batch_id: batch, kept: plan.assignments.filter((a) => byMa[a.ma_nhu_cau]).length, dropped, moved };
    },
    async insertDemand(rec) { guard(W); await wait(); plan.demands.push({ ...rec, id: ++did, batch_id: plan.batch?.id || 1, thu_cong: true }); },
    async updateDemand(pid, patch) { guard(W); await wait(); Object.assign(plan.demands.find((d) => d.id === +pid), patch); },
    async dauVanTay() { return "demo"; },
    async viecNenLog() { return null; }, // demo: chưa có việc nền trên máy chủ
    async donNhuCauCu(moc) {
      guard(W); await wait();
      const m = new Date(moc).getTime(), truoc = m - 864e5;
      plan.assignments = plan.assignments.filter((a) => new Date(a.ca_bat_dau).getTime() >= truoc);
      const n = plan.demands.length;
      plan.demands = plan.demands.filter((d) => new Date(d.tg_ket_thuc).getTime() >= m);
      return n - plan.demands.length;
    },
    async deleteDemand(d) {
      guard(W); await wait();
      plan.assignments = plan.assignments.filter((a) => !(a.ma_nhu_cau === d.ma_nhu_cau && new Date(a.ca_bat_dau).getTime() === new Date(d.tg_bat_dau).getTime()));
      plan.demands = plan.demands.filter((x) => x.id !== d.id);
    },
    async upsertCoDinh(rec) {
      guard(W); await wait();
      const i = plan.coDinh.findIndex((x) => x.khoa === rec.khoa && x.ca_so === rec.ca_so);
      if (i >= 0) plan.coDinh[i] = { ...plan.coDinh[i], ...clone(rec) }; else plan.coDinh.push({ ...clone(rec), id: ++aid + 100000 });
    },
    async deleteCoDinh(pid) { guard(W); await wait(); plan.coDinh = plan.coDinh.filter((x) => x.id !== +pid); },
    async insertAssignments(rows) { guard(W); await wait(); rows.forEach((r) => plan.assignments.push({ khoi_luong: null, ...r, id: ++aid })); },
    async updateAssignment(pid, patch) { guard(W); await wait(); Object.assign(plan.assignments.find((a) => a.id === +pid), patch); },
    async deleteAssignment(pid) { guard(W); await wait(); plan.assignments = plan.assignments.filter((a) => a.id !== +pid); },
    async saveNhaThau(list) { guard(A); await wait(); db.nhaThau = { list: clone(list) }; },
    async upsertHangHoa(rows) { guard(A); await wait(); upsert(db.hanghoa, rows, ["loai_hang"]); },
    async deleteHangHoa(ten) { guard(A); await wait(); db.hanghoa = db.hanghoa.filter((h) => h.loai_hang !== ten); },
    async deleteHangHoas(tens) { guard(A); await wait(); const bo = new Set(tens); db.hanghoa = db.hanghoa.filter((h) => !bo.has(h.loai_hang)); },
    async saveTbGanSl(rec) {
      guard(W); await wait();
      if (rec.id) Object.assign(db.tbGanSl.find((x) => x.id === rec.id), rec);
      else db.tbGanSl.push({ ...rec, id: Math.max(0, ...db.tbGanSl.map((x) => x.id)) + 1 });
    },
    async deleteTbGanSl(tid) { guard(A); await wait(); db.tbGanSl = db.tbGanSl.filter((x) => x.id !== tid); },
    async saveThietBiGan(list, them, dung) { guard(A); await wait(); db.meta.thietBiGan = clone(list); if (them) db.meta.thietBiGanThem = clone(them); if (dung) db.meta.thietBiGanDung = clone(dung); },
    async saveToTruong(list) { guard(A); await wait(); db.toTruong = { list: clone(list) }; },
    async saveMapPt(rules) { guard(A); await wait(); db.mapPt = clone(rules); },
  };
}
