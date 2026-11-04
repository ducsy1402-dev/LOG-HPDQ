// Tự xếp bến: một chuyến, nhiều chuyến (thứ tự ưu tiên) và xếp lại toàn bộ chuyến chưa cập (xem trước).
// Bến chọn theo xepBen.js; chia sẻ bến theo số mét (capBen.etbSomNhatMet): hai tàu cùng bến cùng lúc nếu đủ số mét theo quy tắc cập cầu bến.
import { ms } from "./format";
import { xepBenTuDong } from "./xepBen";
import { doanBen } from "./linetime";
import { etbSomNhatMet } from "./capBen";

// ctx: { berths, voyages, stopsOf, now, cranes, dinhMuc }
export const tuXepBen = (v, ctx) => xepBenTuDong(v, { etbSom: etbSomNhatMet, ...ctx, doanBen });
// Chuyến cần web tự xếp bến: chưa cập thật, chưa có bến (có ETB / ETD thì giữ nếu bến trống đúng giờ đó)
export const canXepBen = (v) => !v.huy && !v.atb && !v.ben_ma;
export const canTuXep = (v) => canXepBen(v) && !v.etb && !v.etd;
// Như tuXepBen nhưng giữ ETB / ETD người dùng đã nhập khi bến chọn được trống đúng giờ ETB đó; bến bận thì dời theo nguyên tắc
export function tuXepBenGiuMoc(v, ctx) {
  const eta = ms(v.eta), etb = ms(v.etb), tu = etb != null && (eta == null || etb >= eta) ? v.etb : v.eta;
  const r = tuXepBen({ ...v, eta: tu, etb: null, etd: null }, ctx);
  if (!r) return null;
  if (etb != null && ms(r.etb) === ms(tu)) return { ...r, etb: v.etb, etd: ms(v.etd) > etb ? v.etd : r.etd };
  return r;
}

// Thứ tự ưu tiên khi xếp nhiều chuyến cùng lúc: tàu ưu tiên (★) trước; rồi tàu đã chờ lâu hơn (từ NOR, chưa có NOR thì từ ETA, tính đến hôm nay); rồi ETA sớm hơn.
// Chuyến xếp trước tính là đã chiếm bến cho chuyến sau (ETA đến sau thì xếp lót sau). Trả [{ v, r }] (r = null: không bến nào hợp).
export const doCho = (v, now) => { const t = ms(v.nor) ?? ms(v.eta); return t == null ? 0 : Math.max(0, now - t); };
export function xepNhieu(ds, ctx) {
  const now = ctx.now ?? Date.now(), daXep = [], out = [];
  const thuTu = [...ds].sort((a, b) => (b.uu_tien ? 1 : 0) - (a.uu_tien ? 1 : 0) || doCho(b, now) - doCho(a, now) || (ms(a.eta) ?? 0) - (ms(b.eta) ?? 0));
  for (const v of thuTu) {
    const r = tuXepBenGiuMoc(v, { ...ctx, voyages: [...ctx.voyages.filter((o) => !daXep.some((x) => x.id === o.id)), ...daXep] });
    if (r) daXep.push({ ...v, ben_ma: r.ben_ma, etb: r.etb, etd: r.etd, id: v.id ?? `moi${out.length}` });
    out.push({ v, r });
  }
  return out;
}

// Xếp lại toàn bộ chuyến chưa cập thật (không hủy, chưa có ATB), trừ các chuyến trong giu (giữ nguyên chỗ). Chuyến đã cập thật là chỗ cố định.
// Bỏ bến, vị trí, ETB, ETD cũ rồi xếp lần lượt theo thứ tự ưu tiên của xepNhieu. Chuyến không bến nào hợp thì giữ nguyên chỗ cũ (và vẫn chiếm chỗ cho chuyến sau).
// Trả [{ v (chuyến gốc), r (đề xuất | null), doi (khác chỗ / giờ cũ) }] theo thứ tự xếp.
export function xepLai(voyages, ctx, giu = new Set()) {
  const dich = voyages.filter((v) => !v.huy && !v.atb && !giu.has(v.id));
  const goc = new Map(dich.map((v) => [v.id, v]));
  let khongHop = new Set(), kq = [];
  for (let lan = 0; lan < 4; lan++) {
    const xep = dich.filter((v) => !khongHop.has(v.id));
    const ids = new Set(xep.map((v) => v.id));
    const coDinh = voyages.filter((v) => !ids.has(v.id));
    kq = xepNhieu(xep.map((v) => ({ ...v, ben_ma: null, ben_phu: null, vi_tri: null, etb: null, etd: null })), { ...ctx, voyages: coDinh });
    const moi = new Set(kq.filter((x) => !x.r).map((x) => x.v.id));
    if ([...moi].every((id) => khongHop.has(id))) break;
    khongHop = new Set([...khongHop, ...moi]);
  }
  const ra = kq.filter((x) => x.r).map(({ v, r }) => { const g = goc.get(v.id); return { v: g, r, doi: g.ben_ma !== r.ben_ma || ms(g.etb) !== ms(r.etb) || ms(g.etd) !== ms(r.etd) || !!g.ben_phu }; });
  for (const id of khongHop) ra.push({ v: goc.get(id), r: null, doi: false });
  return ra;
}
