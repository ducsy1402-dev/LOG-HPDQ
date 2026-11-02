import { hangChuaCoNhom } from "@/lib/sanLuong";
import { so } from "@/lib/format";

// Nhắc: hàng của các chuyến chưa có nhóm trong Danh mục › Hàng hóa (đang hiện theo tên hàng, không gom vào Quặng / Than / Đá…)
export default function ChuaCoNhom({ ds, nhom, go }) {
  const l = hangChuaCoNhom(ds, nhom);
  if (!l.length) return null;
  const mo = () => { try { localStorage.setItem("lg-danh-muc-tab", "hang"); } catch { /* bỏ qua */ } if (go) go("danh-muc"); else location.hash = "#/danh-muc"; };
  return (
    <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-xs">
      <b>{l.length} loại hàng chưa có nhóm</b> trong Danh mục › Hàng hóa nên đang hiện theo tên, chưa gom vào Quặng / Than / Đá…: {l.slice(0, 8).map((x) => `${x.ten}${x.kl ? ` (${so(x.kl)} t)` : ""}`).join("; ")}{l.length > 8 ? `; … và ${l.length - 8} loại nữa` : ""}.
      {" "}Thêm vào danh mục hàng hóa kèm cột <b>Nhóm</b> rồi bấm F5. <button type="button" className="font-semibold text-primary underline" onClick={mo}>Mở Danh mục › Hàng hóa</button>
    </div>
  );
}
