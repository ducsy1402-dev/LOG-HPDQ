import { useEffect, useRef } from "react";
import { useApp } from "@/store";
import { useCtxXep, xepNhieu, canXepBen } from "./useXepBen";

// Tự xếp bến nền: chuyến chưa cập thật mà chưa có bến thì web tự xếp theo nguyên tắc (bến hợp mớn / chiều dài / DWT / loại hàng, cập sớm nhất,
// ưu tiên ★, chờ lâu, ETA sớm; hai tàu cùng bến nếu đủ số mét) rồi lưu, không cần bấm nút. Chỉ chạy với người có quyền nhập liệu phần Cảng.
// Mỗi chuyến chỉ thử lại khi thông số của nó đổi (không bến nào hợp thì để yên, hiện ở dòng "chưa xếp bến", sửa thông số sẽ được thử lại).
export default function TuXepTuDong() {
  const { D, quyen, run, api } = useApp();
  const ctx = useCtxXep();
  const daThu = useRef(new Map()), dangChay = useRef(false);
  useEffect(() => {
    if (!quyen.nhap || dangChay.current || !D.berths?.length) return;
    const khoa = (v) => [v.eta, v.etb, v.etd, v.dwt, v.loa, v.draft, v.khoi_luong, v.cam_ket, v.loai_hang, v.ten_hang, v.uu_tien, v.nor].join("|");
    const ds = D.voyages.filter((v) => canXepBen(v) && daThu.current.get(v.id) !== khoa(v));
    if (!ds.length) return;
    for (const v of ds) daThu.current.set(v.id, khoa(v));
    const kq = xepNhieu(ds, ctx).filter((x) => x.r);
    if (!kq.length) return;
    dangChay.current = true;
    run(async () => { for (const { v, r } of kq) await api.updateVoyage(v.id, { ben_ma: r.ben_ma, etb: r.etb, etd: r.etd }); },
      `Web đã tự xếp bến cho ${kq.length} chuyến: ${kq.map(({ v, r }) => `${v.ten_tau} → ${r.ben_ma}`).join(", ")}`)
      .finally(() => { dangChay.current = false; });
  }, [D.voyages, D.berths, ctx, quyen.nhap]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
