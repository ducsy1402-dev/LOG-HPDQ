import { useApp } from "@/store";
import { Badge } from "@/components/ui/badge";
import { khaiBao } from "@/lib/khaiBao";

// Hai thẻ trạng thái khai báo của chuyến: cầu bến (đủ / thiếu …) và phương án (chưa / sơ bộ / đang lập / duyệt)
export default function KhaiBaoTT({ v }) {
  const { D } = useApp();
  const kb = khaiBao(v, D.plansOf(v.id), { coSql19: D.coSql19 });
  return (
    <div className="flex flex-wrap gap-1">
      <Badge tone={kb.thieuCB.length ? "warn" : "ok"} title={kb.thieuCB.length ? `Cầu bến chưa khai: ${kb.thieuCB.join(", ")}` : "Cầu bến đã khai đủ bến, ETB, khối lượng, số máng"}>CB: {kb.thieuCB.length ? `thiếu ${kb.thieuCB.length}` : "đủ"}</Badge>
    </div>
  );
}

// Dấu tàu ưu tiên vào sớm
export const UuTien = ({ v }) => (v.uu_tien ? <span className="mr-1 text-warn" title="Tàu ưu tiên vào sớm">★</span> : null);
