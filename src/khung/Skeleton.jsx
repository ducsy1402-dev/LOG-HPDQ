import { cn } from "../lib/utils";

// Khung xám chờ khi dữ liệu đang tải: đúng hình dạng thẻ / biểu đồ / bảng, chiều cao cố định nên bố cục không nhảy khi dữ liệu về.
export const Sk = ({ className, style }) => <div aria-hidden="true" className={cn("sk rounded-md bg-muted", className)} style={style} />;

const CAO_COT = [46, 70, 38, 82, 58, 90, 64, 50, 76, 42, 68, 86];
export function SkBieuDo({ cao = 210 }) {
  return (
    <div className="rounded-lg border bg-card p-3" style={{ height: cao + 56 }}>
      <Sk className="h-4 w-1/3" /><Sk className="mt-1.5 h-3 w-1/2 opacity-70" />
      <div className="mt-4 flex items-end gap-2" style={{ height: cao - 30 }}>
        {CAO_COT.map((h, i) => <Sk key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />)}
      </div>
    </div>
  );
}
export function SkBang({ dong = 6 }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <Sk className="h-4 w-1/4" />
      <div className="mt-3 grid gap-2">{Array.from({ length: dong }, (_, i) => <div key={i} className="flex gap-3"><Sk className="h-5 w-1/5" /><Sk className="h-5 flex-1" /><Sk className="h-5 w-1/6" /></div>)}</div>
    </div>
  );
}
// Khung chờ cả trang: thanh tab + hàng biểu đồ + bảng
export function TrangSkeleton() {
  return (
    <div role="status" aria-label="Đang tải" className="grid gap-3">
      <div className="flex gap-2"><Sk className="h-10 w-32" /><Sk className="h-10 w-36" /><Sk className="h-10 w-28" /></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><SkBieuDo /><SkBieuDo /><SkBieuDo /></div>
      <SkBang />
      <span className="sr-only">Đang tải…</span>
    </div>
  );
}
