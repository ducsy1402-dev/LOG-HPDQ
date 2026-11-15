import { useState } from "react";
import { Database } from "lucide-react";
import { useApp } from "../store";
import { Seg } from "../components/ui";
import ShortTerm from "./plan/ShortTerm";
import LongTerm from "./plan/LongTerm";
import { useApp as useAppChung } from "@/store";
import MucTieuVanTai from "@/pages/cang/MucTieuVanTai";
import ChienDich from "./chiendich/ChienDich";

// Kế hoạch & báo cáo (Thiết bị cơ giới), 3 tab:
//  · Kế hoạch ngày  = tab Ngắn hạn cũ (gán xe cho nhu cầu các ca tới)
//  · Kế hoạch dài hạn = 2 tab nhỏ: Mục tiêu vận tải (tab cũ) và Linetime năng lực đáp ứng (tab Dài hạn cũ)
//  · Chiến dịch = chiến dịch vận chuyển: tính số xe, điểm xếp / dỡ, giãn cách, biểu đồ chạy xe, linetime khối lượng, thực tế (SQL 17)
const doc = (k, mac) => { try { return localStorage.getItem(k) || mac; } catch { return mac; } };
const luu = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
const TAB = [["ngay", "Kế hoạch ngày"], ["dai", "Kế hoạch dài hạn"], ["chien-dich", "Chiến dịch"]];
const MO_TA = {
  ngay: "Kế hoạch chi tiết các ca tới theo file nhu cầu: gán xe, kiểm tra trùng giờ, xe hỏng, sai loại, xuất PDF trình ký.",
  dai: "Mục tiêu khai thác vận tải và năng lực đáp ứng theo tiến độ tàu, việc bãi từng ca.",
  "chien-dich": "Chiến dịch vận chuyển: từ khối lượng, quãng đường, tốc độ, năng suất xếp / vun… web tính số xe, số điểm xếp / dỡ, giãn cách chạy xe, vẽ biểu đồ từng chuyến và linetime khối lượng; nhập thực tế theo ca để so kế hoạch.",
};

const CanSql = () => (
  <div className="card"><div className="alert warn"><Database size={16} /><span>CSDL chưa có các bảng của Giai đoạn 2. Quản trị cần chạy file <b className="mono">sql/6_giai_doan_2_cau_truc.sql</b> rồi <b className="mono">sql/7_cap_nhat_xe_giai_doan_2.sql</b> trong Supabase › SQL Editor, sau đó tải lại trang.</span></div></div>
);

export default function KeHoachBaoCao() {
  const { D } = useApp();
  const coCang = !!useAppChung()?.quyen?.coCang; // mục tiêu vận tải dùng bảng sản lượng của phần Cảng (SQL 06): cần quyền Cảng
  const [tab, setTab] = useState(() => { const t = doc("qltb-kh-tab", "ngay"); return TAB.some(([k]) => k === t) ? t : "ngay"; });
  const [dai, setDai] = useState(() => { const t = doc("qltb-kh-dai", "van_tai"); return t === "linetime" || t === "van_tai" ? t : "van_tai"; });
  const chonTab = (v) => { setTab(v); luu("qltb-kh-tab", v); };
  const chonDai = (v) => { setDai(v); luu("qltb-kh-dai", v); };

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Kế hoạch & báo cáo</h1>
          <div className="sub">{MO_TA[tab]}</div>
        </div>
        <div className="tools"><Seg value={tab} onChange={chonTab} options={TAB} /></div>
      </div>

      {tab === "ngay" && (!D.plan ? <CanSql /> : <ShortTerm />)}

      {tab === "dai" && (
        <>
          <div className="row mb"><Seg value={dai} onChange={chonDai} options={[["van_tai", "Mục tiêu vận tải"], ["linetime", "Linetime năng lực đáp ứng"]]} /></div>
          {dai === "van_tai"
            ? (coCang ? <div className="khong-ttb"><MucTieuVanTai /></div> : <div className="card"><div className="alert warn"><Database size={16} /><span>Mục tiêu vận tải dùng bảng sản lượng của phần Khai thác Cảng: tài khoản cần có quyền Cảng.</span></div></div>)
            : (!D.plan ? <CanSql /> : <LongTerm />)}
        </>
      )}

      {tab === "chien-dich" && <ChienDich />}
    </>
  );
}
