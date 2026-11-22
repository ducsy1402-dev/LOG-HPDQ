import { Wrench, Users, ClipboardCheck } from "lucide-react";
import Events from "./Events";
import QuanSoTo from "./QuanSoTo";
import ThongTinCa from "./ThongTinCa";
import ThanhTab, { GiuTab } from "../../khung/ThanhTab";

// Khai báo (Thiết bị cơ giới): nơi nhập số liệu hằng ngày, 3 tab (mỗi tab có đường dẫn riêng: #/thiet-bi/khai-bao/<tab>)
//  · Tình trạng & sự kiện (giữ nguyên như trước)
//  · Nhân sự & quân số (nhập quân số theo từng tổ trong mỗi ca, dùng được trên điện thoại)
//  · Thông tin đầu/cuối ca (từng tổ khai mã xe · tình trạng sẵn sàng / hỏng · vị trí / BPSD ở đầu và cuối ca, SQL 18)
const TAB = [["su-kien", "Tình trạng & sự kiện", Wrench], ["quan-so", "Nhân sự & quân số", Users], ["dau-cuoi-ca", "Thông tin đầu/cuối ca", ClipboardCheck]];

// tab, onTab: do khung điều hướng truyền vào (tab nằm trong đường dẫn). Tab đã xem được giữ nguyên khi chuyển qua lại.
export default function KhaiBao({ tab = "su-kien", onTab }) {
  return (
    <>
      <ThanhTab value={tab} onChange={(v) => onTab?.(v)} tabs={TAB} label="Khai báo" />
      <GiuTab active={tab} cac={{ "su-kien": <Events />, "quan-so": <QuanSoTo />, "dau-cuoi-ca": <ThongTinCa /> }} />
    </>
  );
}
