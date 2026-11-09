// Phương án làm hàng của một chuyến tàu: tốc độ, giờ hoàn tất dự kiến, so với hạn laytime / ETD, số xe mỗi ca, bãi.
//   Tốc độ gợi ý (tấn/ngày) = tổng năng suất các cẩu đã chọn (tấn/giờ, danh mục cẩu) × giờ làm hàng / ngày × hệ số khai thác.
//   Khởi động: mới bắt đầu làm hàng (mở hầm, chỉnh cẩu, xếp xe) chưa đạt tốc độ đầy đủ: ca đầu 60%, ca thứ hai 85%,
//   từ ca thứ ba 100% (sửa được theo từng phương án; như tham số tab Dài hạn).
//   Giờ hoàn tất = bắt đầu + thời gian làm phần còn lại (theo ca) + giờ dừng dự kiến (thời tiết + khác).
//   Xe gợi ý mỗi ca = khối lượng một ca ÷ (tải trọng một xe × số chuyến một xe chạy được trong ca), làm tròn lên.
import { ms, iso, plain, HOUR, DAY, so as soVN } from "./format";
import { chiSo, klCanLam } from "./linetime";
import { duToan, laCQD } from "./laytime";
import { docSo } from "./paste";
import { dsGanCau, laBangTai } from "./thietBi";

export const HE_SO_KHOI_DONG = [0.6, 0.85];
export const TRANG_THAI_PA = {
  nhap: { ten: "Nháp", tone: "outline" },
  trinh: { ten: "Trình duyệt", tone: "warn" },
  duyet: { ten: "Đã duyệt", tone: "ok" },
  huy: { ten: "Hủy", tone: "bad" },
};
export const PA_MOI = { ten: "A", trang_thai: "nhap", cau: [], gio_lam_ngay: 22, he_so: 0.6, toc_do: null, khoi_dong: true, khoi_dong_hs: HE_SO_KHOI_DONG, bat_dau: null, gio_dung_tt: 0, gio_dung_khac: 0, bai_hang: null, cau_tau: null, cau_gan: null, diem: [], xe: [], tb_khac: [], ghi_chu: null };
export const VIEC_KHAC = [["be_ham", "Be hầm / hót vét"], ["ho_tro", "Hỗ trợ chung"]];
const dsTb = (x) => (Array.isArray(x) ? x.filter((t) => t && String(t.loai || "").trim()) : []);

// Điểm lên hàng (tàu xuất) / hạ hàng – vun đống (tàu nhập). Phương án cũ chỉ có bai_hang: coi là một điểm.
export const diemCua = (plan) => {
  const ds = Array.isArray(plan?.diem) ? plan.diem.filter((d) => d && (String(d.bai || "").trim() || dsTb(d.tb).length)) : [];
  return ds.length ? ds.map((d) => ({ ...d, tb: dsTb(d.tb) })) : plan?.bai_hang ? [{ bai: plan.bai_hang, khoi_luong: null, tb: [] }] : [];
};
export const tenDiem = (plan) => diemCua(plan).map((d) => d.bai).filter(Boolean).join("; ");
// Hệ số khởi động của phương án (false = không tính khởi động)
export const heSoKhoiDong = (plan) => (plan?.khoi_dong === false ? [] : Array.isArray(plan?.khoi_dong_hs) && plan.khoi_dong_hs.length ? plan.khoi_dong_hs.map((x) => +x).filter((x) => x > 0) : HE_SO_KHOI_DONG);
// Cẩu tàu (cẩu của chính con tàu): { so, nang_suat (t/h mỗi cẩu, nhập tay) } hoặc null = không dùng. Chỉ tính khi có số cẩu và năng suất
export const cauTauCua = (x) => (x?.cau_tau && typeof x.cau_tau === "object" ? { so: x.cau_tau.so ?? null, nang_suat: x.cau_tau.nang_suat ?? null } : null);
export const tphCauTau = (x) => { const c = cauTauCua(x); return c && +c.so > 0 && +c.nang_suat > 0 ? +c.so * +c.nang_suat : 0; };
// Bãi nhận / lấy hàng ghi ở phiếu chuyến: [{ bai, khu, khoi_luong }] (chuyến cũ chỉ có tên bãi "A; B")
export const baiCuaChuyen = (v) => ((v?.bai_kl || []).filter((b) => b?.bai).length ? v.bai_kl.filter((b) => b?.bai)
  : String(v?.bai_hang || "").split(";").map((b) => b.trim()).filter(Boolean).map((bai) => ({ bai, khu: null, khoi_luong: null })));
