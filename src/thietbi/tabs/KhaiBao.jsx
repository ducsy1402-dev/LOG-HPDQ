import { useEffect, useState } from "react";
import { Wrench, Users, ClipboardCheck } from "lucide-react";
import Events from "./Events";
import QuanSoTo from "./QuanSoTo";
import ThongTinCa from "./ThongTinCa";

// Khai báo (Thiết bị cơ giới): nơi nhập số liệu hằng ngày, 3 tab
//  · Tình trạng & sự kiện (giữ nguyên như trước)
//  · Nhân sự & quân số (nhập quân số theo từng tổ trong mỗi ca, dùng được trên điện thoại)
//  · Thông tin đầu/cuối ca (từng tổ khai mã xe · tình trạng sẵn sàng / hỏng · vị trí / BPSD ở đầu và cuối ca, SQL 18)
const TAB = [["su-kien", "Tình trạng & sự kiện", Wrench], ["quan-so", "Nhân sự & quân số", Users], ["dau-cuoi-ca", "Thông tin đầu/cuối ca", ClipboardCheck]];
const doc = () => { try { return localStorage.getItem("qltb-kb-tab"); } catch { return null; } };

// tab: đường dẫn cũ (thiet-bi/su-kien, thiet-bi/nhan-su) mở thẳng đúng tab
export default function KhaiBao({ tab }) {
  const [t, setT] = useState(() => tab || (TAB.some(([k]) => k === doc()) ? doc() : "su-kien"));
  useEffect(() => { if (tab) setT(tab); }, [tab]);
  const chon = (v) => { setT(v); try { localStorage.setItem("qltb-kb-tab", v); } catch { /* bỏ qua */ } };
  return (
    <>
      <div className="kb-tabs" role="tablist" aria-label="Khai báo">
        {TAB.map(([k, ten, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={t === k} className={t === k ? "on" : ""} onClick={() => chon(k)}><Icon size={16} />{ten}</button>
        ))}
      </div>
      {t === "su-kien" ? <Events /> : t === "quan-so" ? <QuanSoTo /> : <ThongTinCa />}
    </>
  );
}
