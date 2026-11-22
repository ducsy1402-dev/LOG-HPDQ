import { useEffect, useState } from "react";
import { Database } from "lucide-react";
import { useApp } from "../store";
import { Seg } from "../components/ui";
import { GiuTab } from "../../khung/ThanhTab";
import ShortTerm from "./plan/ShortTerm";
import LongTerm from "./plan/LongTerm";
import ChienDich from "./chiendich/ChienDich";

// Kế hoạch vận tải (trước là "Kế hoạch & báo cáo" của Thiết bị cơ giới; từ 22/11/2026 là một tab của Khai thác Cảng › Kế hoạch tổng hợp), 3 tab nhỏ:
//  · Kế hoạch ngày  = tab Ngắn hạn cũ (gán xe cho nhu cầu các ca tới)
//  · Timeline xe (trước là Kế hoạch dài hạn) = Linetime năng lực đáp ứng: biểu đồ Năng lực đáp ứng + Timeline theo ca (tab Dài hạn cũ)
//  · Chiến dịch = chiến dịch vận chuyển: tính số xe, điểm xếp / dỡ, giãn cách, biểu đồ chạy xe, linetime khối lượng, thực tế (SQL 17)
// Tab nhỏ nhớ ở localStorage `qltb-kh-tab` (Điều độ, Tổng quan đặt trước khi mở trang này); tab đã xem được giữ nguyên khi chuyển qua lại.
const TAB = [["ngay", "Kế hoạch ngày"], ["dai", "Timeline xe"], ["chien-dich", "Chiến dịch"]];
const docTab = () => { try { const t = localStorage.getItem("qltb-kh-tab"); return TAB.some(([k]) => k === t) ? t : "ngay"; } catch { return "ngay"; } };

const CanSql = () => (
  <div className="card"><div className="alert warn"><Database size={16} /><span>CSDL chưa có các bảng của Giai đoạn 2. Quản trị cần chạy file <b className="mono">sql/6_giai_doan_2_cau_truc.sql</b> rồi <b className="mono">sql/7_cap_nhat_xe_giai_doan_2.sql</b> trong Supabase › SQL Editor, sau đó tải lại trang.</span></div></div>
);

export default function KeHoachBaoCao() {
  const { D } = useApp();
  const [tab, setTab] = useState(docTab);
  const chon = (v) => { setTab(v); try { localStorage.setItem("qltb-kh-tab", v); } catch { /* bỏ qua */ } };
  useEffect(() => { const f = () => setTab(docTab()); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []); // nơi khác đặt tab nhỏ rồi chuyển tới trang này
  return (
    <>
      <div className="page-h"><Seg value={tab} onChange={chon} options={TAB} /></div>
      <GiuTab active={tab} cac={{
        ngay: !D.plan ? <CanSql /> : <ShortTerm />,
        dai: !D.plan ? <CanSql /> : <LongTerm />,
        "chien-dich": <ChienDich />,
      }} />
    </>
  );
}
