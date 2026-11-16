// Điều độ (Thiết bị cơ giới): gom số liệu thiết bị, nhân sự, nhu cầu xe của ca để người điều độ nhìn bao quát và quyết định điều tiết.
// Hàm thuần (không React): kiểm thử ở dieu_do.test.js.
import { buildShifts, caList, planWarnings, rulesOf, mapLoaiPt, demPT } from "./plan";
import { rateTone } from "./compute";

const KHAN = ["bad", "warn", "info"];
const laCau = (v) => v?.doi === "Cẩu";

// Nhu cầu xe trong kế hoạch ngày (Kế hoạch & báo cáo › Kế hoạch ngày) theo ca: ca đang diễn ra và ca kế tiếp có nhu cầu.
// Trả null khi CSDL chưa có bảng kế hoạch (D.plan = null).
export function nhuCauTheoCa(D, now = Date.now()) {
  const P = D.plan;
  if (!P?.demands) return null;
  const demands = P.demands.map((d) => ({ ...d, ca: new Date(d.tg_bat_dau).toISOString() }));
  const rong = { hienTai: null, keTiep: null, canhBaoXe: [] };
  if (!demands.length) return rong;
  const shifts = buildShifts(demands, D);
  const cas = caList(shifts);
  const rules = rulesOf(D.mapPt);
  const shOf = (k) => shifts.find((s) => s.key === k);
  const keys = new Set(shifts.map((s) => s.key));
  const asg = P.assignments.map((a) => ({ ...a, ca_bat_dau: new Date(a.ca_bat_dau).toISOString() })).filter((a) => keys.has(a.ca_bat_dau));
  const demOf = (ma) => demands.find((d) => d.ma_nhu_cau === ma);
  const warn = planWarnings(asg, { D, demOf, shOf, rules });

  const dung = (c) => {
    if (!c) return null;
    const ds = demands.filter((d) => shOf(d.ca)?.g === c.key);
    const slot = new Set(shifts.filter((s) => s.g === c.key).map((s) => s.key));
    const as = asg.filter((a) => slot.has(a.ca_bat_dau));
    const nhuCau = ds.map((d) => {
      const g = as.filter((a) => a.ma_nhu_cau === d.ma_nhu_cau && a.ca_bat_dau === d.ca);
      const can = Math.max(1, +d.so_pt || 1), daGan = demPT(g);
      return { d, doi: mapLoaiPt(d.loai_pt, rules, D.taiTrongList)?.doi || null, can, daGan, thieu: Math.max(0, can - daGan) };
    });
    const canhBaoXe = as.filter((a) => a.ma_xe && (warn.get(a.id) || []).some((w) => w === "Xe đang hỏng" || w === "Xe đang BD chiến lược"))
      .map((a) => ({ ma: a.ma_xe, noiDung: demOf(a.ma_nhu_cau)?.noi_dung || "", hong: (warn.get(a.id) || []).includes("Xe đang hỏng") }));
    return {
      ca: c, label: c.label, nhuCau,
      tongCan: nhuCau.reduce((a, x) => a + x.can, 0), tongGan: nhuCau.reduce((a, x) => a + Math.min(x.can, x.daGan), 0),
      soThieu: nhuCau.filter((x) => x.thieu > 0).length, tongThieu: nhuCau.reduce((a, x) => a + x.thieu, 0),
      xeGan: new Set(as.filter((a) => a.ma_xe).map((a) => a.ma_xe)), canhBaoXe,
    };
  };
  const hienTai = cas.find((c) => c.start <= now && now < c.end) || null;
  const keTiep = cas.find((c) => c.start > now && c.key !== hienTai?.key) || null;
  return { hienTai: dung(hienTai), keTiep: dung(keTiep), canhBaoXe: [] };
}

