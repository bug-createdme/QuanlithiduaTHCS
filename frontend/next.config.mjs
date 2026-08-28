/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },

  /**
   * Tách thư mục output của `next dev` và `next build`.
   *
   * Nếu dùng chung `.next`, chạy `next build` trong lúc `next dev` đang mở sẽ
   * ghi đè các chunk mà dev server đang tham chiếu, gây lỗi runtime kiểu
   * "Cannot find module './611.js'" cho tới khi xóa `.next` và khởi động lại.
   * Tình huống này xảy ra rất dễ vì `npm run verify` có bước build.
   *
   * `next dev` chạy với NODE_ENV=development, còn `next build` và `next start`
   * chạy với NODE_ENV=production, nên hai bên tự động dùng hai thư mục khác nhau.
   */
  distDir: process.env.NODE_ENV === 'production' ? '.next-prod' : '.next',
};

export default nextConfig;
