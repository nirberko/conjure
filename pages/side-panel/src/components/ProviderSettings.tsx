import { t } from '@extension/i18n';
import { useState, useEffect } from 'react';
import type { AIProvider } from '@extension/shared';

const DEFAULT_RECURSION_LIMIT = 50;
const RECURSION_LIMIT_MIN = 10;
const RECURSION_LIMIT_MAX = 200;

const PROVIDERS: { id: AIProvider; label: string; keyPrefix: string; placeholder: string }[] = [
  { id: 'openai', label: 'OpenAI', keyPrefix: 'sk-', placeholder: 'SK-••••••••••••••••' },
  { id: 'anthropic', label: 'Anthropic', keyPrefix: 'sk-ant-', placeholder: 'SK-ANT-••••••••••••' },
  { id: 'google', label: 'Google Gemini', keyPrefix: 'AI', placeholder: 'AI••••••••••••••••' },
];

const MODELS: Record<AIProvider, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4O / PERFORMANCE' },
    { value: 'gpt-4o-mini', label: 'GPT-4O-MINI / EFFICIENCY' },
    { value: 'gpt-4-turbo', label: 'GPT-4-TURBO / BALANCED' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'CLAUDE-SONNET-4 / PRECISION' },
    { value: 'claude-haiku-4-20250414', label: 'CLAUDE-HAIKU-4 / SPEED' },
  ],
  google: [
    { value: 'gemini-2.0-flash', label: 'GEMINI-2.0-FLASH / SPEED' },
    { value: 'gemini-2.5-pro', label: 'GEMINI-2.5-PRO / CONTEXT' },
    { value: 'gemini-2.5-flash', label: 'GEMINI-2.5-FLASH / BALANCED' },
  ],
};

