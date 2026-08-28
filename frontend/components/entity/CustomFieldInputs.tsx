'use client';

import type { CustomFieldDefinition } from '@/types';
import { Field, Select, TextArea, TextInput } from '@/components/ui';

/**
 * Kết xuất các trường tùy chỉnh do người dùng tự định nghĩa —
 * tương ứng renderCustomInputs() của bản gốc.
 * Chỉ dùng các kiểu dữ liệu an toàn; không nhận hay thực thi mã.
 */
export function CustomFieldInputs({
  definitions,
  values,
  onChange,
}: {
  definitions: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  if (definitions.length === 0) return null;

  const set = (id: string, value: unknown) => onChange({ ...values, [id]: value });

  return (
    <>
      {definitions.map((definition) => {
        const value = values[definition.id];
        const options = String(definition.options ?? '')
          .split('|')
          .map((option) => option.trim())
          .filter(Boolean);

        const isWide =
          definition.fieldType === 'LONG_TEXT' || definition.fieldType === 'MULTI_CHOICE';

        return (
          <Field
            key={definition.id}
            label={definition.name}
            required={definition.required}
            hint={definition.description ?? undefined}
            full={isWide}
          >
            {definition.fieldType === 'LONG_TEXT' ? (
              <TextArea
                value={String(value ?? '')}
                required={definition.required}
                onChange={(e) => set(definition.id, e.target.value)}
              />
            ) : definition.fieldType === 'SINGLE_CHOICE' ? (
              <Select
                value={String(value ?? '')}
                required={definition.required}
                onChange={(e) => set(definition.id, e.target.value)}
              >
                <option value="">— Chọn —</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            ) : definition.fieldType === 'MULTI_CHOICE' ? (
              <Select
                multiple
                className="h-auto min-h-[76px] py-1"
                value={Array.isArray(value) ? (value as string[]) : []}
                required={definition.required}
                onChange={(e) =>
                  set(
                    definition.id,
                    Array.from(e.target.selectedOptions).map((option) => option.value),
                  )
                }
              >
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            ) : definition.fieldType === 'BOOLEAN' ? (
              <Select
                value={String(value ?? '')}
                onChange={(e) => set(definition.id, e.target.value)}
              >
                <option value="">— Chưa chọn —</option>
                <option value="yes">Có</option>
                <option value="no">Không</option>
              </Select>
            ) : (
              <TextInput
                type={
                  definition.fieldType === 'NUMBER'
                    ? 'number'
                    : definition.fieldType === 'DATE'
                      ? 'date'
                      : definition.fieldType === 'LINK'
                        ? 'url'
                        : 'text'
                }
                value={String(value ?? '')}
                required={definition.required}
                onChange={(e) => set(definition.id, e.target.value)}
              />
            )}
          </Field>
        );
      })}
    </>
  );
}

/** Gom giá trị trường tùy chỉnh thành object lưu vào cột JSON `customValues`. */
export function collectCustomValues(
  definitions: CustomFieldDefinition[],
  values: Record<string, unknown>,
): Record<string, unknown> | null {
  if (definitions.length === 0) return null;
  const output: Record<string, unknown> = {};
  for (const definition of definitions) {
    output[definition.id] =
      definition.fieldType === 'MULTI_CHOICE'
        ? Array.isArray(values[definition.id])
          ? values[definition.id]
          : []
        : (values[definition.id] ?? '');
  }
  return output;
}
