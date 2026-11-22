import { Dialog } from "@/components/ui/dialog";
import { TrongHopCtx } from "@/components/ui/toanManHinh";
import { TBCho } from "../../thietbi/Host";
import KeHoachBaoCao from "../../thietbi/tabs/KeHoachBaoCao";

// Hộp Kế hoạch vận tải (nút của Khai thác Cảng › Kế hoạch tổng hợp, anh Sỹ 22/11/2026): trước là trang "Kế hoạch & báo cáo" của Thiết bị cơ giới,
// gồm 3 tab nhỏ Kế hoạch ngày · Timeline xe · Chiến dịch. Chỉ mở cho tài khoản có quyền Thiết bị cơ giới.
export default function HopKeHoachVT({ onClose }) {
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-[min(1700px,calc(100vw-24px))]" title="Kế hoạch vận tải"
      description="Kế hoạch ngày (gán xe cho nhu cầu các ca tới), Timeline xe (năng lực đáp ứng theo tiến độ tàu) và chiến dịch vận chuyển.">
      {/* value=false: các thẻ bên trong (Năng lực đáp ứng, Timeline theo ca…) vẫn có nút Toàn màn hình như khi còn là một trang */}
      <TrongHopCtx.Provider value={false}><TBCho><KeHoachBaoCao /></TBCho></TrongHopCtx.Provider>
    </Dialog>
  );
}
