import { useMemo } from "react";
import { useApp } from "@/store";
import { useThietBi } from "@/thietbi/Host";
import { tuXepBen, canTuXep } from "@/lib/linetime";
import { ms } from "@/lib/format";

// Dữ liệu cho tự xếp bến / ETB / ETD: bến, các chuyến, cẩu cảng (định mức theo bến), định mức cẩu cảng (Danh mục › Thiết bị cơ giới)
export function useCtxXep() {
  const { D } = useApp();
  const tbD = useThietBi()?.D;
  return useMemo(() => ({
    berths: D.berths, voyages: D.voyages, stopsOf: D.stopsOf, now: D.now,
    cranes: (tbD?.vehicles || []).filter((v) => v.doi === "Cẩu"),
    dinhMuc: (D.dmBang || []).filter((r) => r.bang === "cau_dm").map((r) => r.data),
  }), [D.berths, D.voyages, D.stopsOf, D.now, D.dmBang, tbD]);
}

// Xếp lần lượt nhiều chuyến (theo ETA): chuyến xếp trước tính là đã chiếm bến cho chuyến sau. Trả [{ v, r }] (r = null: không bến nào hợp)
// Chuyến đã có ETB (chưa có bến) thì xếp từ ETB.
export function xepNhieu(ds, ctx) {
  const daXep = [], out = [];
  for (const v of [...ds].sort((a, b) => (ms(a.etb) ?? ms(a.eta) ?? 0) - (ms(b.etb) ?? ms(b.eta) ?? 0))) {
    const tu = ms(v.etb) != null && ms(v.etb) > (ms(v.eta) ?? -Infinity) ? v.etb : v.eta;
    const r = tuXepBen({ ...v, eta: tu, etb: null, etd: null }, { ...ctx, voyages: [...ctx.voyages.filter((o) => !daXep.some((x) => x.id === o.id)), ...daXep] });
    if (r) daXep.push({ ...v, ben_ma: r.ben_ma, etb: r.etb, etd: r.etd, id: v.id ?? `moi${out.length}` });
    out.push({ v, r });
  }
  return out;
}
export { canTuXep };
