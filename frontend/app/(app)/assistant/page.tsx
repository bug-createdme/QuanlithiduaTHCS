'use client';

import { Search, Sparkles } from 'lucide-react';
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
  LinkButton,
  LoadingState,
  Notice,
  PageHead,
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
        description="Trả lời theo quy tắc từ dữ liệu đã lưu; không tự sửa hoặc tạo số liệu."
        actions={<Badge tone="blue">Tra cứu theo quy tắc • không dùng AI</Badge>}
      />

      <div className="grid grid-cols-[260px_1fr] gap-3 tablet:grid-cols-1">
        <Card>
          <CardHead title="Câu hỏi nhanh" />
          <CardBody className="space-y-1.5 pt-2">
            {(promptsQuery.data ?? []).map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void ask(prompt)}
                className="block w-full rounded-control border border-line bg-white px-2.5 py-2 text-left text-[12.5px] transition-colors hover:border-blue hover:bg-blue-soft"
              >
                {prompt}
              </button>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Tra cứu dữ liệu" />
          <CardBody>
            <div className="flex gap-2">
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void ask(query);
                }}
                placeholder="Nhập câu hỏi về dữ liệu hệ thống…"
                className="flex-1"
                aria-label="Câu hỏi"
              />
              <Button
                variant="primary"
                icon={<Search size={15} aria-hidden />}
                loading={busy}
                onClick={() => void ask(query)}
              >
                Tra cứu
              </Button>
            </div>

            <div className="mt-3">
              {busy ? (
                <LoadingState label="Đang tổng hợp dữ liệu…" />
              ) : !answer ? (
                <Notice>
                  Chọn một câu hỏi nhanh hoặc nhập câu hỏi. Phản hồi luôn ghi rõ thời điểm và phạm vi.
                </Notice>
              ) : (
                <div className="rounded-card border border-line bg-canvas p-3.5">
                  <h3 className="m-0 flex items-center gap-1.5 text-[14px] font-bold">
                    <Sparkles size={15} className="text-blue" aria-hidden />
                    {answer.title}
                  </h3>

                  {answer.lines.length > 0 ? (
                    answer.lines.length === 1 ? (
                      <p className="mt-1.5 text-[13px]">{answer.lines[0]}</p>
                    ) : (
                      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px]">
                        {answer.lines.map((line, index) => (
                          <li key={index}>{line}</li>
                        ))}
                      </ul>
                    )
                  ) : null}

                  {answer.badges?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {answer.badges.map((badge) => (
                        <Badge key={badge} tone="yellow">
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <small className="mt-2.5 block text-[11px] text-muted">{answer.stamp}</small>

                  <LinkButton className="mt-2" onClick={() => router.push(`/${answer.sourcePage}`)}>
                    Mở dữ liệu nguồn
                  </LinkButton>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
