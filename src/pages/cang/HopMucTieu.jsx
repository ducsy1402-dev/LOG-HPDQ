import { useState } from "react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/input";
import { thangCua, tenThang, congThang } from "@/lib/format";
import { khoaKy, dsKy, tenKy } from "@/lib/ky";
import { cn } from "@/lib/utils";
import SanLuongTab from "./SanLuongTab";

// Hai hộp của trang Mục tiêu sản lượng › Khai thác cảng, dùng lại các bảng cũ (SanLuongTab) nhưng mỗi hộp chỉ một bảng:
//   Đặt mục tiêu: mục tiêu sản lượng nhập / xuất theo loại hàng, theo THÁNG / QUÝ / NĂM (quản lý trở lên sửa; quý / năm nhập riêng, SQL 10);
//   Sản lượng thực tế: nhập sản lượng nhập / xuất thực tế theo ngày, mỗi ngày một dòng (nhập liệu trở lên).
const luu = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
const doc = (k, mac) => { try { return localStorage.getItem(k) || mac; } catch { return mac; } };
const KY = [["thang", "Tháng"], ["quy", "Quý"], ["nam", "Năm"]];
const RONG = "max-w-[min(1500px,calc(100vw-24px))]";

export function HopDatMucTieu({ thang0, onClose, onLuu }) {
  const { D } = useApp();
  const [kyLoai, setKyLoai] = useState(() => (["quy", "nam"].includes(doc("lg-mt-ky", "thang")) ? doc("lg-mt-ky", "thang") : "thang"));
  const [chon, setChon] = useState(() => ({ thang: thang0 || thangCua(D.now), quy: khoaKy("quy", D.now), nam: khoaKy("nam", D.now) }));
  const hienTai = { thang: thangCua(D.now), quy: khoaKy("quy", D.now), nam: khoaKy("nam", D.now) };
  const dsChon = {
    thang: Array.from({ length: 13 }, (_, i) => congThang(thangCua(D.now), i - 6)).map((x) => [x, tenThang(x)]),
    quy: dsKy("quy", D.now, 6, 3).map((x) => [x, tenKy("quy", x)]),
    nam: dsKy("nam", D.now, 3, 2).map((x) => [x, tenKy("nam", x)]),
  };
  const ky = chon[kyLoai];
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className={RONG} title="Đặt mục tiêu sản lượng" description="Mục tiêu nhập / xuất theo loại hàng của tháng, quý hoặc năm. Chỉ Quản lý / Quản trị đặt mục tiêu.">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border" role="tablist" aria-label="Kỳ mục tiêu">
          {KY.map(([k, ten]) => (
            <button key={k} type="button" role="tab" aria-selected={kyLoai === k} onClick={() => { setKyLoai(k); luu("lg-mt-ky", k); }}
              className={cn("h-7 px-3 text-xs font-medium transition-colors", kyLoai === k ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>{ten}</button>))}
        </div>
        <NativeSelect className="h-7 w-48 text-xs" value={ky} onChange={(e) => setChon((o) => ({ ...o, [kyLoai]: e.target.value }))}
          options={dsChon[kyLoai].map(([x, ten]) => [x, ten + (x === hienTai[kyLoai] ? " (này)" : "")])} aria-label={KY.find(([k]) => k === kyLoai)[1]} />
      </div>
      <SanLuongTab nhom="cang" thang={ky} kyLoai={kyLoai} che="mucTieu" onLuu={onLuu} />
    </Dialog>
  );
}

export function HopThucTe({ thang0, onClose, onLuu }) {
  const { D } = useApp();
  const [thang, setThang] = useState(thang0 || thangCua(D.now));
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className={RONG} title="Sản lượng thực tế" description="Nhập sản lượng nhập / xuất thực tế theo ngày, mỗi ngày một dòng (tấn). Cột có mục tiêu hiện sẵn; loại hàng khác thì Thêm cột.">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <NativeSelect className="h-7 w-48 text-xs" value={thang} onChange={(e) => setThang(e.target.value)} aria-label="Tháng"
          options={Array.from({ length: 13 }, (_, i) => congThang(thangCua(D.now), i - 6)).map((x) => [x, tenThang(x) + (x === thangCua(D.now) ? " (này)" : "")])} />
      </div>
      <SanLuongTab nhom="cang" thang={thang} kyLoai="thang" che="thucTe" onLuu={onLuu} />
    </Dialog>
  );
}