// Phương án đang áp dụng cho chuyến: đã duyệt; chưa duyệt thì phương án sửa gần nhất (bỏ phương án hủy)
export const phuongAnHienHanh = (plans = []) => {
  const ps = (plans || []).filter((p) => p.trang_thai !== "huy");
  return ps.find((p) => p.trang_thai === "duyet")
    || [...ps].sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")) || (+b.id || 0) - (+a.id || 0))[0] || null;
};
// Bãi, xe, thiết bị, cẩu, băng tải của chuyến để xem: có phương án thì theo phương án, chưa có thì theo phiếu chuyến (tab Bãi & Thiết bị).
// Trả { plan (null = theo phiếu chuyến), bai, xe, hotVet, vunHang, cau, bangTai }; thiết bị dạng [{ loai, so, don_vi }]
// ctx = { cranes, stops, now } (tùy chọn): có thì số xe để trống được tính ra số cụ thể (theo tốc độ cẩu và tải trọng / chuyến mỗi ca)
export function thietBiChuyen(v, plans = [], ctx = null) {
  const p = phuongAnHienHanh(plans);
  if (!p) {
    let xe = dsTb(v.xe_van_chuyen);
    if (ctx?.cranes && xe.some((x) => x.so == null && !laBangTai(x.loai))) {
      const kq = tinhSoBo(v, ctx);
      xe = xe.map((x) => (x.so == null && !laBangTai(x.loai) ? { ...x, so: kq.xe.find((y) => y.loai === x.loai && (y.don_vi || "hoa_phat") === (x.don_vi || "hoa_phat"))?.so ?? null } : x));
    }
    return { plan: null, bai: baiCuaChuyen(v), xe, hotVet: dsTb(v.hot_vet), vunHang: dsTb(v.vun_hang), cau: v.cau || [], cauTau: cauTauCua(v), cauGan: dsGanCau(v.cau_gan), bangTai: v.bang_tai || null };
  }
  const diem = diemCua(p);
  const kq = ctx?.cranes ? tinhPhuongAn(v, p, { cranes: ctx.cranes, stops: ctx.stops || [], now: ctx.now ?? Date.now() }) : null;
  return {
    plan: p,
    bai: diem.filter((d) => String(d.bai || "").trim()).map((d) => ({ bai: d.bai, khu: d.khu || null, khoi_luong: d.khoi_luong ?? null })),
    // Số xe trống: có ctx thì lấy số đã tính (kq.xe), không thì đánh dấu tự tính
    xe: kq ? kq.xe.map((x) => ({ loai: x.loai, so: x.so ?? null, don_vi: x.don_vi || "hoa_phat" }))
      : dsTb(p.xe).map((x) => ({ loai: x.loai, so: x.so_xe ?? null, don_vi: x.don_vi || "hoa_phat", ...(x.so_xe == null ? { tu_tinh: true } : {}) })),
    hotVet: dsTb(p.tb_khac), // be hầm / hót vét và hỗ trợ chung
    vunHang: diem.flatMap((d) => d.tb),
    cau: p.cau || [],
    cauTau: cauTauCua(p),
    cauGan: dsGanCau(p.cau_gan),
    bangTai: p.bang_tai ?? v.bang_tai ?? null,
  };
}

// Tính sơ bộ cho chuyến chưa có phương án (phiếu chuyến › Bãi & Thiết bị): tốc độ theo cẩu đã chọn + cẩu tàu (chưa có cẩu thì theo cam kết),
// từ đó số xe mỗi ca theo tải trọng và số chuyến của từng loại xe. xe: các dòng xe dạng phương án (mặc định lấy từ chuyến), cauTau: ô cẩu tàu đang nhập
export function tinhSoBo(v, ctx = {}, { cauTau = v.cau_tau, xe } = {}) {
  const xePA = xe ?? dsTb(v.xe_van_chuyen).filter((x) => !laBangTai(x.loai)).map((x) => ({ loai: x.loai, tai_trong: x.tai_trong, chuyen_ca: x.chuyen_ca, so_xe: x.so, don_vi: x.don_vi }));
  const plan = { ...PA_MOI, cau: v.cau || [], cau_tau: cauTau, khoi_dong: false, xe: xePA };
  if (!(tocDoGoiY(ctx.cranes || [], plan).tanNgay > 0) && +v.cam_ket > 0) plan.toc_do = +v.cam_ket;
  return tinhPhuongAn(v, plan, { cranes: ctx.cranes || [], stops: ctx.stops || [], now: ctx.now ?? Date.now() });
}

