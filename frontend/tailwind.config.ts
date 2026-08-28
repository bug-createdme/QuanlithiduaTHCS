import type { Config } from 'tailwindcss';

/**
 * Design token lấy nguyên văn từ khối :root của website gốc.
 * Không sáng tạo lại màu sắc hay khoảng cách — mục tiêu là giống bản gốc nhất có thể.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
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
       * Các mốc là phần bù của thang max-width bên dưới.
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
        blue: {
          DEFAULT: '#0b6bcb',
          dark: '#0757a6',
          soft: '#eaf4ff',
        },
        green: {
          DEFAULT: '#16845b',
          soft: '#e9f8f1',
        },
        yellow: { DEFAULT: '#f4b41a' },
        red: {
          DEFAULT: '#c93c3c',
          soft: '#fff0f0',
        },
        ink: '#172235',
        muted: '#667085',
        line: '#dce4ec',
        canvas: '#f4f7fa',
        card: '#ffffff',
        /** Thanh bên dùng bảng màu riêng, không nằm trong biến CSS của bản gốc. */
        sidebar: {
          DEFAULT: '#0a3764',
          text: '#dceaf7',
          dim: '#cfe4f7',
          active: '#0a4f91',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        // Bản gốc đặt cỡ chữ nền là 14px/1.45.
        base: ['14px', '1.45'],
      },
      borderRadius: {
        DEFAULT: '10px',
        card: '10px',
        control: '7px',
      },
      boxShadow: {
        card: '0 2px 10px rgba(23, 34, 53, 0.07)',
        modal: '0 24px 60px rgba(23, 34, 53, 0.28)',
      },
      spacing: {
        sidebar: '248px',
        'sidebar-sm': '64px',
        topbar: '62px',
        'topbar-sm': '58px',
        bottomnav: '70px',
      },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'modal-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'toast-in': 'toast-in 180ms ease-out',
        'modal-in': 'modal-in 160ms ease-out',
        'fade-in': 'fade-in 120ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
