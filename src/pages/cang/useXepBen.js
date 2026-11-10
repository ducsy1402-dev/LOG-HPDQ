import { useMemo } from "react";
import { useApp } from "@/store";
import { useThietBi } from "@/thietbi/Host";
import { etbSomNhatMet } from "@/lib/capBen";

// Dữ liệu cho tự xếp bến / ETB / ETD: bến, các chuyến, cẩu cảng (định mức theo bến), định mức cẩu cảng (Danh mục › Thiết bị cơ giới)
export function useCtxXep() {
  const { D } = useApp();
  const tbD = useThietBi()?.D;
  return useMemo(() => ({
    berths: D.berths, voyages: D.voyages, stopsOf: D.stopsOf, now: D.now, etbSom: etbSomNhatMet, // ETB sớm nhất có chia sẻ bến theo số mét
    cranes: (tbD?.vehicles || []).filter((v) => v.doi === "Cẩu"),
    dinhMuc: (D.dmBang || []).filter((r) => r.bang === "cau_dm").map((r) => r.data),
  }), [D.berths, D.voyages, D.stopsOf, D.now, D.dmBang, tbD]);
}

export { canTuXep, canXepBen, xepNhieu, xepLai } from "@/lib/tuXep";