// Gộp thiết bị theo loại + đơn vị: [{loai, so, don_vi}]
export function gopTB(...ds) {
  const m = new Map();
  for (const t of ds.flat(Infinity)) { if (!t?.loai || !(+t.so > 0)) continue; const k = `${t.loai}|${t.don_vi || "hoa_phat"}`; m.set(k, { loai: t.loai, don_vi: t.don_vi || "hoa_phat", so: (m.get(k)?.so || 0) + +t.so }); }
  return [...m.values()];
}

// Năng suất cẩu (tấn/giờ) ghi dạng chữ trong danh mục: "2000", "2500t/h", "1.000"
export const nangSuatCau = (c) => { const n = docSo(String(c?.nang_suat ?? c?.nang_suat_th ?? "").replace(/\s*t\s*\/\s*h.*$/i, "")); return n > 0 ? n : null; };

export function tocDoGoiY(cranes, plan) {
  const ds = (plan.cau || []).map((ma) => cranes.find((c) => c.ma === ma)).filter(Boolean);
  const tph = ds.reduce((s, c) => s + (nangSuatCau(c) || 0), 0) + tphCauTau(plan);
  const ct = cauTauCua(plan);
  return { tph, thieu: ds.filter((c) => !nangSuatCau(c)).map((c) => c.ma), thieuCauTau: !!ct && !tphCauTau(plan), tanNgay: tph > 0 ? tph * (+plan.gio_lam_ngay || 0) * (+plan.he_so || 0) : null };
}

// Mô phỏng làm phần còn lại theo từng ca 12 giờ. khoiDong: true (60%, 85%) / mảng hệ số theo ca / false
export function thoiGianLam(conLai, tanNgay, khoiDong) {
  const hs = khoiDong === true ? HE_SO_KHOI_DONG : Array.isArray(khoiDong) ? khoiDong : [];
  if (!(conLai > 0)) return 0;
  if (!(tanNgay > 0)) return null;
  let gio = 0, con = conLai;
  for (let i = 0; i < 4000 && con > 0; i++) {
    const tanGio = (tanNgay / 24) * (hs[i] ?? 1), ca = tanGio * 12;
    if (ca >= con) { gio += con / tanGio; con = 0; } else { con -= ca; gio += 12; }
  }
  return gio;
}

// ---------- Giai đoạn làm hàng ----------
// Mỗi loại hàng chia các giai đoạn nối tiếp với năng suất khác nhau: { hang, ten, ty_le (% khối lượng của hàng đó),
// he_so (% tốc độ cơ sở), toc_do (t/ngày, nhập thì dùng thay he_so) }. Không có giai đoạn = làm đều cả tàu với tốc độ cơ sở.
// Mẫu: nhập hàng rời đầu tàu nhanh, cuối tàu vét hầm chậm; xuất thép thành phẩm đầu tàu be hầm chậm, giữa nhanh, cuối lashing chậm.
export const MAU_GIAI_DOAN = {
  nhap: [["Đầu tàu", 30, 120], ["Giữa tàu", 50, 100], ["Cuối tàu – vét hầm", 20, 60]],
  xuat: [["Đầu tàu – be hầm", 20, 70], ["Giữa tàu", 60, 115], ["Cuối tàu – lashing", 20, 75]],
};
export const TEN_GIAI_DOAN = ["Đầu tàu", "Giữa tàu", "Cuối tàu", "Đầu tàu – be hầm", "Cuối tàu – vét hầm", "Cuối tàu – lashing", "Làm đều"];
// Các loại hàng của chuyến: [{ ten, kl }] (chuyến một hàng: một dòng)
export const hangCuaChuyen = (v) => {
  const ds = (v?.hang_ds || []).filter((h) => h && (h.ten_hang || h.loai_hang));
  return ds.length ? ds.map((h) => ({ ten: h.ten_hang || h.loai_hang, kl: +h.khoi_luong || 0 })) : [{ ten: v?.ten_hang || v?.loai_hang || "Hàng", kl: +v?.khoi_luong || 0 }];
};
export const giaiDoanMau = (v) => hangCuaChuyen(v).flatMap((h) => MAU_GIAI_DOAN[v?.huong === "xuat" ? "xuat" : "nhap"].map(([ten, ty_le, he_so]) => ({ hang: h.ten, ten, ty_le, he_so, toc_do: null })));

