import { Database } from "lucide-react";
import { useApp } from "../store";
import ThanhTab, { GiuTab } from "../../khung/ThanhTab";
import ShortTerm from "./plan/ShortTerm";
import LongTerm from "./plan/LongTerm";
import ChienDich from "./chiendich/ChienDich";

// Kế hoạch & báo cáo (Thiết bị cơ giới), 3 tab:
//  · Kế hoạch ngày  = tab Ngắn hạn cũ (gán xe cho nhu cầu các ca tới)
//  · Kế hoạch dài hạn = Linetime năng lực đáp ứng (tab Dài hạn cũ). Mục tiêu vận tải đã chuyển sang Khai thác Cảng › Mục tiêu sản lượng › Đặt mục tiêu › Kế hoạch sản xuất (anh Sỹ 20/11/2026)
//  · Chiến dịch = chiến dịch vận chuyển: tính số xe, điểm xếp / dỡ, giãn cách, biểu đồ chạy xe, linetime khối lượng, thực tế (SQL 17)
const TAB = [["ngay", "Kế hoạch ngày"], ["dai", "Kế hoạch dài hạn"], ["chien-dich", "Chiến dịch"]];

const CanSql = () => (
  <div className="card"><div className="alert warn"><Database size={16} /><span>CSDL chưa có các bảng của Giai đoạn 2. Quản trị cần chạy file <b className="mono">sql/6_giai_doan_2_cau_truc.sql</b> rồi <b className="mono">sql/7_cap_nhat_xe_giai_doan_2.sql</b> trong Supabase › SQL Editor, sau đó tải lại trang.</span></div></div>
);

// tab, onTab: do khung điều hướng truyền vào (đường dẫn #/thiet-bi/ke-hoach/<tab>). Tab đã xem được giữ nguyên khi chuyển qua lại.
export default function KeHoachBaoCao({ tab = "ngay", onTab }) {
  const { D } = useApp();
  return (
    <>
      <ThanhTab value={tab} onChange={(v) => onTab?.(v)} tabs={TAB} label="Kế hoạch & báo cáo" />
      <GiuTab active={tab} cac={{
        ngay: !D.plan ? <CanSql /> : <ShortTerm />,
        dai: !D.plan ? <CanSql /> : <LongTerm />,
        "chien-dich": <ChienDich />,
      }} />
    </>
  );
}
