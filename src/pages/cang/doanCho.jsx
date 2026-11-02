import { MAU_CHO, laChoHang } from "@/lib/linetime";
import { thoiLuong } from "@/lib/format";
import { ms } from "@/lib/format";

// Đoạn chờ trên lịch cầu bến (dùng chung cho lịch theo bến và theo mét, chế độ "Toàn thời gian").
// Đỏ = chờ có bến cập: từ NOR (tàu chưa đến neo thì từ ETA) tới lúc cập bến. Tàu đã cập mà không có NOR thì không có đoạn chờ.
// Xanh lá = tàu chờ cập bến do chưa đủ hàng / chưa có bãi nhập: khoảng dừng có lý do "Chờ cập bến: …", nằm trong đoạn chờ, vẽ đè lên màu đỏ.
export const choBatDau = (v, che) => (che !== "toan" ? null : v.atb ? ms(v.nor) : ms(v.nor) ?? ms(v.eta));

// Kiểu sọc chéo của một đoạn chờ (nền: nền thẻ nếu vẽ đè lên thanh tàu)
export const kieuCho = (mau, nen) => ({
  color: mau, borderColor: mau + "b3",
  background: `repeating-linear-gradient(135deg, ${mau}4d 0, ${mau}4d 5px, transparent 5px, transparent 10px)${nen ? `, hsl(var(--card))` : ""}`,
});

// Các đoạn xanh lá nằm trong [t0, t1] của một thanh. left0: toạ độ ngang (px) của mép trái thanh; xOf: giờ -> px
export function PhanChoHang({ stops = [], t0, t1, xOf, left0, now, gon }) {
  return stops.filter(laChoHang).map((s) => {
    const a = Math.max(ms(s.tu), t0), b = Math.min(ms(s.den) ?? now, t1);
    if (!(b > a)) return null;
    const w = Math.max(3, xOf(b) - xOf(a));
    return (
      <div key={s.id ?? s.tu} className="pointer-events-none absolute inset-y-0 z-10 flex items-center overflow-hidden border-x px-1 text-[inherit] font-medium"
        style={{ left: xOf(a) - left0, width: w, ...kieuCho(MAU_CHO.hang, true) }} title={`${s.ly_do}: ${thoiLuong((b - a) / 36e5, { ngan: true })}`}>
        {w > 80 && !gon && <span className="truncate">{String(s.ly_do).replace("Chờ cập bến: ", "")} {thoiLuong((b - a) / 36e5, { ngan: true })}</span>}
      </div>
    );
  });
}

// Chú thích màu hai loại chờ
export function ChuThichCho({ toan }) {
  return (
    <>
      <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm border" style={{ borderColor: MAU_CHO.hang, background: `repeating-linear-gradient(135deg, ${MAU_CHO.hang}80, ${MAU_CHO.hang}80 3px, transparent 3px, transparent 6px)` }} />Chờ cập bến do chưa đủ hàng / chưa có bãi nhập</span>
      <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm border" style={{ borderColor: MAU_CHO.ben, background: `repeating-linear-gradient(135deg, ${MAU_CHO.ben}80, ${MAU_CHO.ben}80 3px, transparent 3px, transparent 6px)` }} />Chờ có bến cập (từ NOR / ETA tới cập bến)</span>
    </>
  );
}