// Các đoạn làm hàng theo thứ tự (khối lượng, tốc độ t/ngày); khối lượng đã làm trừ dần từ đoạn đầu
export function doanLamHang(v, plan, tocDoCoSo, daLam = 0) {
  const hs = hangCuaChuyen(v);
  // Hàng đã trả lại tàu (v.kl_tra) không phải làm: thu nhỏ khối lượng các dòng hàng theo tỉ lệ
  const he = +v.khoi_luong > 0 ? klCanLam(v) / +v.khoi_luong : 1;
  const tongKL = (+v.khoi_luong || hs.reduce((s, h) => s + h.kl, 0)) * he;
  const gd = (Array.isArray(plan?.giai_doan) ? plan.giai_doan : []).map((g, i) => ({ ...g, _i: i })).filter((g) => +g.ty_le > 0);
  const ds = !gd.length ? [{ _i: -1, hang: null, ten: "Làm đều", ty_le: 100, he_so: 100, kl: tongKL, tocDo: tocDoCoSo }]
    : gd.map((g) => {
      const h = hs.find((x) => plain(x.ten) === plain(g.hang)) || (hs.length === 1 ? hs[0] : null);
      return { ...g, kl: (h ? h.kl * he : tongKL) * (+g.ty_le / 100), tocDo: +g.toc_do > 0 ? +g.toc_do : tocDoCoSo > 0 ? (tocDoCoSo * (+g.he_so || 100)) / 100 : null, khongRoHang: !h };
    });
  let bo = Math.max(0, +daLam || 0);
  return ds.map((d) => { const tru = Math.min(bo, d.kl); bo -= tru; return { ...d, daLam: tru, con: d.kl - tru }; });
}

// Mô phỏng các đoạn nối tiếp theo khối 12 giờ kể từ lúc bắt đầu (khởi động: hệ số theo khối).
// Trả { gio, doan: [{ ...đoạn, tuGio, denGio }], khuc: [{ a, b (giờ), tanGio }] } hoặc null khi thiếu tốc độ
export function moPhong(doan, khoiDong) {
  const hs = khoiDong === true ? HE_SO_KHOI_DONG : Array.isArray(khoiDong) ? khoiDong : [];
  let t = 0;
  const khuc = [], out = [];
  for (const d of doan) {
    const tu = t;
    let con = d.con;
    if (con > 1e-9 && !(d.tocDo > 0)) return null;
    for (let i = 0; i < 4000 && con > 1e-9; i++) {
      const k = Math.floor(t / 12 + 1e-9), tanGio = (d.tocDo / 24) * (hs[k] ?? 1), cuoi = (k + 1) * 12;
      const den = tanGio * (cuoi - t) >= con ? t + con / tanGio : cuoi;
      khuc.push({ a: t, b: den, tanGio });
      con -= tanGio * (den - t);
      t = den;
    }
    out.push({ ...d, tuGio: tu, denGio: t });
  }
  return { gio: t, doan: out, khuc };
}

export const xeGoiY = (tanCa, x) => { const mot = (+x.tai_trong || 0) * (+x.chuyen_ca || 0); return mot > 0 && tanCa > 0 ? Math.ceil(tanCa / mot) : null; };