export const ProviderSettings = () => {
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [apiKeys, setApiKeys] = useState<Record<AIProvider, string>>({
    openai: '',
    anthropic: '',
    google: '',
  });
  const [model, setModel] = useState('gpt-4o');
  const [recursionLimit, setRecursionLimit] = useState(DEFAULT_RECURSION_LIMIT);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Load settings
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS', payload: { key: 'ai_provider' } }).then(res => {
      if (res?.value) setProvider(res.value as AIProvider);
    });
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS', payload: { key: 'ai_model' } }).then(res => {
      if (res?.value) setModel(res.value as string);
    });
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS', payload: { key: 'agent_recursion_limit' } }).then(res => {
      const v = res?.value as number | undefined;
      if (typeof v === 'number' && v >= RECURSION_LIMIT_MIN && v <= RECURSION_LIMIT_MAX) setRecursionLimit(v);
    });

    for (const p of PROVIDERS) {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS', payload: { key: `ai_api_key_${p.id}` } }).then(res => {
        if (res?.value) {
          setApiKeys(prev => ({ ...prev, [p.id]: res.value as string }));
        }
      });
    }

    // Load legacy openai key as fallback
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS', payload: { key: 'openai_api_key' } }).then(res => {
      if (res?.value) {
        setApiKeys(prev => (prev.openai ? prev : { ...prev, openai: res.value as string }));
      }
    });
  }, []);

  // When provider changes, set the default model for that provider
  useEffect(() => {
    const models = MODELS[provider];
    if (models && !models.find(m => m.value === model)) {
      setModel(models[0].value);
    }
  }, [provider, model]);

  const saveSettings = async () => {
    await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', payload: { key: 'ai_provider', value: provider } });
    await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', payload: { key: 'ai_model', value: model } });
    await chrome.runtime.sendMessage({
      type: 'SET_SETTINGS',
      payload: { key: 'agent_recursion_limit', value: recursionLimit },
    });

    for (const p of PROVIDERS) {
      if (apiKeys[p.id]) {
        await chrome.runtime.sendMessage({
          type: 'SET_SETTINGS',
          payload: { key: `ai_api_key_${p.id}`, value: apiKeys[p.id] },
        });
      }
    }

    // Also set legacy key for backward compat
    if (provider === 'openai' && apiKeys.openai) {
      await chrome.runtime.sendMessage({
        type: 'SET_SETTINGS',
        payload: { key: 'openai_api_key', value: apiKeys.openai },
      });
      await chrome.runtime.sendMessage({
        type: 'SET_SETTINGS',
        payload: { key: 'openai_model', value: model },
      });
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto p-6">
        <div className="space-y-10">
          {/* 01. AI Provider */}
          <div className="space-y-1">
            <label
              htmlFor="provider-select"
              className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {t('providerLabelAiProvider')}
            </label>
            <div className="group relative">
              <select
                id="provider-select"
                value={provider}
                onChange={e => setProvider(e.target.value as AIProvider)}
                className="minimal-input cursor-pointer appearance-none">
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id} className="bg-card-dark">
                    {p.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
                <span className="material-symbols-outlined text-[14px] text-slate-600">keyboard_arrow_down</span>
              </div>
            </div>
          </div>

          {/* 02. API Access Key */}
          <div className="space-y-1">
            <label
              htmlFor="api-key-input"
              className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {t('providerLabelApiKey')}
            </label>
            <div className="relative">
              <input
                id="api-key-input"
                type={showKey ? 'text' : 'password'}
                value={apiKeys[provider]}
                onChange={e => setApiKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                placeholder={PROVIDERS.find(p => p.id === provider)?.placeholder}
                className="minimal-input pr-8"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 flex items-center text-slate-600 transition-colors hover:text-primary">
                <span className="material-symbols-outlined text-[16px]">
                  {showKey ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <p className="mt-2 font-mono text-[9px] tracking-wide text-slate-600">{t('providerLocalStorageNote')}</p>
          </div>

          {/* 03. Agent Recursion Limit */}
          <div className="space-y-1">
            <label
              htmlFor="recursion-limit-input"
              className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {t('providerLabelRecursionLimit')}
            </label>
            <div className="flex items-center gap-3">
              <input
                id="recursion-limit-input"
                type="number"
                min={RECURSION_LIMIT_MIN}
                max={RECURSION_LIMIT_MAX}
                value={recursionLimit}
                onChange={e => {
                  const n = parseInt(e.target.value, 10);
                  if (!Number.isNaN(n))
                    setRecursionLimit(Math.min(RECURSION_LIMIT_MAX, Math.max(RECURSION_LIMIT_MIN, n)));
                }}
                className="minimal-input w-24 text-right font-mono"
              />
              <span className="text-[10px] tracking-wide text-slate-500">{t('providerRecursionLimitHelp')}</span>
            </div>
          </div>

          {/* 04. Neural Engine Selection */}
          <div className="space-y-1">
            <label
              htmlFor="model-select"
              className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {t('providerLabelModel')}
            </label>
            <div className="group relative">
              <select
                id="model-select"
                value={model}
                onChange={e => setModel(e.target.value)}
                className="minimal-input cursor-pointer appearance-none">
                {MODELS[provider]?.map(m => (
                  <option key={m.value} value={m.value} className="bg-card-dark">
                    {m.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
                <span className="material-symbols-outlined text-[14px] text-slate-600">keyboard_arrow_down</span>
              </div>
            </div>
          </div>

          {/* Info callout */}
          <div className="border-t border-slate-900 pt-4">
            <div className="flex gap-3">
              <div className="h-8 w-1 shrink-0 bg-slate-800" />
              <p className="text-[10px] leading-relaxed tracking-tight text-slate-500">{t('providerConfigNote')}</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-background-dark p-6">
        <button
          onClick={saveSettings}
          className="flex w-full items-center justify-center gap-2 bg-primary py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white transition-all hover:brightness-110">
          {saved ? t('providerSaved') : t('providerSaveButton')}
        </button>

        <div className="mt-6 flex items-center justify-between">
          <span className="cursor-pointer text-[9px] font-bold uppercase tracking-widest text-slate-600 transition-colors hover:text-primary">
            {t('providerDocs')}
          </span>
          <div className="flex items-center gap-1">
            <span className="h-1 w-1 animate-pulse rounded-full bg-green-500" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
              {t('providerSystemReady')}
            </span>
          </div>
          <span className="cursor-pointer text-[9px] font-bold uppercase tracking-widest text-slate-600 transition-colors hover:text-primary">
            {t('providerSecurity')}
          </span>
        </div>
      </footer>
    </div>
  );
};
