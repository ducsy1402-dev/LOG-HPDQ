import { useApp } from "@/store";
import { chiSo, trangThai } from "@/lib/linetime";
import { so, ngayGio } from "@/lib/format";
import { TienDo, TrangThaiBadge } from "@/components/common";
import { cn } from "@/lib/utils";
import { tenBen, tenBenChuyen } from "@/lib/tenBen";
export { tenBen, tenBenChuyen, noiHaiBen } from "@/lib/tenBen";
const O_BEN = new Set(["cap_ben", "lam_hang", "xong_hang"]);

// Bảng tàu theo bến (như hình 3): mỗi bến một dòng, tàu đang ở bến với thanh tiến độ xanh (đã làm) / đỏ (còn lại)
export default function BangTauBen({ chiCoTau = false }) {
  const { D, setVoyageMo } = useApp();
  const dangO = new Map();
  // Tàu cập hai bến (bến phụ) hiện ở cả hai bến
  for (const v of D.voyages) if (v.ben_ma && O_BEN.has(trangThai(v))) for (const ma of [v.ben_ma, v.ben_phu].filter(Boolean)) (dangO.get(ma) || dangO.set(ma, []).get(ma)).push(v);
  const dong = D.berths.flatMap((b) => { const ds = dangO.get(b.ma) || []; return ds.length ? ds.map((v, i) => ({ b, v, dau: i === 0, n: ds.length })) : chiCoTau ? [] : [{ b, v: null, dau: true, n: 1 }]; });
  return (
    <div className="scroll-x max-h-[620px]">
      <table className="tbl">
        <thead><tr><th>Bến</th><th>Tàu</th><th>Loại hàng</th><th>Tên hàng</th><th className="num">KL (tấn)</th><th>ATB</th><th>ETD</th><th>Trạng thái</th><th className="min-w-[160px]">Tiến độ</th></tr></thead>
        <tbody>
          {dong.map(({ b, v, dau, n }) => {
            const cs = v && chiSo(v, D.stopsOf(v.id), D.now);
            return (
              <tr key={b.ma + (v?.id ?? "")} className={cn(v && "cursor-pointer")} onClick={() => v && setVoyageMo(v.id)}>
                {dau && <td rowSpan={n} className="font-mono font-semibold">{tenBen(b.ma)}</td>}
                {v ? <>
                  <td className="font-medium">{v.ten_tau}<div className="text-[0.6875rem] text-muted-foreground">{v.huong === "xuat" ? "Xuất" : "Nhập"}{v.ben_phu ? ` · cập ${tenBenChuyen(v)}` : ""}</div></td>
                  <td>{v.loai_hang}</td>
                  <td className="max-w-[220px]">{v.ten_hang}</td>
                  <td className="num">{so(v.khoi_luong)}<div className="text-[0.6875rem] text-muted-foreground">đã làm {so(cs.daLam)}</div></td>
                  <td className="whitespace-nowrap tabular-nums">{ngayGio(v.atb)}</td>
                  <td className="whitespace-nowrap tabular-nums">{ngayGio(v.atd || v.etd)}</td>
                  <td><TrangThaiBadge st={cs.trangThai} /></td>
                  <td><TienDo v={cs.hoanTat} /></td>
                </> : <td colSpan={8} className="text-muted-foreground">Trống</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
