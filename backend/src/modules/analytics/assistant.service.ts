import { localISO, today } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import { normalizeText } from '../../lib/text';
import { collectReportData, type AnalyticsScope } from './analytics.service';

export interface AssistantAnswer {
  title: string;
  /** Các dòng nội dung; frontend tự dựng danh sách hoặc đoạn văn. */
  lines: string[];
  /** Nhãn ngắn hiển thị dạng badge, ví dụ tên lớp chưa nhập điểm. */
  badges?: string[];
  /** Trang dữ liệu nguồn để người dùng kiểm chứng. */
  sourcePage: 'tasks' | 'scores' | 'calendar' | 'backup' | 'reports';
  /** Dấu thời gian và phạm vi — bản gốc luôn ghi kèm để minh bạch. */
  stamp: string;
  recognized: boolean;
}

/** 8 câu hỏi nhanh dựng sẵn, giữ nguyên văn bản của bản gốc. */
export const QUICK_PROMPTS = [
  'Hôm nay tôi cần làm gì?',
  'Việc nào đang quá hạn?',
  'Lớp nào chưa nhập thi đua?',
  'Tuần này có bất thường gì?',
  'Tạo nháp báo cáo tuần.',
  'Tóm tắt tiến độ tháng.',
  'Hoạt động sắp tới còn thiếu gì?',
  'Dữ liệu nào chưa được sao lưu?',
] as const;

/**
 * Trợ lý theo luật, KHÔNG dùng AI.
 * Đúng thiết kế bản gốc: chỉ tra cứu dữ liệu đã lưu, không tự tạo hay sửa số liệu.
 * Nhận diện ý định bằng cách so khớp từ khóa đã bỏ dấu.
 */
export async function answerQuestion(question: string, scope: AnalyticsScope): Promise<AssistantAnswer> {
  const q = normalizeText(question);
  const data = await collectReportData(scope);

  const stamp = `Dữ liệu lúc ${new Date().toLocaleString('vi-VN')}; phạm vi ${
    data.week?.name ?? 'năm học'
  }, ${data.campusName}.`;

  const base = { stamp, recognized: true } as const;

  if (!q) {
    return {
      title: 'Chưa có câu hỏi',
      lines: ['Hãy nhập câu hỏi cụ thể.'],
      sourcePage: 'tasks',
      stamp,
      recognized: false,
    };
  }

  if (q.includes('hom nay')) {
    const todayIso = today();
    const list = data.tasks.filter(
      (t) =>
        t.status !== 'DONE' &&
        (localISO(t.dueDate) <= todayIso || (t.startDate && localISO(t.startDate) === todayIso)),
    );
    return {
      ...base,
      title: 'Việc cần làm hôm nay',
      lines: list.length
        ? list.map((t) => `${t.title} — hạn ${localISO(t.dueDate)}`)
        : ['Không có công việc đến hạn hôm nay.'],
      sourcePage: 'tasks',
    };
  }

  if (q.includes('qua han')) {
    return {
      ...base,
      title: 'Công việc quá hạn',
      lines: data.overdue.length
        ? data.overdue.map((t) => `${t.title} — quá hạn từ ${localISO(t.dueDate)}`)
        : ['Không có công việc quá hạn.'],
      sourcePage: 'tasks',
    };
  }

  if (q.includes('chua nhap')) {
    const filled = new Set(data.context?.entries.map((e) => e.classId) ?? []);
    const missing = data.classes.filter((c) => !filled.has(c.id));
    return {
      ...base,
      title: 'Lớp chưa nhập thi đua',
      lines: missing.length ? [] : ['Không có lớp chưa nhập trong bảng hiện tại.'],
      badges: missing.map((c) => c.className),
      sourcePage: 'scores',
    };
  }

  if (q.includes('bat thuong')) {
    const filled = new Set(data.context?.entries.map((e) => e.classId) ?? []);
    const missing = data.classes.filter((c) => !filled.has(c.id));
    const criteriaById = new Map((data.context?.criteria ?? []).map((c) => [c.id, c]));
    const outOfRange = (data.context?.entries ?? []).filter((entry) => {
      const criterion = criteriaById.get(entry.criteriaId);
      if (!criterion || entry.entryState !== 'VALUE' || entry.value === null) return false;
      const value = Number(entry.value);
      const min = criterion.minValue === null ? -Infinity : Number(criterion.minValue);
      const max = criterion.maxValue === null ? Infinity : Number(criterion.maxValue);
      return value < min || value > max;
    }).length;

    return {
      ...base,
      title: 'Dấu hiệu cần kiểm tra',
      lines: [
        `Có ${missing.length} lớp chưa có dữ liệu; ${outOfRange} giá trị vượt giới hạn cấu hình.`,
        'Cảnh báo không phải kết luận sai phạm.',
      ],
      sourcePage: 'scores',
    };
  }

  if (q.includes('bao cao')) {
    const lines = [
      `Trong phạm vi đã chọn có ${data.tasks.length} công việc, ${data.completed.length} việc hoàn thành và ${data.overdue.length} việc quá hạn.`,
      `Có ${data.upcoming.length} hoạt động/lịch sắp tới.`,
      data.officialRanking
        ? `Bảng thi đua đã được duyệt; lớp dẫn đầu là ${data.ranking[0]?.className ?? 'chưa xác định'}.`
        : 'Bảng thi đua chưa được duyệt nên không đưa xếp hạng vào báo cáo chính thức.',
    ];
    return { ...base, title: 'Nháp báo cáo tuần', lines, sourcePage: 'reports' };
  }

  if (q.includes('tien do')) {
    const percent = data.tasks.length
      ? Math.round((data.completed.length / data.tasks.length) * 100)
      : 0;
    return {
      ...base,
      title: 'Tiến độ công việc',
      lines: [
        `Hoàn thành ${data.completed.length}/${data.tasks.length} công việc (${percent}%).`,
        `Còn ${data.overdue.length} việc quá hạn.`,
      ],
      sourcePage: 'tasks',
    };
  }

  if (q.includes('hoat dong')) {
    const incomplete = data.upcoming.filter((e) => !e.location || !e.leader || !e.safety);
    return {
      ...base,
      title: 'Mức sẵn sàng của hoạt động sắp tới',
      lines: incomplete.length
        ? [
            `Có ${incomplete.length} hoạt động thiếu ít nhất một thông tin: địa điểm, người phụ trách hoặc checklist an toàn.`,
            ...incomplete.map((e) => e.title),
          ]
        : ['Không phát hiện hoạt động sắp tới thiếu trường bắt buộc theo quy tắc.'],
      sourcePage: 'calendar',
    };
  }

  if (q.includes('sao luu')) {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'last_backup_at' } });
    const last = setting?.value as string | null;
    return {
      ...base,
      title: 'Tình trạng sao lưu',
      lines: [
        last
          ? `Lần sao lưu gần nhất: ${new Date(last).toLocaleString('vi-VN')}.`
          : 'Chưa ghi nhận bản sao lưu nào. Nên tạo bản sao ngay.',
      ],
      sourcePage: 'backup',
    };
  }

  return {
    title: 'Chưa nhận diện được câu hỏi',
    lines: [
      'Tôi chưa nhận diện được câu hỏi. Hãy hỏi về công việc hôm nay, việc quá hạn, thi đua, bất thường, hoạt động hoặc sao lưu.',
    ],
    sourcePage: 'tasks',
    stamp,
    recognized: false,
  };
}
