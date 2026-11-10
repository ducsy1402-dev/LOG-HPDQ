import { useEffect, useRef, useState } from "react";
import { useApp } from "@/store";
import { ngayGio } from "@/lib/format";
import { hangChoLai } from "@/lib/tuXep";
import { useCtxXep } from "./useXepBen";

// Tự xếp bến và hàng chờ nền, chạy với người có quyền nhập liệu phần Cảng khi mở web hoặc khi dữ liệu đổi (hangChoLai ở src/lib/tuXep.js):
//  - Chuyến chưa cập thật mà chưa có bến: web chọn bến hợp mớn / chiều dài / DWT / loại hàng, cập sớm nhất. Chuyến đã có bến thì KHÔNG đổi bến.
//  - Giờ cập (ETB, ETD) của mọi chuyến chưa cập thật được xếp lại theo thứ tự: tàu ưu tiên ★, rồi tàu đến trước (NOR, ETA), mỗi tàu lấy chỗ trống sớm nhất
//    (hai tàu cùng bến cùng lúc nếu đủ số mét). Thêm tàu có ETA sớm hơn hoặc có ★ thì tàu đó lên trước, tàu sau lùi; có chỗ trống sớm thì tàu được kéo lên.
//  - Không đụng tàu đã cập thật (ATB), tàu đã có giờ cập đã qua, tàu chuyển bến / ra neo, đã rời, đã hủy.
// Mỗi bộ thay đổi chỉ thử một lần (lưu lỗi thì không lặp vô hạn).
export default function TuXepTuDong() {
  const { D, quyen, run, api } = useApp();
  const ctx = useCtxXep();
  const daThu = useRef(new Set()), dangChay = useRef(false);
  const [lan, setLan] = useState(0); // chạy xong thì kiểm tra lại một lần
  useEffect(() => {
    if (!quyen.nhap || dangChay.current || !D.berths?.length) return;
    const doi = hangChoLai(D.voyages, ctx);
    if (!doi.length) return;
    const dau = doi.map((x) => `${x.v.id}|${x.patch.ben_ma || ""}|${x.patch.etb || ""}`).join(";");
    if (daThu.current.has(dau)) return;
    daThu.current.add(dau);
    const moiBen = doi.filter((x) => x.patch.ben_ma), lai = doi.filter((x) => !x.patch.ben_ma && x.patch.etb);
    const nd = [
      moiBen.length ? `tự xếp bến cho ${moiBen.length} chuyến: ${moiBen.map((x) => `${x.v.ten_tau} → ${x.patch.ben_ma}`).join(", ")}` : "",
      lai.length ? `xếp lại giờ cập ${lai.length} chuyến: ${lai.slice(0, 4).map((x) => `${x.v.ten_tau} → ${ngayGio(x.patch.etb)}`).join(", ")}${lai.length > 4 ? "…" : ""}` : "",
    ].filter(Boolean).join(" · ");
    dangChay.current = true;
    run(async () => { for (const x of doi) await api.updateVoyage(x.v.id, x.patch); }, `Web đã ${nd || `cập nhật ${doi.length} chuyến`}`)
      .finally(() => { dangChay.current = false; setLan((x) => x + 1); });
  }, [D.voyages, D.berths, ctx, quyen.nhap, lan]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
