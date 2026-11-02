import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import prefixer from "postcss-prefix-selector";

// CSS của phần Thiết bị cơ giới (mã chuyển từ web cũ, src/thietbi/styles.css) chỉ áp dụng bên trong khung .ttb,
// để không lẫn với giao diện Tailwind / shadcn của phần còn lại.
//   :root / html / body          -> .ttb
//   :root[data-theme="light"]    -> html[data-theme="light"] .ttb   (chế độ sáng / tối đặt ở thẻ html)
const phamViThietBi = prefixer({
  prefix: ".ttb",
  includeFiles: [/thietbi[\\/]styles\.css$/],
  transform(prefix, sel, prefixed) {
    const s = sel.trim();
    if (/^:root\[data-theme/.test(s)) return s.replace(/^:root/, "html") + " " + prefix;
    if (s === ":root" || s === "html" || s === "body") return prefix;
    if (s.startsWith(prefix)) return s;
    return prefixed;
  },
});

export default { plugins: [phamViThietBi, tailwindcss, autoprefixer] };
