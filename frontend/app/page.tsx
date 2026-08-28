import { redirect } from 'next/navigation';

/** Trang gốc chuyển thẳng tới Tổng quan, tương ứng hash mặc định #dashboard. */
export default function HomePage() {
  redirect('/dashboard');
}
