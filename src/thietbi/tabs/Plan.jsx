import { useState } from "react";
import { Database } from "lucide-react";
import { useApp } from "../store";
import { Seg } from "../components/ui";
import ShortTerm from "./plan/ShortTerm";
import LongTerm from "./plan/LongTerm";

// Tab 4 – Kế hoạch & phân bổ xe (Giai đoạn 2)
export default function Plan() {
  const { D } = useApp();
  const [sub, setSub] = useState(() => { try { return localStorage.getItem("qltb-plan-sub") || "ngan"; } catch { return "ngan"; } });
  const pick = (v) => { setSub(v); try { localStorage.setItem("qltb-plan-sub", v); } catch { /* bỏ qua */ } };

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Kế hoạch & phân bổ xe</h1>
          <div className="sub">{sub === "ngan" ? "Kế hoạch chi tiết các ca tới theo file nhu cầu: gán xe, kiểm tra trùng giờ, xe hỏng, sai loại, xuất PDF trình ký." : "Tiến độ tàu và việc bãi theo ca: số xe cần, thừa / thiếu xe cảng và bãi."}</div>
        </div>
        <div className="tools"><Seg value={sub} onChange={pick} options={[["ngan", "Ngắn hạn · các ca tới"], ["dai", "Dài hạn · tiến độ tàu"]]} /></div>
      </div>
      {!D.plan ? (
        <div className="card"><div className="alert warn"><Database size={16} /><span>CSDL chưa có các bảng của Giai đoạn 2. Quản trị cần chạy file <b className="mono">sql/6_giai_doan_2_cau_truc.sql</b> rồi <b className="mono">sql/7_cap_nhat_xe_giai_doan_2.sql</b> trong Supabase › SQL Editor, sau đó tải lại trang.</span></div></div>
      ) : sub === "ngan" ? <ShortTerm /> : <LongTerm />}
    </>
  );
}
