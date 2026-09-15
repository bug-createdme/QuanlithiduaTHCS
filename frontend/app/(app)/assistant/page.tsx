'use client';

import { ArrowUpRight, MessageCircleQuestion, Search, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import type { AssistantAnswer } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  EmptyState,
  LoadingState,
  PageHead,
  Skeleton,
  TextInput,
} from '@/components/ui';

export default function AssistantPage() {
  const scope = useScope();
  const router = useRouter();
  const { toastError } = useToast();

  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [busy, setBusy] = useState(false);

  const promptsQuery = useApiQuery<string[]>('/analytics/assistant/prompts');

  const ask = useCallback(
    async (question: string) => {
      if (!question.trim()) return;
      setQuery(question);
      setBusy(true);
      try {
        const result = await api.post<AssistantAnswer>('/analytics/assistant/ask', {
          ...scope.query,
          question,
        });
        setAnswer(result);
      } catch (err) {
        toastError(err);
      } finally {
        setBusy(false);
      }
    },
    [scope.query, toastError],
  );

  if (!scope.ready) return <LoadingState />;

  return (
    <>
      <PageHead
        title="Trợ lý tổng hợp"
        description="Trả lời theo quy tắc từ dữ liệu đã lưu trong hệ thống; không tự sửa, không tự tạo số liệu."
        actions={
          <Badge tone="blue" dot>
            Tra cứu theo quy tắc · không dùng AI
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr] tablet:grid-cols-1">
        {/* ── Câu hỏi gợi ý ────────────────────────────────────────────── */}
        <Card className="h-fit">
          <CardHead title="Câu hỏi nhanh" icon={<MessageCircleQuestion size={16} aria-hidden />} />
          <CardBody className="space-y-1.5 pt-3">
            {promptsQuery.loading && !promptsQuery.data ? (
              <>
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </>
            ) : (
              (promptsQuery.data ?? []).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void ask(prompt)}
                  className="block w-full rounded-md border border-line bg-white px-3 py-2.5 text-left text-sm leading-snug text-neutral-700 transition-all duration-150 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
                >
                  {prompt}
                </button>
              ))
            )}
          </CardBody>
        </Card>

        {/* ── Ô tra cứu và kết quả ─────────────────────────────────────── */}
        <Card>
          <CardHead
            title="Tra cứu dữ liệu"
            icon={<Search size={16} aria-hidden />}
            meta={scope.currentYear?.name}
          />
          <CardBody>
            <div className="flex gap-2 mobile:flex-col">
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void ask(query);
                }}
                placeholder="Nhập câu hỏi về dữ liệu hệ thống…"
                className="flex-1"
                aria-label="Câu hỏi tra cứu"
              />
              <Button
                variant="primary"
                icon={<Search size={15} aria-hidden />}
                loading={busy}
                onClick={() => void ask(query)}
                className="mobile:w-full"
              >
                Tra cứu
              </Button>
            </div>

            <div className="mt-4">
              {busy ? (
                <LoadingState label="Đang tổng hợp dữ liệu…" />
              ) : !answer ? (
                <EmptyState
                  icon={<Sparkles size={22} aria-hidden />}
                  title="Chưa có câu hỏi nào"
                  hint="Chọn một câu hỏi nhanh bên trái hoặc tự nhập câu hỏi. Mọi phản hồi đều ghi rõ thời điểm và phạm vi dữ liệu đã dùng."
                />
              ) : (
                <article className="rounded-lg border border-line bg-neutral-25 p-4">
                  <h3 className="m-0 flex items-start gap-2 text-lg font-semibold text-ink">
                    <Sparkles size={17} className="mt-[3px] shrink-0 text-brand-600" aria-hidden />
                    {answer.title}
                  </h3>

                  {answer.lines.length > 0 ? (
                    answer.lines.length === 1 ? (
                      <p className="mt-2.5 text-base leading-relaxed text-neutral-700">
                        {answer.lines[0]}
                      </p>
                    ) : (
                      <ul className="mt-2.5 list-disc space-y-1 pl-5 text-base leading-relaxed text-neutral-700">
                        {answer.lines.map((line, index) => (
                          <li key={index}>{line}</li>
                        ))}
                      </ul>
                    )
                  ) : null}

                  {answer.badges?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {answer.badges.map((badge) => (
                        <Badge key={badge} tone="yellow" dot>
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <footer className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <span className="text-2xs text-neutral-500">{answer.stamp}</span>
                    <Button
                      size="sm"
                      iconRight={<ArrowUpRight size={14} aria-hidden />}
                      onClick={() => router.push(`/${answer.sourcePage}`)}
                    >
                      Mở dữ liệu nguồn
                    </Button>
                  </footer>
                </article>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
