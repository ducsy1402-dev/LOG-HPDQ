import { useEffect, useRef } from "react";
import { useApp } from "@/store";
import { chuyenDaRoi } from "@/lib/linetime";
import { canGhiLaiKeHoach, dauMocKH, ngayDia } from "@/lib/keHoachNgay";

// Kế hoạch sản lượng theo ngày DỜI THEO LỊCH TÀU (anh Sỹ 22/11/2026): chạy nền với người có quyền nhập kế hoạch ngày. Khi lịch tàu đổi (ETB, ETD, giờ làm hàng…),
// khối lượng các ngày của chuyến chưa rời được chia lại theo tỉ lệ thời gian và ghi vào CSDL (xem dichKeHoach ở lib/keHoachNgay.js); dòng cũ chưa có dấu mốc lịch tàu thì được gắn dấu.
// Người không có quyền ghi vẫn thấy số đã dời (các màn hình tự dời khi đọc), chỉ là CSDL chưa cập nhật tới khi có người có quyền mở web.
const DAY = 864e5;
export default function TuDoiKeHoach() {
  const { D, api, quyen, run } = useApp();
  const dangChay = useRef(false), cuoi = useRef("");
  useEffect(() => {
    if (!quyen.keHoachNgay || dangChay.current || !D.voyages?.length) return;
    // Chỉ chạy khi khoảng làm hàng của chuyến chưa rời đổi so với lần trước
    const chuaRoi = D.voyages.filter((v) => !v.huy && !chuyenDaRoi(v, D.now));
    const dau = chuaRoi.map((v) => `${v.id}:${dauMocKH(v)}`).join(",");
    if (dau === cuoi.current) return;
    cuoi.current = dau;
    dangChay.current = true;
    (async () => {
      try {
        const raw = await api.docKeHoachNgay(ngayDia(D.now - 45 * DAY), ngayDia(D.now + 150 * DAY));
        if (!raw?.length) return;
        const { ops, doi } = canGhiLaiKeHoach(raw, new Map(D.voyages.map((v) => [v.id, v])), D.now);
        if (!ops.length) return;
        await run(() => api.saveKeHoachNgay(ops), doi.size ? `Kế hoạch ngày đã dời theo lịch tàu thay đổi (${doi.size} chuyến: ${[...doi].slice(0, 3).map((id) => D.vmap?.get(id)?.ten_tau || id).join(", ")}${doi.size > 3 ? "…" : ""})` : undefined);
      } catch (e) { console.error(e); } finally { dangChay.current = false; }
    })();
  }, [D.voyages, D.now, quyen.keHoachNgay]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
