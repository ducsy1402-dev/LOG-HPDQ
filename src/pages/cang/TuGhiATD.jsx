import { useEffect, useRef } from "react";
import { useApp } from "@/store";
import { ms } from "@/lib/format";

// Tự ghi ATD = ETD (anh Sỹ chốt 17/11/2026): nhà khai thác không nhập ATD, nên chuyến chưa ghi ATD mà đã qua ETD thì web ghi ATD = ETD,
// để lần tàu đó đến sau là chuyến mới (mã chuyến mới). Chạy nền với người có quyền nhập liệu phần Cảng khi mở web / dữ liệu đổi.
// Bỏ qua: chuyến đã hủy, không có ETD, ETD sớm hơn ATB (số liệu sai thứ tự, để người dùng sửa). Mỗi bộ chuyến chỉ thử một lần (lỗi thì không lặp vô hạn).
export function chuyenCanGhiATD(voyages, now = Date.now()) {
  return voyages.filter((v) => !v.huy && !v.atd && v.etd && ms(v.etd) <= now && !(v.atb && ms(v.atb) > ms(v.etd)));
}
export default function TuGhiATD() {
  const { D, quyen, api, run } = useApp();
  const daThu = useRef(new Set()), dangChay = useRef(false);
  useEffect(() => {
    if (!quyen.nhap || dangChay.current || !D.voyages?.length) return;
    const ds = chuyenCanGhiATD(D.voyages, D.now);
    if (!ds.length) return;
    const dau = ds.map((v) => v.id).join(",");
    if (daThu.current.has(dau)) return;
    daThu.current.add(dau);
    dangChay.current = true;
    run(async () => { for (const v of ds) await api.updateVoyage(v.id, { atd: v.etd }); }, `Web đã ghi ATD = ETD cho ${ds.length} chuyến đã qua giờ rời dự kiến: ${ds.slice(0, 3).map((v) => v.ten_tau).join(", ")}${ds.length > 3 ? "…" : ""}`)
      .finally(() => { dangChay.current = false; });
  }, [D.voyages, D.now, quyen.nhap]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
