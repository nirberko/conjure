import { t } from '@extension/i18n';
import { useState } from 'react';
import type { UserInputField } from '@extension/shared';

interface UserInputFormProps {
  fields: UserInputField[];
  title?: string;
  submitLabel?: string;
  onSubmit: (values: Record<string, string | number>) => void;
  onCancel: () => void;
}

export const UserInputForm = ({ fields, title, submitLabel = 'Submit', onSubmit, onCancel }: UserInputFormProps) => {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of fields) {
      initial[field.name] = '';
    }
    return initial;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required && !values[field.name]?.trim()) {
        newErrors[field.name] = t('formFieldRequired');
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Convert number fields
    const result: Record<string, string | number> = {};
    for (const field of fields) {
      const raw = values[field.name];
      if (field.type === 'number' && raw !== '') {
        result[field.name] = Number(raw);
      } else {
        result[field.name] = raw;
      }
    }
    onSubmit(result);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {title && <div className="font-mono text-xs font-medium uppercase tracking-wider text-slate-400">{title}</div>}

      {fields.map(field => (
        <div key={field.name} className="space-y-1.5">
          <label htmlFor={`uif-${field.name}`} className="flex items-center gap-1.5 font-mono text-xs text-slate-400">
            {field.label}
            {field.required && <span className="text-amber-500">*</span>}
          </label>
          <input
            id={`uif-${field.name}`}
            type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'}
            value={values[field.name]}
            onChange={e => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={`w-full rounded border bg-slate-800/60 px-3 py-2 font-display text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors focus:border-slate-500 ${
              errors[field.name] ? 'border-red-500/60' : 'border-slate-700'
            }`}
          />
          {field.description && <div className="text-[11px] text-slate-600">{field.description}</div>}
          {errors[field.name] && <div className="text-[11px] text-red-400">{errors[field.name]}</div>}
        </div>
      ))}

      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-xs text-slate-500 transition-colors hover:text-slate-300">
          {t('commonCancel')}
        </button>
        <button
          type="submit"
          className="rounded bg-slate-600/60 px-4 py-1.5 font-mono text-xs text-slate-200 transition-colors hover:bg-slate-600">
          {submitLabel}
        </button>
      </div>
    </form>
  );
};
