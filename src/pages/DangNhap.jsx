import { useEffect, useRef, useState } from "react";
import { Ship, User, Lock, Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { useApp } from "../store";
import logo from "../assets/logo_hoa_phat.png";
import "../khung/nen.css";
import "./dangNhap.css";

// Trang đăng nhập: ảnh nền toàn khung (nen-dang-nhap.webp, đã xóa hộp đăng nhập vẽ sẵn trong ảnh) + hộp đăng nhập thật đặt đúng chỗ hộp trong ảnh.
// Máy tính (khung rộng): "sân khấu" giữ đúng tỉ lệ ảnh, mọi kích thước tính theo đơn vị u nên hộp luôn khớp ảnh ở mọi cỡ cửa sổ.
// Điện thoại / khung hẹp: ảnh cảnh bến cảng làm nền mờ, hộp đăng nhập ở giữa, tiêu đề đặt phía trên.
const KHOA_NHO = "lg-nho-tai-khoan";
const docNho = () => { try { return localStorage.getItem(KHOA_NHO) || ""; } catch { return ""; } };

export default function DangNhap({ xemThu }) {
  const { signIn } = useApp();
  const [tk, setTk] = useState(docNho), [pw, setPw] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const [hien, setHien] = useState(false), [nho, setNho] = useState(true), [quen, setQuen] = useState(false);
  const oTk = useRef(null), oPw = useRef(null);
  useEffect(() => { (tk ? oPw : oTk).current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gui = async (e) => {
    e.preventDefault(); setMsg("");
    if (xemThu) return setMsg("Đây là bản xem thử trang đăng nhập, chưa đăng nhập thật.");
    setBusy(true);
    try {
      await signIn(tk.trim(), pw);
      try { nho ? localStorage.setItem(KHOA_NHO, tk.trim()) : localStorage.removeItem(KHOA_NHO); } catch { /* bỏ qua */ }
    } catch (err) {
      setMsg(/Invalid login/i.test(err.message) ? "Sai tên đăng nhập (hoặc email) hoặc mật khẩu." : err.message);
      setBusy(false);
    }
  };

  return (
    <main className="dn">
      <div className="dn-san">
        <div className="dn-dau">
          <img src={logo} alt="Hòa Phát" />
          <div><b>HỆ THỐNG ĐIỀU HÀNH LOGISTICS</b><span>Kho bãi · Phương tiện · Cảng biển · Đường sắt</span></div>
        </div>

        <form className="dn-the" onSubmit={gui} aria-labelledby="dn-tieu-de">
          <Ship className="dn-tau" strokeWidth={1.8} aria-hidden="true" />
          <h1 id="dn-tieu-de">ĐĂNG NHẬP</h1>
          <p className="dn-phu">Hệ thống Quản trị Logistics</p>

          <label className="dn-o">
            <span className="sr-only">Tên đăng nhập hoặc email</span>
            <User className="dn-bd" aria-hidden="true" />
            <input ref={oTk} type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Tên đăng nhập" value={tk} onChange={(e) => setTk(e.target.value)} />
          </label>
          <label className="dn-o">
            <span className="sr-only">Mật khẩu</span>
            <Lock className="dn-bd" aria-hidden="true" />
            <input ref={oPw} type={hien ? "text" : "password"} required autoComplete="current-password" placeholder="Mật khẩu" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button type="button" className="dn-mat" onClick={() => setHien((h) => !h)} aria-label={hien ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={hien}>{hien ? <EyeOff /> : <Eye />}</button>
          </label>

          <button className="dn-nut" disabled={busy}>{busy ? <Loader2 className="dn-quay" /> : <LogIn />}{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
          {msg && <div className="dn-loi" role="alert">{msg}</div>}

          <div className="dn-hang">
            <label className="dn-tick"><input type="checkbox" checked={nho} onChange={(e) => setNho(e.target.checked)} />Ghi nhớ đăng nhập</label>
            <button type="button" className="dn-quen" onClick={() => setQuen((q) => !q)} aria-expanded={quen}>Quên mật khẩu?</button>
          </div>
          {quen && <div className="dn-ghi" role="status">Tài khoản do quản trị cấp, hệ thống không cho tự đăng ký. Quên mật khẩu: liên hệ quản trị hệ thống để được đặt lại.</div>}
        </form>
      </div>
    </main>
  );
}
