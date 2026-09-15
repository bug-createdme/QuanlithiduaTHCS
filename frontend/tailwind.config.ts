import type { Config } from 'tailwindcss';

/**
 * ============================================================================
 *  HỆ THỐNG THIẾT KẾ — "Modern Education SaaS"
 * ============================================================================
 * Toàn bộ token màu ở đây trỏ tới biến CSS khai báo trong `app/globals.css`.
 * Nhờ vậy chỉ có MỘT nguồn sự thật: sửa biến là đổi cả giao diện, và CSS thuần
 * (bảng in, thanh cuộn, viền bảng điểm) dùng chung đúng giá trị với Tailwind.
 *
 * Các bí danh cũ (ink, muted, line, canvas, card, blue, green, red, yellow,
 * sidebar, rounded-card, rounded-control, shadow-card, shadow-modal) được giữ
 * nguyên tên để mọi lớp đang dùng trong ~40 tệp vẫn biên dịch được; chúng chỉ
 * được trỏ lại sang giá trị mới của hệ thống.
 */

/** Sinh cặp `var(--x)` có hỗ trợ modifier độ mờ của Tailwind (`text-brand/60`). */
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  /**
   * Phải quét cả `hooks/` — ToastProvider (và các provider dùng chung khác)
   * đặt ở đó. Thiếu đường dẫn này Tailwind không sinh CSS cho toast.
   */
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    /**
     * Khai báo ở cấp `theme` (không phải `theme.extend`) để THAY THẾ hoàn toàn
     * bộ điểm ngắt mặc định của Tailwind. Nếu đặt trong `extend`, các tên
     * sm/md/lg/xl vẫn giữ giá trị mặc định 640/768/1024/1280 và ghi đè ý đồ
     * thiết kế — đó là nguyên nhân bố cục lệch ở 768px.
     */
    screens: {
      /**
       * Thang MIN-WIDTH — dùng cho mọi thuộc tính có nhiều giá trị cạnh tranh
       * (số cột lưới, kích thước cột layout). Đây là hướng mobile-first:
       * giá trị nền là giao diện điện thoại, các mốc lớn hơn nâng cấp dần.
       */
      sm: { min: '521px' },
      md: { min: '851px' },
      lg: { min: '1101px' },
      xl: { min: '1181px' },
      '2xl': { min: '1421px' },

      /**
       * Thang MAX-WIDTH — giữ đúng bảy điểm ngắt của website gốc.
       * Chỉ dùng cho tiện ích ẩn/hiện (display), nơi các mốc chồng nhau là
       * vô hại và đúng ý: ẩn ở mốc rộng thì mọi mốc hẹp hơn cũng ẩn theo.
       */
      wide: { max: '1700px' },
      desk: { max: '1550px' },
      'desk-sm': { max: '1420px' },
      lap: { max: '1180px' },
      'lap-sm': { max: '1100px' },
      tablet: { max: '850px' },
      mobile: { max: '520px' },
      xs: { max: '370px' },
    },
    extend: {
      colors: {
        /* ─────────── Thang trung tính: MỘT thang duy nhất cho cả hệ thống ── */
        neutral: {
          0: v('--n-0'),
          25: v('--n-25'),
          50: v('--n-50'),
          100: v('--n-100'),
          200: v('--n-200'),
          300: v('--n-300'),
          400: v('--n-400'),
          500: v('--n-500'),
          600: v('--n-600'),
          700: v('--n-700'),
          800: v('--n-800'),
          900: v('--n-900'),
          950: v('--n-950'),
        },

        /* ─────────── Màu thương hiệu (giữ #0b6bcb làm bậc 600) ──────────── */
        brand: {
          50: v('--brand-50'),
          100: v('--brand-100'),
          200: v('--brand-200'),
          300: v('--brand-300'),
          400: v('--brand-400'),
          500: v('--brand-500'),
          600: v('--brand-600'),
          700: v('--brand-700'),
          800: v('--brand-800'),
          900: v('--brand-900'),
          950: v('--brand-950'),
          DEFAULT: v('--brand-600'),
        },

        /* ─────────── Màu trạng thái ──────────────────────────────────────── */
        success: {
          50: v('--success-50'),
          100: v('--success-100'),
          200: v('--success-200'),
          500: v('--success-500'),
          600: v('--success-600'),
          700: v('--success-700'),
          DEFAULT: v('--success-600'),
        },
        warning: {
          50: v('--warning-50'),
          100: v('--warning-100'),
          200: v('--warning-200'),
          500: v('--warning-500'),
          600: v('--warning-600'),
          700: v('--warning-700'),
          DEFAULT: v('--warning-600'),
        },
        danger: {
          50: v('--danger-50'),
          100: v('--danger-100'),
          200: v('--danger-200'),
          500: v('--danger-500'),
          600: v('--danger-600'),
          700: v('--danger-700'),
          DEFAULT: v('--danger-600'),
        },

        /* ─────────── Bí danh ngữ nghĩa (tương thích ngược) ───────────────── */
        ink: v('--text-strong'),
        muted: v('--text-muted'),
        line: v('--border'),
        canvas: v('--bg-canvas'),
        card: v('--bg-surface'),
        surface: {
          DEFAULT: v('--bg-surface'),
          sunken: v('--bg-sunken'),
          raised: v('--bg-raised'),
        },

        /**
         * `blue` / `green` / `red` / `yellow` là bí danh cũ còn dùng rải rác.
         * Giữ nguyên API (`bg-blue`, `bg-blue-soft`, `text-green`, …) nhưng
         * trỏ sang thang mới để không còn hai sắc xanh khác nhau trong app.
         */
        blue: {
          DEFAULT: v('--brand-600'),
          dark: v('--brand-700'),
          soft: v('--brand-50'),
        },
        green: {
          DEFAULT: v('--success-600'),
          soft: v('--success-50'),
        },
        yellow: {
          DEFAULT: v('--warning-500'),
          soft: v('--warning-50'),
        },
        red: {
          DEFAULT: v('--danger-600'),
          soft: v('--danger-50'),
        },

        /** Thanh bên dùng bảng màu tối riêng. */
        sidebar: {
          DEFAULT: v('--sidebar-bg'),
          deep: v('--sidebar-deep'),
          text: v('--sidebar-text'),
          dim: v('--sidebar-dim'),
          active: v('--sidebar-active'),
          hover: v('--sidebar-hover'),
        },
      },

      fontFamily: {
        /**
         * Không nạp webfont ngoài: hệ thống phải chạy được trong mạng nội bộ
         * của trường. Thứ tự dưới đây ưu tiên các font có bộ dấu tiếng Việt
         * đầy đủ và hình chữ hiện đại trên từng nền tảng.
         */
        sans: [
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          'system-ui',
          '-apple-system',
          'Inter',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
        ],
        numeric: [
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          'system-ui',
          'Roboto',
          'Arial',
          'sans-serif',
        ],
      },

      /** Thang chữ có ngữ nghĩa — thay cho hàng trăm cỡ chữ rời rạc trước đây. */
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.45' }],
        xs: ['11.5px', { lineHeight: '1.5' }],
        sm: ['12.5px', { lineHeight: '1.5' }],
        base: ['13.5px', { lineHeight: '1.55' }],
        md: ['14px', { lineHeight: '1.55' }],
        lg: ['15px', { lineHeight: '1.45' }],
        xl: ['17px', { lineHeight: '1.35' }],
        '2xl': ['20px', { lineHeight: '1.3' }],
        '3xl': ['24px', { lineHeight: '1.25' }],
        '4xl': ['30px', { lineHeight: '1.15' }],
      },

      borderRadius: {
        DEFAULT: 'var(--r-md)',
        xs: 'var(--r-xs)',
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
        /** Bí danh cũ. */
        card: 'var(--r-lg)',
        control: 'var(--r-md)',
      },

      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        focus: 'var(--shadow-focus)',
        /** Bí danh cũ. */
        card: 'var(--shadow-xs)',
        modal: 'var(--shadow-xl)',
      },

      spacing: {
        sidebar: '260px',
        'sidebar-sm': '68px',
        topbar: '64px',
        'topbar-sm': '58px',
        bottomnav: '68px',
        /** Chiều cao chuẩn của ô nhập / nút. */
        'control-sm': '30px',
        control: '36px',
        'control-lg': '42px',
      },

      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateX(16px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        'toast-timer': {
          from: { width: '100%' },
          to: { width: '0%' },
        },
        'modal-in': {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'toast-in': 'toast-in 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        'toast-timer': 'toast-timer 4500ms linear forwards',
        'modal-in': 'modal-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'sheet-in': 'sheet-in 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 140ms ease-out',
        'pop-in': 'pop-in 140ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
