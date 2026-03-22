import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Check, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types/Chat';

interface Props {
  message: Message;
  currentLanguage?: 'en' | 'de';
}

const LABELS: Record<string, { en: string; de: string }> = {
  You:             { en: 'You',           de: 'Du' },
  'Debate Partner':{ en: 'Debate Partner',de: 'Diskussionspartner' },
};

function fmt(ts: string | Date) {
  try {
    return (typeof ts === 'string' ? new Date(ts) : ts)
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return '--:--'; }
}

const isError = (text: string) =>
  text.startsWith('Sorry,') || text.startsWith('Entschuldigung,');

export default function ChatBubble({ message, currentLanguage = 'en' }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.type === 'user';
  const error  = !isUser && isError(message.message);

  const copy = async () => {
    await navigator.clipboard.writeText(message.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span
          className="px-3 py-1 rounded-full text-fluid-xs tracking-wide"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          {message.message}
        </span>
      </div>
    );
  }

  const label = LABELS[message.sender]?.[currentLanguage] ?? message.sender;

  const avatarBg = isUser
    ? 'linear-gradient(135deg,var(--user-from),var(--user-to))'
    : error
      ? 'var(--error-bg)'
      : 'linear-gradient(135deg,var(--bot-from),var(--bot-to))';

  const avatarInitial = isUser ? 'Y' : 'D';

  return (
    <div className={`flex w-full group ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
        style={{ maxWidth: 'min(82%, 580px)' }}
      >

        <div
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 self-end mb-4 text-fluid-xs font-bold text-white"
          style={{
            background: avatarBg,
            boxShadow: isUser
              ? '0 2px 8px var(--user-glow)'
              : error
                ? 'none'
                : '0 2px 8px var(--bot-glow)',
            minWidth: '1.75rem',
          }}
        >
          {error
            ? <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--error)' }} />
            : avatarInitial}
        </div>

        <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>

          <div
            className={`flex items-center gap-2 px-0.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <span className="text-fluid-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {label}
            </span>
            <span className="text-fluid-xs" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
              {fmt(message.timestamp)}
            </span>
          </div>
          <motion.div
            className={`relative overflow-hidden ${
              isUser ? 'bubble-user rounded-2xl rounded-br-sm' : 'bubble-bot rounded-2xl rounded-bl-sm'
            } ${error ? 'error-banner' : ''}`}
            style={error ? {
              background: 'var(--error-bg)',
              border: '1px solid var(--error-border)',
              borderRadius: '1rem',
              padding: '0.7rem 1rem',
            } : {
              padding: 'clamp(0.6rem, 1.5vw, 0.875rem) clamp(0.75rem, 2vw, 1.1rem)',
            }}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            whileHover={{ scale: 1.005 }}
          >
            <div
              className="bubble-prose text-fluid-base relative z-10 select-text"
              style={{ color: error ? 'var(--error)' : 'rgba(255,255,255,0.95)' }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.message || '…'}
              </ReactMarkdown>
            </div>
            {!error && message.message && (
              <button
                onClick={copy}
                aria-label="Copy message"
                className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.6)' }}
              >
                {copied
                  ? <Check className="w-3 h-3" style={{ color: '#6bffb8' }} />
                  : <Copy className="w-3 h-3" />}
              </button>
            )}
          </motion.div>

          {!isUser && message.message === '' && (
            <div className="px-1">
              <span
                className="inline-block w-2 h-4 rounded-sm animate-pulse"
                style={{ background: 'var(--bot-from)', opacity: 0.7 }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