// ctx: { cranes, stops, tien, now, choTrong(bai) -> tấn còn trống hoặc null, xeSanSang(loai) -> số xe sẵn sàng hoặc null }
export function tinhPhuongAn(v, plan, ctx = {}) {
  const { cranes = [], stops = [], tien = null, now = Date.now() } = ctx;
  const cs = chiSo(v, stops, now);
  const daBatDau = !!v.bd_lam_hang;
  const goiY = tocDoGoiY(cranes, plan);
  const tocDo = plan.toc_do != null && plan.toc_do !== "" ? +plan.toc_do : goiY.tanNgay;
  const batDau = daBatDau ? Math.max(now, ms(v.bd_lam_hang)) : ms(plan.bat_dau) ?? ms(v.atb) ?? ms(v.etb) ?? ms(v.eta) ?? now;
  // Giai đoạn: khối lượng còn lại = tổng các đoạn trừ phần đã làm (trừ dần từ đoạn đầu)
  const doan = doanLamHang(v, plan, tocDo, v.kt_lam_hang ? Infinity : cs.daLam);
  const conLai = v.kt_lam_hang ? 0 : doan.reduce((s, d) => s + d.con, 0);
  const mp = moPhong(doan, daBatDau ? false : heSoKhoiDong(plan));
  const lamGio = conLai > 0 ? (mp ? mp.gio : null) : 0;
  const dungGio = (+plan.gio_dung_tt || 0) + (+plan.gio_dung_khac || 0);
  const ketThuc = v.kt_lam_hang ? ms(v.kt_lam_hang) : lamGio == null ? null : batDau + (lamGio + dungGio) * HOUR;
  // Xe gợi ý theo ca cao điểm (đoạn nhanh nhất còn làm); khối lượng từng ca lấy theo mô phỏng
  const tocDoMax = Math.max(0, ...doan.filter((d) => d.con > 0).map((d) => d.tocDo || 0));
  const out = { tocDo, goiY, conLai, batDau, lamGio, dungGio, ketThuc, dt: null, etdGio: null, xe: [], tanCa: tocDoMax > 0 ? tocDoMax / 2 : tocDo > 0 ? tocDo / 2 : null, canh: [] };
  out.giaiDoan = (mp?.doan || doan).map((d) => ({ ...d, a: d.tuGio != null ? batDau + d.tuGio * HOUR : null, b: d.denGio != null ? batDau + d.denGio * HOUR : null }));
  out.coGiaiDoan = (plan.giai_doan || []).some((g) => +g?.ty_le > 0);
  // Tấn làm được trong khoảng [a, b] (ms) theo mô phỏng (chưa tính giờ dừng)
  out.tanTrong = mp ? (a, b) => mp.khuc.reduce((s, k) => { const x = Math.max(a, batDau + k.a * HOUR), y = Math.min(b, batDau + k.b * HOUR); return y > x ? s + (k.tanGio * (y - x)) / HOUR : s; }, 0) : null;
  if (out.coGiaiDoan) {
    const tong = new Map();
    for (const d of doan) if (d._i >= 0) tong.set(d.hang || "", (tong.get(d.hang || "") || 0) + (+d.ty_le || 0));
    for (const [h, pt] of tong) if (Math.abs(pt - 100) > 0.5) out.canh.push({ muc: "warn", nd: `${h || "Hàng"}: tổng các giai đoạn ${Math.round(pt * 10) / 10}% (cần 100%)` });
    const lech = doan.filter((d) => d.khongRoHang).map((d) => d.hang || "(trống)");
    if (lech.length) out.canh.push({ muc: "warn", nd: `Giai đoạn ghi hàng không có trong chuyến: ${[...new Set(lech)].join(", ")}` });
  }

  if (!(tocDo > 0)) out.canh.push({ muc: "warn", nd: (plan.cau || []).length || cauTauCua(plan) ? `Cẩu đã chọn chưa có năng suất trong danh mục${goiY.thieu.length ? ` (${goiY.thieu.join(", ")})` : ""}: nhập tốc độ dự kiến` : "Chưa chọn cẩu / chưa nhập tốc độ dự kiến" });
  else if (goiY.thieu.length || goiY.thieuCauTau) out.canh.push({ muc: "info", nd: `Cẩu chưa có năng suất (không tính vào gợi ý): ${[...goiY.thieu, ...(goiY.thieuCauTau ? ["cẩu tàu"] : [])].join(", ")}` });

  if (ketThuc != null) {
    // So với hạn laytime: coi như làm xong lúc ketThuc; giờ dừng do thời tiết được trừ laytime
    if (!laCQD(v)) {
      const gia = { ...v, bd_lam_hang: v.bd_lam_hang ?? iso(batDau), kt_lam_hang: iso(ketThuc), da_lam: v.khoi_luong };
      const thoiTiet = +plan.gio_dung_tt > 0 ? [{ tu: iso(batDau), den: iso(batDau + plan.gio_dung_tt * HOUR), tru_tp: true, ly_do: "Thời tiết (dự kiến)" }] : [];
      out.dt = duToan(gia, [...stops, ...thoiTiet], tien, now);
      if (out.dt.chenhNgay != null && out.dt.chenhNgay < 0) out.canh.push({ muc: "bad", nd: "Xong sau hạn laytime: bị phạt" });
    }
    if (v.etd) { out.etdGio = (ms(v.etd) - ketThuc) / HOUR; if (out.etdGio < 0) out.canh.push({ muc: "warn", nd: "Xong sau ETD hiện tại của tàu" }); }
  }

  out.xe = (plan.xe || []).filter((x) => x && x.loai).map((x) => {
    const gy = xeGoiY(out.tanCa, x);
    const so = x.so_xe != null && x.so_xe !== "" ? +x.so_xe : gy;
    return { ...x, goiY: gy, so };
  });
  // Theo từng ca: khối lượng, giai đoạn đang làm, xe cần (xe nhập số cố định giữ nguyên; để trống thì tính theo tấn của ca)
  out.theoCa = [];
  if (out.tanTrong && lamGio > 0) {
    const hetLam = batDau + lamGio * HOUR;
    for (const ca of caTrongKhoang(batDau, hetLam)) {
      const tan = out.tanTrong(ca.s, ca.e);
      if (!(tan > 0.5)) continue;
      const gd = out.giaiDoan.filter((d) => d.a != null && d.b > ca.s && d.a < ca.e && d.con > 0).map((d) => (d.hang ? `${d.hang} · ${d.ten}` : d.ten));
      out.theoCa.push({ ...ca, tan, giaiDoan: gd, xe: out.xe.map((x) => ({ loai: x.loai, don_vi: x.don_vi, so: x.so_xe != null && x.so_xe !== "" ? +x.so_xe : xeGoiY(tan, x) })) });
    }
  }
  out.diem = diemCua(plan);
  out.tbKhac = dsTb(plan.tb_khac);
  // Thiết bị Hòa Phát cần mỗi ca (xe + thiết bị tại các điểm + be hầm / hỗ trợ) so với số sẵn sàng của đội
  if (ctx.xeSanSang) for (const t of gopTB(out.xe, out.diem.map((d) => d.tb), out.tbKhac)) {
    if (t.don_vi === "nha_thau") continue;
    const sanSang = ctx.xeSanSang(t.loai);
    if (sanSang != null && t.so > sanSang) out.canh.push({ muc: "warn", nd: `${t.loai}: cần ${t.so}/ca, đội chỉ có ${sanSang} sẵn sàng` });
  }

  // Khối lượng từng điểm; tàu nhập: so với chỗ trống của bãi
  const coKL = out.diem.filter((d) => +d.khoi_luong > 0), tongKL = coKL.reduce((s, d) => s + +d.khoi_luong, 0);
  if (out.diem.length > 1 && coKL.length && Math.abs(tongKL - (+v.khoi_luong || 0)) > Math.max(1, 0.005 * (+v.khoi_luong || 0)))
    out.canh.push({ muc: "info", nd: `Tổng khối lượng các điểm ${soVN(tongKL)} t khác khối lượng tàu ${soVN(+v.khoi_luong || 0)} t` });
  if (v.huong !== "xuat" && conLai > 0) for (const d of out.diem) {
    if (!d.bai) continue;
    const can = +d.khoi_luong > 0 ? Math.min(+d.khoi_luong, conLai) : out.diem.length === 1 ? conLai : null;
    const trong = ctx.choTrong?.(d.bai);
    if (can != null && trong != null && trong < can) out.canh.push({ muc: "bad", nd: `${d.bai} chỉ còn trống khoảng ${soVN(trong)} t, thiếu chỗ cho ${soVN(can)} t` });
  }
  return out;
}

// Các ca công ty (CA 1 08:00–20:00, CA 2 20:00–08:00) giao với khoảng [a, b]
export function caTrongKhoang(a, b) {
  const out = [];
  const d0 = new Date(a);
  let t = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - 1, 20).getTime();
  for (let i = 0; i < 400 && t < b; i++) {
    const s = t, e = t + 12 * HOUR, so = new Date(s).getHours() === 8 ? 1 : 2;
    if (e > a) out.push({ s, e, so });
    t = e;
  }
  return out;
}

// Nhu cầu xe mã "PA-<phương án>-…" do bản cũ tự đẩy sang Ngắn hạn (nay xe của phương án đi vào Dài hạn, không vào Ngắn hạn): chỉ còn dùng để nhận ra và dọn
export const laNhuCauPA = (d, planId) => String(d.ma_nhu_cau || "").startsWith(planId == null ? "PA-" : `PA-${planId}-`);
export { DAY };
