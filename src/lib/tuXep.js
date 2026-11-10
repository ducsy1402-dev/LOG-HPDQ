// Tự xếp bến: một chuyến, nhiều chuyến (thứ tự ưu tiên) và xếp lại toàn bộ chuyến chưa cập (xem trước).
// Bến chọn theo xepBen.js (CHỈ cho chuyến chưa khai báo bến; đã có bến thì giữ nguyên bến). Chia sẻ bến theo số mét (capBen.etbSomNhatMet): hai tàu cùng bến
// cùng lúc nếu đủ số mét theo quy tắc cập cầu bến. Hàng chờ động (hangChoLai ở cuối file): mọi tàu chưa cập được xếp lại theo thứ tự ưu tiên ★, đến trước, mỗi tàu
// lấy chỗ trống sớm nhất; tàu mới có ETA sớm hơn hoặc có ★ thì chen lên trước và các tàu sau lùi lại.
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
// Chuyến ĐÃ khai báo bến thì GIỮ NGUYÊN bến (bến phụ, vị trí), chỉ xếp lại ETB, ETD; chuyến chưa có bến thì web chọn bến. Bỏ ETB, ETD cũ rồi xếp lần lượt theo thứ tự ưu tiên của xepNhieu. Chuyến không bến nào hợp thì giữ nguyên chỗ cũ (và vẫn chiếm chỗ cho chuyến sau).
// Trả [{ v (chuyến gốc), r (đề xuất | null), doi (khác chỗ / giờ cũ) }] theo thứ tự xếp.
export function xepLai(voyages, ctx, giu = new Set()) {
  const dich = voyages.filter((v) => !v.huy && !v.atb && !giu.has(v.id));
  const goc = new Map(dich.map((v) => [v.id, v]));
  let khongHop = new Set(), kq = [];
  for (let lan = 0; lan < 4; lan++) {
    const xep = dich.filter((v) => !khongHop.has(v.id));
    const ids = new Set(xep.map((v) => v.id));
    const coDinh = voyages.filter((v) => !ids.has(v.id));
    kq = xepNhieu(xep.map((v) => ({ ...v, ...(v.ben_ma ? {} : { ben_phu: null, vi_tri: null }), etb: null, etd: null })), { ...ctx, voyages: coDinh });
    const moi = new Set(kq.filter((x) => !x.r).map((x) => x.v.id));
    if ([...moi].every((id) => khongHop.has(id))) break;
    khongHop = new Set([...khongHop, ...moi]);
  }
  const ra = kq.filter((x) => x.r).map(({ v, r }) => { const g = goc.get(v.id); return { v: g, r, doi: g.ben_ma !== r.ben_ma || ms(g.etb) !== ms(r.etb) || ms(g.etd) !== ms(r.etd) || (!g.ben_ma && !!g.ben_phu) }; });
  for (const id of khongHop) ra.push({ v: goc.get(id), r: null, doi: false });
  return ra;
}

// Hàng chờ động (anh Sỹ chốt 10/11/2026): xếp lại GIỜ CẬP (ETB, ETD) của mọi tàu chưa cập thật theo đúng thứ tự ưu tiên của xepNhieu
// (★ trước, rồi tàu chờ lâu / đến trước, rồi ETA sớm), mỗi tàu lấy chỗ trống sớm nhất theo số mét. Nhờ vậy tàu thêm sau mà ETA sớm hơn hoặc có ★ sẽ ở trước,
// các tàu còn lại lùi theo; tàu còn chỗ trống sớm hơn thì được kéo lên sớm, không nằm chờ vô lý.
// Giữ nguyên (chiếm chỗ cho tàu khác): tàu đã cập thật (ATB), đã có giờ cập ETB đã qua (đang ở bến theo dự kiến), có chuyển bến / ra neo, đã rời, đã hủy.
// Tàu đã có bến giữ bến; tàu chưa có bến thì được chọn bến. Trả [{ v (chuyến gốc), patch: { ben_ma?, etb?, etd? } }] chỉ gồm tàu có thay đổi.
export function hangChoLai(voyages, ctx) {
  const { stopsOf = () => [], now = Date.now() } = ctx;
  const song = voyages.filter((v) => !v.huy && !v.atd);
  const codinh = (v) => !!v.atb || (stopsOf(v.id) || []).length > 0 || (ms(v.etb) != null && ms(v.etb) <= now);
  const dich = song.filter((v) => !codinh(v)), ids = new Set(dich.map((v) => v.id));
  const goc = new Map(dich.map((v) => [v.id, v]));
  const kq = xepNhieu(dich.map((v) => ({ ...v, etb: null, etd: null })), { ...ctx, etbSom: etbSomNhatMet, voyages: voyages.filter((v) => !ids.has(v.id)) });
  const out = [];
  for (const { v, r } of kq) {
    if (!r) continue;
    const g = goc.get(v.id), patch = {};
    if (!g.ben_ma) patch.ben_ma = r.ben_ma;
    if (ms(g.etb) == null || Math.abs(ms(g.etb) - ms(r.etb)) > 60000) patch.etb = r.etb;
    if (ms(g.etd) == null || Math.abs(ms(g.etd) - ms(r.etd)) > 60000) patch.etd = r.etd;
    if (Object.keys(patch).length) out.push({ v: g, patch });
  }
  return out;
}
