import { supabase } from "../../lib/supabase";

const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const ok = (r) => { if (r.error) throw r.error; return r.data; };

export function supabaseApi() {
  const sb = supabase();

  async function fetchAll(build) {
    let out = [];
    for (let from = 0; ; from += 1000) {
      const data = ok(await build().range(from, from + 999));
      out = out.concat(data);
      if (data.length < 1000) break;
    }
    return out;
  }

  return {
    demo: false,
    async getSession() { return (await sb.auth.getSession()).data.session; },
    onAuth(cb) { return sb.auth.onAuthStateChange((_e, s) => cb(s)).data.subscription; },
    async signIn(email, password) { return ok(await sb.auth.signInWithPassword({ email, password })).session; },
    signOut: () => sb.auth.signOut(),
    async getRole(userId) {
      return ok(await sb.from("user_roles").select("vai_tro,ho_ten").eq("user_id", userId).maybeSingle());
    },

    async loadAll({ cutoff, from }) {
      const [dm, vehicles, staff, events, cakip, headcount, specs, hanghoa] = await Promise.all([
        sb.from("danh_muc").select("*").then(ok),
        fetchAll(() => sb.from("vehicles").select("*").order("ma")),
        fetchAll(() => sb.from("staff").select("*").order("ma")),
        fetchAll(() => sb.from("events").select("*").or(`ngay_xong.is.null,ngay_xong.gte.${cutoff}`).order("id")),
        sb.from("ca_kip").select("*").gte("ngay", from).then(ok),
        sb.from("headcount").select("*").gte("ngay", from).then(ok),
        // Hai bảng mới của phiên bản 2: nếu chưa chạy migration thì trả về rỗng thay vì lỗi
        sb.from("model_specs").select("*").then((r) => r.data || []),
        sb.from("hang_hoa").select("*").order("loai_hang").then((r) => r.data || []),
      ]);
      const d = Object.fromEntries(dm.map((x) => [x.id, x.data]));
      // Thiết bị gắn theo loại (SQL 20). Chưa chạy SQL 20 thì null: tab Thiết bị gắn báo cần chạy SQL
      const tbGanSl = await sb.from("thiet_bi_gan_sl").select("*").order("thu_tu").order("id").then((r) => (r.error ? null : r.data));
      return { meta: d.meta || {}, nguong: d.nguong || {}, mapPt: d.map_pt || null, nhaThau: d.nha_thau || null, toTruong: d.to_truong || null, vehicles, staff, events, cakip, headcount, specs, hanghoa, tbGanSl, plan: await this.loadPlan() };
    },

    // Dữ liệu Giai đoạn 2. Chưa chạy file SQL 6 thì trả về null (tab Kế hoạch sẽ báo cần chạy SQL).
    async loadPlan() {
      const params = await sb.from("plan_params").select("*");
      if (params.error) return null;
      const [jobs, batch] = await Promise.all([
        sb.from("plan_jobs").select("*").order("id").then(ok),
        sb.from("demand_batches").select("*").eq("is_current", true).order("id", { ascending: false }).limit(1).then(ok),
      ]);
      const b = batch[0] || null;
      const demands = b ? await fetchAll(() => sb.from("demands").select("*").eq("batch_id", b.id).order("id")) : [];
      const since = new Date(Date.now() - 3 * 864e5).toISOString();
      const assignments = await fetchAll(() => sb.from("assignments").select("*").gte("ca_bat_dau", since).order("id"));
      // Mẫu gán cố định (SQL 10). Chưa chạy SQL 10 thì null: trang ẩn chức năng "Cố định".
      const coDinh = await sb.from("gan_co_dinh").select("*").order("id").then((r) => (r.error ? null : r.data));
      return { params: Object.fromEntries(params.data.map((x) => [x.id, x.data])), jobs, batch: b, demands, assignments, coDinh };
    },
    savePlanParams: async (id, data) => ok(await sb.from("plan_params").upsert({ id, data, updated_at: new Date().toISOString() })),
    insertPlanJob: async (rec) => ok(await sb.from("plan_jobs").insert(rec)),
    updatePlanJob: async (id, patch) => ok(await sb.from("plan_jobs").update(patch).eq("id", id)),
    deletePlanJob: async (id) => ok(await sb.from("plan_jobs").delete().eq("id", id)),
    // Lưu thứ tự dòng sau khi kéo thả: [{id, thu_tu}]
    async reorderPlanJobs(rows) { for (const r of rows) ok(await sb.from("plan_jobs").update({ thu_tu: r.thu_tu }).eq("id", r.id)); },
    importDemands: async (file, rows, win) => ok(await sb.rpc("import_demands", { p_file: file, p_rows: rows, p_win_a: win.winA, p_win_b: win.winB })),
    async insertDemand(rec) {
      let b = ok(await sb.from("demand_batches").select("id").eq("is_current", true).order("id", { ascending: false }).limit(1))[0];
      if (!b) b = ok(await sb.from("demand_batches").insert({ file_name: "Nhập thủ công", so_dong: 0 }).select("id"))[0];
      return ok(await sb.from("demands").insert({ ...rec, batch_id: b.id, thu_cong: true }));
    },
    updateDemand: async (id, patch) => ok(await sb.from("demands").update(patch).eq("id", id)),
    async deleteDemand(d) {
      ok(await sb.from("assignments").delete().eq("ma_nhu_cau", d.ma_nhu_cau).eq("ca_bat_dau", d.tg_bat_dau));
      return ok(await sb.from("demands").delete().eq("id", d.id));
    },
    insertAssignments: async (rows) => ok(await sb.from("assignments").insert(rows)),
    // Dọn kế hoạch ngắn hạn cũ: nhu cầu đã kết thúc trước mốc và xe đã gán của các ca bắt đầu trước mốc − 24 giờ. Trả số nhu cầu đã xóa
    // Dấu vân tay dữ liệu Thiết bị cơ giới (SQL 23); null = chưa chạy SQL 23 hoặc lỗi tạm thời
    async dauVanTay() {
      const r = await sb.rpc("dau_van_tay_du_lieu", { p_nhom: "thiet_bi" });
      return r.error || r.data == null ? null : String(r.data);
    },
    // Nhật ký việc nền chạy theo lịch trên Supabase (SQL 22); null = chưa chạy SQL 22
    async viecNenLog() {
      const r = await sb.from("viec_nen_log").select("viec,chay_luc,ket_qua,loi").order("chay_luc", { ascending: false }).limit(20);
      return r.error ? null : r.data;
    },
    async donNhuCauCu(moc) {
      const truoc = new Date(new Date(moc).getTime() - 864e5).toISOString();
      ok(await sb.from("assignments").delete().lt("ca_bat_dau", truoc));
      const xoa = ok(await sb.from("demands").delete().lt("tg_ket_thuc", moc).select("id"));
      return xoa.length;
    },
    upsertCoDinh: async (rec) => ok(await sb.from("gan_co_dinh").upsert({ ...rec, updated_at: new Date().toISOString() }, { onConflict: "khoa,ca_so" })),
    deleteCoDinh: async (id) => ok(await sb.from("gan_co_dinh").delete().eq("id", id)),
    updateAssignment: async (id, patch) => ok(await sb.from("assignments").update(patch).eq("id", id)),
    deleteAssignment: async (id) => ok(await sb.from("assignments").delete().eq("id", id)),
    // Thiết bị gắn theo loại
    async saveTbGanSl(rec) {
      const { id, ...r } = rec;
      if (id) return ok(await sb.from("thiet_bi_gan_sl").update({ ...r, updated_at: new Date().toISOString() }).eq("id", id));
      return ok(await sb.from("thiet_bi_gan_sl").insert(r));
    },
    deleteTbGanSl: async (id) => ok(await sb.from("thiet_bi_gan_sl").delete().eq("id", id)),
    // Danh mục dùng chung (mục Danh mục của web chung): hàng hóa, thiết bị gắn
    async upsertHangHoa(rows) { for (const c of chunk(rows, 300)) ok(await sb.from("hang_hoa").upsert(c.map((r) => ({ ...r, updated_at: new Date().toISOString() })))); },
    deleteHangHoa: async (ten) => ok(await sb.from("hang_hoa").delete().eq("loai_hang", ten)),
    async deleteHangHoas(tens) { for (const c of chunk(tens, 200)) ok(await sb.from("hang_hoa").delete().in("loai_hang", c)); },
    async saveThietBiGan(list, them, dung) {
      const m = ok(await sb.from("danh_muc").select("data").eq("id", "meta").maybeSingle());
      ok(await sb.from("danh_muc").update({ data: { ...(m?.data || {}), thietBiGan: list, ...(them ? { thietBiGanThem: them } : {}), ...(dung ? { thietBiGanDung: dung } : {}) }, updated_at: new Date().toISOString() }).eq("id", "meta"));
    },
    saveNhaThau: async (list) => ok(await sb.from("danh_muc").upsert({ id: "nha_thau", data: { list }, updated_at: new Date().toISOString() })),
    // SĐT tổ trưởng theo kíp: [{to, A:{ten,sdt}, B, C, HC}]
    saveToTruong: async (list) => ok(await sb.from("danh_muc").upsert({ id: "to_truong", data: { list }, updated_at: new Date().toISOString() })),
    saveMapPt: async (rules) => ok(await sb.from("danh_muc").upsert({ id: "map_pt", data: { rules }, updated_at: new Date().toISOString() })),

    insertEvent: async (rec) => ok(await sb.from("events").insert(rec)),
    updateEvent: async (id, patch) => ok(await sb.from("events").update(patch).eq("id", id)),
    deleteEvent: async (id) => ok(await sb.from("events").delete().eq("id", id)),
    async upsertVehicles(rows) { for (const c of chunk(rows, 500)) ok(await sb.from("vehicles").upsert(c)); },
    deleteVehicle: async (ma) => ok(await sb.from("vehicles").delete().eq("ma", ma)),
    async deleteVehicles(mas) { for (const c of chunk(mas, 200)) ok(await sb.from("vehicles").delete().in("ma", c)); },
    // Đổi tên tổ: xe, nhân sự và thứ tự tổ trong danh mục
    async renameTo(cu, moi) {
      ok(await sb.from("vehicles").update({ to_xe: moi }).eq("to_xe", cu));
      ok(await sb.from("staff").update({ to_xe: moi }).eq("to_xe", cu));
      const m = ok(await sb.from("danh_muc").select("data").eq("id", "meta").maybeSingle());
      if (Array.isArray(m?.data?.to)) {
        const to = [...new Set(m.data.to.map((t) => (t === cu ? moi : t)))];
        ok(await sb.from("danh_muc").update({ data: { ...m.data, to }, updated_at: new Date().toISOString() }).eq("id", "meta"));
      }
      const tt = ok(await sb.from("danh_muc").select("data").eq("id", "to_truong").maybeSingle());
      if (tt?.data?.list?.some((x) => x.to === cu) && !tt.data.list.some((x) => x.to === moi)) {
        const list = tt.data.list.map((x) => (x.to === cu ? { ...x, to: moi } : x));
        ok(await sb.from("danh_muc").update({ data: { list }, updated_at: new Date().toISOString() }).eq("id", "to_truong"));
      }
    },
    async upsertStaff(rows) { for (const c of chunk(rows, 500)) ok(await sb.from("staff").upsert(c)); },
    deleteStaff: async (ma) => ok(await sb.from("staff").delete().eq("ma", ma)),
    async deleteStaffs(mas) { for (const c of chunk(mas, 200)) ok(await sb.from("staff").delete().in("ma", c)); },
    // Chỉ xóa nhân sự mẫu (mã bắt đầu bằng MAU-) do file 5_nap_du_lieu_that.sql tạo
    deleteSampleStaff: async () => ok(await sb.from("staff").delete().like("ma", "MAU-%")),
    upsertCaKip: async (rec) => ok(await sb.from("ca_kip").upsert(rec)),
    upsertHeadcount: async (rows) => ok(await sb.from("headcount").upsert(rows)),
  };
}
