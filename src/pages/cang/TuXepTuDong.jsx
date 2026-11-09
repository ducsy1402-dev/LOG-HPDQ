import { useEffect, useRef, useState } from "react";
import { useApp } from "@/store";
import { ngayGio } from "@/lib/format";
import { giaiTrung } from "@/lib/tuXep";
import { useCtxXep, xepNhieu, canXepBen } from "./useXepBen";

// Tự xếp bến nền, chạy với người có quyền nhập liệu phần Cảng khi mở web hoặc khi dữ liệu đổi:
//  1. Chuyến chưa cập thật mà chưa có bến thì web tự xếp theo nguyên tắc (bến hợp mớn / chiều dài / DWT / loại hàng, cập sớm nhất,
//     ưu tiên ★, chờ lâu, ETA sớm; hai tàu cùng bến nếu đủ số mét) rồi lưu, không cần bấm nút. Chuyến đã có bến thì KHÔNG đụng tới bến.
//     Mỗi chuyến chỉ thử lại khi thông số của nó đổi (không bến nào hợp thì để yên, hiện ở dòng "chưa xếp bến").
//  2. Giải trùng: hai tàu cùng bến chồng giờ mà không đủ số mét (nhập tay ETB, kéo thả, dán nhanh, dữ liệu cũ…) thì tàu đứng sau trong hàng chờ
//     tự lùi tới sau khi tàu trước rời + 2 giờ (giaiTrung ở src/lib/tuXep.js). Tàu đã cập thật không bị dời.
export default function TuXepTuDong() {
  const { D, quyen, run, api } = useApp();
  const ctx = useCtxXep();
  const daThu = useRef(new Map()), daLui = useRef(new Set()), dangChay = useRef(false);
  const [lan, setLan] = useState(0); // chạy xong thì kiểm tra lại một lần (xếp bến xong mới giải trùng được)
  useEffect(() => {
    if (!quyen.nhap || dangChay.current || !D.berths?.length) return;
    const khoa = (v) => [v.eta, v.etb, v.etd, v.dwt, v.loa, v.draft, v.khoi_luong, v.cam_ket, v.loai_hang, v.ten_hang, v.uu_tien, v.nor].join("|");
    const ds = D.voyages.filter((v) => canXepBen(v) && daThu.current.get(v.id) !== khoa(v));
    for (const v of ds) daThu.current.set(v.id, khoa(v));
    const kq = ds.length ? xepNhieu(ds, ctx).filter((x) => x.r) : [];
    if (kq.length) {
      dangChay.current = true;
      run(async () => { for (const { v, r } of kq) await api.updateVoyage(v.id, { ben_ma: r.ben_ma, etb: r.etb, etd: r.etd }); },
        `Web đã tự xếp bến cho ${kq.length} chuyến: ${kq.map(({ v, r }) => `${v.ten_tau} → ${r.ben_ma}`).join(", ")}`)
        .finally(() => { dangChay.current = false; setLan((x) => x + 1); });
      return; // xếp xong dữ liệu đổi, lần chạy sau mới giải trùng trên số liệu mới
    }
    // Giải trùng: mỗi bộ thay đổi chỉ thử một lần (lưu lỗi thì không lặp vô hạn)
    const doi = giaiTrung(D.voyages, ctx);
    if (!doi.length) return;
    const dau = doi.map((x) => `${x.v.id}|${x.etb}`).join(";");
    if (daLui.current.has(dau)) return;
    daLui.current.add(dau);
    dangChay.current = true;
    run(async () => { for (const x of doi) await api.updateVoyage(x.v.id, { etb: x.etb, etd: x.etd }); },
      `Web đã lùi ${doi.length} chuyến trùng bến: ${doi.map((x) => `${x.v.ten_tau} → ${ngayGio(x.etb)}`).join(", ")}`)
      .finally(() => { dangChay.current = false; setLan((x) => x + 1); });
  }, [D.voyages, D.berths, ctx, quyen.nhap, lan]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
