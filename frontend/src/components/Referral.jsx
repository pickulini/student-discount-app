import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { Rule, Rule2, VRule, SectionLabel, PrimaryButton, TextButton, Avatar, num } from './merchant/kit';
import { useMobileTop } from '../context/MobileChrome';

/** D41 · Рефералы: код и ссылка, как это работает, статистика и список приглашённых. */

const ddmm = (d) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
};

const Stat = ({ value, label, accent }) => (
  <div className="flex-1 min-w-0 flex flex-col gap-1">
    <span className={`font-display font-bold text-[20px] md:text-[22px] tracking-[-0.01em] ${accent ? 'text-accent' : 'text-ink'}`}>{value}</span>
    <span className="font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft">{label}</span>
  </div>
);

const Referral = () => {
  const [code, setCode] = useState(null);
  const [stats, setStats] = useState(null);
  const [invitees, setInvitees] = useState([]);
  const [copied, setCopied] = useState('');
  useMobileTop({ back: '/wallet', label: 'Кошелёк' });

  useEffect(() => {
    api.get('/referral/code').then((r) => setCode(r.data.code || '')).catch(() => setCode(''));
    api.get('/referral/stats').then((r) => setStats(r.data)).catch(() => setStats({}));
    api.get('/referral/invitees').then((r) => setInvitees(r.data || [])).catch(() => {});
  }, []);

  if (code === null) return <RouteLoadingView label="Загружаем приглашения..." />;

  const link = `${window.location.origin}/r/${code}`;
  const shortLink = link.replace(/^https?:\/\//, '');
  const shareText = 'Скидки для студентов — регистрируйся по моей ссылке, получим по 100 бонусов:';

  const copy = async (what) => {
    if (await copyText(what === 'code' ? code : link)) {
      setCopied(what);
      setTimeout(() => setCopied(''), 1600);
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Студент−%', text: shareText, url: link });
        return;
      } catch {
        /* отмена — ничего не делаем */
      }
    } else {
      copy('link');
    }
  };

  const earned = invitees.reduce((s, i) => s + (i.reward_status === 'credited' ? Number(i.reward_amount || 0) : 0), 0) || Number(stats?.bonus_total || 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="md:hidden flex flex-col gap-5">
        <div className="flex flex-col gap-[10px]">
          <h1 className="font-display font-bold text-[30px] leading-none tracking-[-0.02em] uppercase text-ink">Приглашай друзей</h1>
          <p className="text-[14px] leading-[21px] text-ink-soft">Друг регистрируется по вашей ссылке и проходит верификацию — вы оба получаете по 100 бонусов.</p>
        </div>
        <Rule2 />
        <div className="flex flex-col items-center gap-4 py-1">
          <span className="font-mono font-medium text-[11px] tracking-[0.08em] uppercase text-ink-soft">Ваш код</span>
          <span className="font-display font-bold text-[40px] leading-none tracking-[0.01em] uppercase text-ink break-all text-center">{code}</span>
          <TextButton onClick={() => copy('code')}>{copied === 'code' ? '✓ Скопировано' : 'Копировать код'}</TextButton>
        </div>
        <Rule />
        <div className="flex gap-3 items-center">
          <span className="flex-1 min-w-0 font-mono text-[13px] text-ink truncate">{shortLink}</span>
          <button onClick={() => copy('link')} className="font-mono font-bold text-[11px] tracking-[0.04em] text-ink whitespace-nowrap">
            {copied === 'link' ? '✓ СКОПИРОВАНО' : 'КОПИРОВАТЬ'}
          </button>
        </div>
        <Rule />
        <PrimaryButton onClick={share} className="w-full">Поделиться ссылкой</PrimaryButton>
      </div>
      <div className="hidden md:block font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft whitespace-pre">
        <Link to="/wallet" className="hover:text-ink">Кошелёк</Link>
        {'  /  '}Рефералы
      </div>
      <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start -mt-3 md:mt-0">
        <div className="hidden md:flex flex-1 min-w-0 w-full flex-col gap-6">
          <div className="flex flex-col gap-[10px]">
            <h1 className="font-display font-bold text-[28px] sm:text-[36px] leading-none tracking-[-0.02em] uppercase text-ink">Приглашай друзей</h1>
            <p className="text-[16px] leading-[24px] text-ink-soft">
              Друг регистрируется по вашей ссылке и проходит верификацию — вы оба получаете по 100 бонусов. Без лимита.
            </p>
          </div>
          <Rule2 />
          <div className="font-mono font-medium text-[11px] tracking-[0.08em] uppercase text-ink-soft">Ваш код</div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="font-display font-bold text-[34px] sm:text-[48px] leading-none tracking-[0.02em] uppercase text-ink break-all">{code}</span>
            <TextButton onClick={() => copy('code')}>{copied === 'code' ? '✓ Скопировано' : 'Копировать'}</TextButton>
          </div>
          <div className="flex gap-3 items-center border-b border-ink pb-[10px]">
            <span className="flex-1 min-w-0 font-mono text-[15px] text-ink truncate">{shortLink}</span>
            <button onClick={() => copy('link')} className="font-mono font-bold text-[11px] tracking-[0.04em] text-ink hover:text-accent whitespace-nowrap">
              {copied === 'link' ? '✓ СКОПИРОВАНО' : 'КОПИРОВАТЬ'}
            </button>
          </div>
          <div className="flex items-center gap-5 flex-wrap">
            <PrimaryButton onClick={share}>Поделиться ссылкой</PrimaryButton>
            <TextButton as="a" href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
              Telegram
            </TextButton>
            <TextButton as="a" href={`https://vk.com/share.php?url=${encodeURIComponent(link)}&title=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
              ВКонтакте
            </TextButton>
          </div>
          <Rule />
          <SectionLabel>Как это работает</SectionLabel>
          {['Отправьте ссылку или код другу.', 'Друг регистрируется и подтверждает статус студента.', 'Бонусы приходят обоим в течение суток после верификации.'].map((t, i) => (
            <div key={t} className="flex gap-4 items-start">
              <span className="font-mono text-[13px] text-ink-soft pt-[2px]">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 text-[16px] leading-[24px] text-ink">{t}</span>
            </div>
          ))}
        </div>

        <VRule className="hidden lg:block" />

        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          <Rule2 className="md:hidden" />
          <div className="flex gap-4 items-stretch">
            <Stat value={num(stats?.total_invites ?? invitees.length)} label="Приглашено" />
            <VRule />
            <Stat value={num(stats?.active ?? invitees.filter((i) => i.verified).length)} label="Активных" />
            <VRule />
            <Stat value={`${num(earned)} Б`} label="Заработано" accent />
          </div>
          <Rule2 />
          <SectionLabel>Приглашённые</SectionLabel>
          {invitees.length === 0 ? (
            <div className="text-[14px] text-ink-soft">Пока никого. Отправьте ссылку другу — он появится здесь сразу после регистрации.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {invitees.map((p, i) => {
                const meta = [p.username ? `@${p.username}` : null, p.university || null, ddmm(p.joined_at)].filter(Boolean).join(' · ');
                let right;
                if (p.reward_status === 'credited') right = <span className="font-mono font-bold text-[12px] text-ink whitespace-nowrap">+{num(p.reward_amount)} Б</span>;
                else if (p.reward_status === 'pending')
                  right = (
                    <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft whitespace-nowrap text-right">
                      +{num(p.reward_amount)} Б{p.available_at ? ` · ${ddmm(p.available_at)}` : ''}
                    </span>
                  );
                else if (p.reward_status === 'cancelled') right = <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft whitespace-nowrap">ОТМЕНЁН</span>;
                else right = <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft whitespace-nowrap">{p.verified ? 'НАЧИСЛЯЕМ' : 'ЖДЁТ ВЕРИФ.'}</span>;
                return (
                  <React.Fragment key={p.user_id}>
                    {i > 0 && <Rule className="hidden md:block" />}
                    <Link to={p.username ? `/@${p.username}` : '#'} className="flex gap-3 items-center hover:opacity-80">
                      <Avatar src={p.avatar_url} name={p.full_name} size={40} />
                      <span className="flex-1 min-w-0 flex flex-col gap-[2px]">
                        <span className="text-[15px] font-semibold text-ink truncate">{p.full_name}</span>
                        <span className="font-mono text-[11px] tracking-[0.02em] text-ink-soft truncate">{meta}</span>
                      </span>
                      {right}
                    </Link>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Referral;