export function tinhDieuDo(D, now = new Date()) {
  const ms = +now;
  const T = D.T;
  const cas = D.upcomingShifts(now);
  const caNay = cas.find((x) => x.dangChay && !x.hc) || cas.find((x) => !x.hc) || cas[0] || null;
  const caTiep = caNay ? cas.find((x) => !x.hc && x.start > caNay.start) || null : null;
  const caHC = cas.find((x) => x.hc) || null;
  const caHienThi = [...cas].sort((a, b) => a.hc - b.hc || a.start - b.start); // ca đi ca trước, ca hành chính cuối
  const quanSo = caHienThi.map((sh) => ({ sh, kip: D.shiftKip(sh), rows: D.shiftRows(sh) }));
  const nhuCau = nhuCauTheoCa(D, ms);

  // ---- Thiết bị ----
  const xe = D.vehicles.filter((v) => !laCau(v)), cau = D.vehicles.filter(laCau);
  const sXe = D.summarize(xe), sCau = D.summarize(cau);

  // ---- Từng đội: năng lực đáp ứng của ca đang diễn ra ----
  const rowsNay = caNay ? D.shiftRows(caNay) : [];
  const cheDo = caNay?.hc ? "HC" : "Đi ca";
  const xeGan = nhuCau?.hienTai?.xeGan || new Set();
  const doiBang = D.doiList.filter((d) => D.vehicles.some((v) => v.doi === d)).map((doi) => {
    const vs = D.vehicles.filter((v) => v.doi === doi);
    const s = D.summarize(vs);
    const r = rowsNay.find((x) => x.doi === doi);
    const xeCa = vs.filter((v) => v.che_do === cheDo && D.isReady(v.ma));
    const daGan = nhuCau ? xeCa.filter((v) => xeGan.has(v.ma)).length : null;
    const nc = nhuCau?.hienTai?.nhuCau.filter((x) => x.doi === doi) || [];
    return {
      doi, tong: s.tong, ready: s.ready, hong: s.hong, bdcl: s.bdcl, rate: s.rate, tone: rateTone(s.rate, T),
      xeCan: r?.xeCan ?? xeCa.length, dinhBien: r?.dinhBien ?? 0, thucTe: r?.thucTe ?? null, chenh: r?.chenh ?? null,
      daGan, ranh: daGan == null ? null : Math.max(0, xeCa.length - daGan),
      xeRanh: daGan == null ? null : xeCa.filter((v) => !xeGan.has(v.ma)).map((v) => ({ ma: v.ma, to: v.to_xe, state: D.stateOf(v.ma) })), // mã xe rảnh (bấm số xe rảnh để xem)
      can: nhuCau ? nc.reduce((a, x) => a + x.can, 0) : null, thieuXe: nhuCau ? nc.reduce((a, x) => a + x.thieu, 0) : null,
    };
  });

  // ---- Việc cần quyết định ----
  // Quân số chỉ báo cho ca đang diễn ra (đỏ / vàng) và ca kế tiếp (vàng); các ca xa hơn xem ở bảng "Quân số các ca tới"
  const ds = [];
  const them = (muc, nd, di) => ds.push({ muc, nd, ...di });
  for (const { sh, rows } of quanSo) {
    const laNay = sh === caNay || sh.start === caNay?.start;
    const laTiep = !!caTiep && sh.start === caTiep.start;
    if (!laNay && !laTiep) continue;
    const ten = D.shiftLabel(sh);
    const tos = D.coSql14 ? D.shiftByTo(sh) : [];
    for (const r of rows) {
      if (r.chenh != null && r.chenh < 0) {
        const toThieu = tos.filter((t) => t.doiChinh === r.doi && t.chenh != null && t.chenh < 0).map((t) => `${t.to} −${-t.chenh}`);
        them(laNay ? "bad" : "warn", `${ten}${laNay ? "" : " (ca tới)"} · đội ${r.doi} thiếu ${-r.chenh} người (có ${r.thucTe}, cần ${r.xeCan} cho xe sẵn sàng)${toThieu.length ? ` — ${toThieu.join(", ")}` : ""}`, { tab: "quan-so" });
      } else if (laNay && r.thucTe == null && r.xeCan > 0 && r.dinhBien < r.xeCan) {
        them("warn", `${ten} · đội ${r.doi}: định biên kíp chỉ ${r.dinhBien} người, ít hơn ${r.xeCan} xe sẵn sàng`, { tab: "quan-so" });
      }
    }
    const toChua = rows.reduce((a, r) => a + (r.toChua || 0), 0);
    if (toChua) them(laNay ? "warn" : "info", `${ten}: còn ${toChua} tổ chưa nhập quân số`, { tab: "quan-so" });
    const chua = rows.filter((r) => r.thucTe == null && r.xeCan > 0);
    if (chua.length) them(laNay ? "warn" : "info", `${ten}: chưa nhập quân số ${chua.length > 3 ? chua.length + " đội" : "đội " + chua.map((r) => r.doi).join(", ")}`, { tab: "quan-so" });
  }
  if (nhuCau?.hienTai) {
    const h = nhuCau.hienTai;
    if (h.tongThieu > 0) them("bad", `${h.label} (đang diễn ra): ${h.soThieu} nhu cầu chưa đủ xe, còn thiếu ${h.tongThieu} xe / ${h.tongCan}`, { kh: "ngay" });
    for (const x of h.canhBaoXe) them("bad", `Xe ${x.ma} đã gán cho "${x.noiDung}" nhưng ${x.hong ? "đang hỏng" : "đang BD chiến lược"}: cần đổi xe`, { xe: x.ma });
  }
  if (nhuCau?.keTiep) {
    const k = nhuCau.keTiep;
    if (k.tongThieu > 0) them("warn", `${k.label} (ca tới): ${k.soThieu} nhu cầu chưa đủ xe, còn thiếu ${k.tongThieu} xe / ${k.tongCan}`, { kh: "ngay" });
    for (const x of k.canhBaoXe) them("warn", `${k.label}: xe ${x.ma} đã gán cho "${x.noiDung}" nhưng ${x.hong ? "đang hỏng" : "đang BD chiến lược"}`, { xe: x.ma });
  }
  // Điều tiết xe giữa các đội: đội thiếu xe mà còn xe sẵn sàng chưa gán thì gán thêm; hết xe rảnh thì mượn / thuê ngoài
  const duocGan = doiBang.filter((d) => d.thieuXe > 0 && d.ranh > 0);
  const hetXe = doiBang.filter((d) => d.thieuXe > 0 && !(d.ranh > 0));
  if (duocGan.length) them("info", `Còn xe sẵn sàng chưa gán để bù nhu cầu: ${duocGan.map((d) => `${d.doi} (thiếu ${d.thieuXe}, rảnh ${d.ranh})`).join("; ")}. Gán thêm ở Kế hoạch ngày`, { kh: "ngay" });
  if (hetXe.length) them("warn", `Hết xe rảnh mà nhu cầu vẫn thiếu: ${hetXe.map((d) => `${d.doi} (thiếu ${d.thieuXe})`).join("; ")}. Cân nhắc mượn đội khác / xe HC hoặc thuê nhà thầu`, { kh: "ngay" });
  for (const d of doiBang) if (d.tone === "bad" && d.tong >= 3) them("bad", `Đội ${d.doi} chỉ sẵn sàng ${Math.round(d.rate * 100)}% (${d.ready}/${d.tong} xe)`, { tab: "su-kien" });
  const nang = D.open.filter((e) => D.flags(e).some((f) => f.tone === "bad")).sort((a, b) => String(a.ngay_vao).localeCompare(String(b.ngay_vao)));
  for (const e of nang.slice(0, 5)) {
    const f = D.flags(e).find((x) => x.tone === "bad");
    them("bad", `${e.ma_xe} (${D.vmap[e.ma_xe]?.doi || ""}): ${e.loai} — ${f.label}`, { xe: e.ma_xe });
  }
  if (nang.length > 5) them("warn", `Còn ${nang.length - 5} thiết bị khác hỏng lâu / quá hạn`, { tab: "su-kien" });
  const chuaPT = D.open.filter((e) => e.phu_tung === "Chờ phụ tùng").length;
  if (chuaPT) them("warn", `${chuaPT} sự kiện đang chờ phụ tùng`, { tab: "su-kien" });
  ds.sort((a, b) => KHAN.indexOf(a.muc) - KHAN.indexOf(b.muc));

  // ---- Thiết bị đang dừng, nặng nhất trước ----
  const diem = (e) => (D.flags(e).some((f) => f.tone === "bad") ? 0 : 1) * 1e6 + (e.loai === "Hỏng" ? 0 : 1) * 1e5 + Number(String(e.ngay_vao || "").replace(/-/g, ""));
  const dung = D.open.filter((e) => e.loai !== "BD định kỳ").slice().sort((a, b) => diem(a) - diem(b));

  return { caNay, caTiep, caHC, quanSo, nhuCau, sXe, sCau, doiBang, canhBao: ds, dung, conLai: caNay ? Math.max(0, caNay.end - ms) : 0 };
}
