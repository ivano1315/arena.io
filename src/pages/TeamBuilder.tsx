import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CHAKRA_ORDER, TRAITS, characterById, characters, chakraNeeds, traitsOf, type Character,
} from '../lib/data';
import { ChakraPip, Portrait } from '../components/ui';
import { useI18n, type Key } from '../lib/i18n';

export default function TeamBuilder() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const initial = (params.get('team') ?? '').split(',').filter((id) => characterById.has(id)).slice(0, 3);
  const [team, setTeam] = useState<string[]>(initial);
  const [q, setQ] = useState('');

  useEffect(() => {
    setParams(team.length ? { team: team.join(',') } : {}, { replace: true });
  }, [team, setParams]);

  const picked = team.map((id) => characterById.get(id)!).filter(Boolean) as Character[];
  const needs = useMemo(() => chakraNeeds(picked), [team]); // eslint-disable-line react-hooks/exhaustive-deps
  const traits = useMemo(() => traitsOf(picked), [team]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalCost = Object.values(needs).reduce((a, b) => a + b, 0) || 1;

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    return characters.filter((c) => !n || c.name.toLowerCase().includes(n)).slice(0, 60);
  }, [q]);

  const toggle = (id: string) =>
    setTeam((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id]));

  const missing = TRAITS.filter((tr) => picked.length === 3 && !traits.get(tr.key));

  return (
    <>
      <h1 className="page-title">{t('team.title')}</h1>
      <p className="muted">{t('team.sub')}</p>

      <section className="slots" aria-label={t('team.title')}>
        {[0, 1, 2].map((i) => {
          const c = picked[i];
          return c ? (
            <button key={c.id} className="slot filled" onClick={() => toggle(c.id)} aria-label={t('team.removeAria', { name: c.name })}>
              <Portrait c={c} size={72} />
              <strong>{c.name}</strong>
              <span className="fine">{t('team.remove')}</span>
            </button>
          ) : (
            <div key={i} className="slot">{t('team.empty', { n: i + 1 })}</div>
          );
        })}
      </section>

      {picked.length > 0 && (
        <div className="grid-2">
          <section className="panel">
            <h2>{t('team.demand')}</h2>
            <p className="fine">{t('team.demand.sub')}</p>
            <ul className="bars">
              {CHAKRA_ORDER.map((k) => (
                <li key={k}>
                  <span className="bar-label"><ChakraPip type={k} /> {t(`chakra.${k}`)}</span>
                  <span className="bar"><span className={`fill fill-${k}`} style={{ width: `${(needs[k] / totalCost) * 100}%` }} /></span>
                  <span className="num">{needs[k]}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h2>{t('team.check')}</h2>
            <p className="fine">{t('team.check.sub')}</p>
            <ul className="checks">
              {TRAITS.map((tr) => {
                const n = traits.get(tr.key) ?? 0;
                return (
                  <li key={tr.key} className={n ? 'ok' : 'miss'} title={t(`trait.${tr.key}.hint` as Key)}>
                    <span aria-hidden>{n ? '✓' : '✗'}</span> {t(`trait.${tr.key}` as Key)}
                    <span className="muted"> {n ? `· ×${n}` : picked.length === 3 ? `· ${t('team.missingWord')}` : ''}</span>
                  </li>
                );
              })}
            </ul>
            {picked.length === 3 && missing.length > 0 && (
              <p className="note">{t('team.missing', { list: missing.map((m) => t(`trait.${m.key}` as Key)).join(', ') })}</p>
            )}
          </section>
        </div>
      )}

      <h2>{t('team.choose')}</h2>
      <div className="filters">
        <input type="search" placeholder={t('team.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('team.search')} />
        {team.length > 0 && <button className="btn small" onClick={() => setTeam([])}>{t('team.clear')}</button>}
      </div>
      <div className="pick-grid">
        {results.map((c) => {
          const on = team.includes(c.id);
          const full = !on && team.length >= 3;
          return (
            <button key={c.id} className={`pick ${on ? 'on' : ''}`} disabled={full} onClick={() => toggle(c.id)} aria-pressed={on}>
              <Portrait c={c} size={44} />
              <span>{c.name}</span>
            </button>
          );
        })}
      </div>
      {picked.length > 0 && (
        <p className="fine">{t('team.details')}: {picked.map((c, i) => <span key={c.id}>{i > 0 && ', '}<Link to={`/characters/${encodeURIComponent(c.id)}`}>{c.name}</Link></span>)}</p>
      )}
    </>
  );
}
