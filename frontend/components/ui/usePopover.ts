'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Cơ chế dùng chung cho các bảng bật ra neo theo một ô nhập (lịch chọn ngày,
 * bảng chọn giờ).
 *
 * Bảng luôn được vẽ qua portal với `position: fixed` vì phần lớn nơi gọi nằm
 * trong `.table-wrap` hoặc thân Modal — cả hai đều `overflow: auto` nên bảng
 * định vị tuyệt đối theo cha sẽ bị cắt mất.
 */
interface PopoverOptions {
  open: boolean;
  onClose: () => void;
  /** Dùng cho lượt đo đầu tiên, khi bảng chưa gắn vào DOM. */
  estimatedWidth: number;
  estimatedHeight: number;
}

const GAP = 6;
const EDGE = 8;

export function usePopover({ open, onClose, estimatedWidth, estimatedHeight }: PopoverOptions) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight || estimatedHeight;
    const width = panelRef.current?.offsetWidth || estimatedWidth;

    const openUp = rect.bottom + GAP + height > window.innerHeight && rect.top > height;
    const preferred = openUp ? rect.top - GAP - height : rect.bottom + GAP;

    /*
     * Kẹp vào trong khung nhìn. Trên điện thoại, ô nhập thường nằm sát đáy
     * bottom sheet nên chỉ riêng nhánh "lật lên" vẫn có thể để bảng rơi ra ngoài.
     */
    const top = Math.min(Math.max(EDGE, preferred), Math.max(EDGE, window.innerHeight - height - EDGE));
    const left = Math.min(Math.max(EDGE, rect.left), Math.max(EDGE, window.innerWidth - width - EDGE));

    // `place()` chạy mỗi nhịp cuộn; chỉ đặt lại state khi tọa độ thật sự đổi
    // để không ép React vẽ lại bảng liên tục trong lúc người dùng cuộn.
    setPosition((current) =>
      current && current.top === top && current.left === left ? current : { top, left },
    );
  }, [estimatedHeight, estimatedWidth]);

  /*
   * Đo hai lượt: lượt đầu để bảng được gắn vào DOM, lượt sau định vị lại theo
   * kích thước thật. Bảng ẩn (visibility: hidden) tới khi có tọa độ nên người
   * dùng không thấy nó nhảy vị trí.
   */
  useLayoutEffect(() => {
    if (!open) return;
    place();
    const frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onCloseRef.current();
    };

    /*
     * Bắt ở pha capture và chặn lan truyền: nếu để Escape đi tiếp tới document,
     * Modal bao ngoài sẽ đóng luôn cả biểu mẫu thay vì chỉ đóng bảng bật ra.
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      onCloseRef.current();
    };

    /*
     * Cuộn: KHÔNG đóng vô điều kiện.
     *
     *  1. Cuộn ngay bên trong bảng (hai cột giờ/phút tự cuộn) thì bỏ qua hoàn
     *     toàn — trước đây điều này làm bảng tự đóng ngay khi người dùng lăn
     *     chuột để tìm giờ.
     *  2. Cuộn ở ngoài (thân Modal, vùng nội dung) thì bám lại theo ô nhập,
     *     vì bảng dùng `position: fixed` nên không tự trôi theo.
     *  3. Chỉ đóng khi ô nhập đã trôi hẳn khỏi vùng nhìn thấy, lúc đó bảng
     *     không còn neo vào đâu nữa.
     */
    const onScroll = (event: Event) => {
      const target = event.target as Node | null;
      if (target && panelRef.current?.contains(target)) return;

      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        onCloseRef.current();
        return;
      }
      place();
    };

    const onResize = () => place();

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onResize);
    // `true` để bắt cả cuộn bên trong vùng có overflow (thân Modal, bảng dữ liệu).
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place]);

  return { anchorRef, panelRef, position };
}

/** Style cố định cho bảng bật ra; ẩn cho tới khi tính xong tọa độ. */
export function popoverStyle(
  position: { top: number; left: number } | null,
  width: number,
): React.CSSProperties {
  return {
    position: 'fixed',
    top: position?.top ?? -9999,
    left: position?.left ?? -9999,
    width,
    visibility: position ? 'visible' : 'hidden',
  };
}
