import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { characterById, characters } from '../lib/data';
import { matchups, type CounterReason } from '../lib/synergy';
import { ChakraPip, Portrait } from '../components/ui';
import { useI18n, type Key } from '../lib/i18n';

type Mode = 'partners' | 'counters';
type Direction = 'counter' | 'beats';

const CHAKRA_COLORS = ['taijutsu', 'bloodline', 'ninjutsu', 'genjutsu'] as const;

export default function Trios() {
  const { t, num } = useI18n();
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('mode') === 'counters' ? 'counters' : 'partners';
  const direction: Direction = params.get('dir') === 'beats' ? 'beats' : 'counter';
  const max = mode === 'partners' ? 2 : 3;
  const picked = (params.get('pick') ?? '').split(',').filter((id) => characterById.has(id)).slice(0, max);
  const [q, setQ] = useState('');

  const update = (next: { mode?: Mode; dir?: Direction; pick?: string[] }) => {
    const m = next.mode ?? mode;
    const d = next.dir ?? direction;
    const p = next.pick ?? picked;
    const out: Record<string, string> = {};
    if (m !== 'partners') out.mode = m;
    if (m === 'counters' && d !== 'counter') out.dir = d;
    if (p.length) out.pick = p.join(',');
    setParams(out, { replace: true });
  };

  const mu = useMemo(() => matchups(), []);

  const trios = useMemo(() => (mode === 'partners' ? mu.bestTrios(picked, 10) : []), [mode, picked.join(','), mu]); // eslint-disable-line react-hooks/exhaustive-deps
  const counters = useMemo(
    () => (mode === 'counters' && picked.length ? mu.counters(picked, direction, 16) : []),
    [mode, direction, picked.join(','), mu], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const toggle = (id: string) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length >= max ? picked : [...picked, id];
    update({ pick: next });
  };

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    return characters.filter((c) => !n || c.name.toLowerCase().includes(n)).slice(0, 60);
  }, [q]);

  const Bar = ({ label, value }: { label: string; value: number }) => (
    <div className="mini-bar" title={`${label}: ${Math.round(value)}`}>
      <span className="mini-label">{label}</span>
      <span className="bar"><span className="fill fill-accent" style={{ width: `${Math.round(value)}%` }} /></span>
      <span className="num">{Math.round(value)}</span>
    </div>
  );

  return (
    <>
      <h1 className="page-title">{t('trios.title')}</h1>
      <p className="muted">{t('trios.sub')}</p>

      <div className="tabs" role="tablist">
        {(['partners', 'counters'] as Mode[]).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => update({ mode: m, pick: picked.slice(0, m === 'partners' ? 2 : 3) })}>
            {t(`trios.mode.${m}` as Key)}
          </button>
        ))}
        {mode === 'counters' && (
          <span className="dir">
            {(['counter', 'beats'] as Direction[]).map((d) => (
              <button key={d} className={direction === d ? 'on' : ''} aria-pressed={direction === d} onClick={() => update({ dir: d })}>
                {t(`trios.dir.${d}` as Key)}
              </button>
            ))}
          </span>
        )}
      </div>

      <p className="fine">{mode === 'partners' ? t('trios.pickAllies') : t('trios.pickEnemies')}</p>
      <section className="slots slots-sm" aria-label={t('trios.title')}>
        {Array.from({ length: max }, (_, i) => {
          const c = picked[i] ? characterById.get(picked[i]) : undefined;
          return c ? (
            <button key={c.id} className="slot filled" onClick={() => toggle(c.id)} aria-label={t('team.removeAria', { name: c.name })}>
              <Portrait c={c} size={56} />
              <strong>{c.name}</strong>
              <span className="fine">{t('team.remove')}</span>
            </button>
          ) : (
            <div key={i} className="slot">{t(mode === 'partners' ? 'trios.slot.ally' : 'trios.slot.enemy', { n: i + 1 })}</div>
          );
        })}
      </section>

      <div className="filters">
        <input type="search" placeholder={t('trios.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('trios.search')} />
        {picked.length > 0 && <button className="btn small" onClick={() => update({ pick: [] })}>{t('trios.clear')}</button>}
      </div>
      <div className="pick-grid">
        {results.map((c) => {
          const on = picked.includes(c.id);
          return (
            <button key={c.id} className={`pick ${on ? 'on' : ''}`} disabled={!on && picked.length >= max} onClick={() => toggle(c.id)} aria-pressed={on}>
              <Portrait c={c} size={44} />
              <span>{c.name}</span>
            </button>
          );
        })}
      </div>

      {/* results */}
      {mode === 'partners' && (
        <>
          <h2>{picked.length ? t('trios.results.trios') : t('trios.results.trios.overall')}</h2>
          <div className="trio-list">
            {trios.map((tr, idx) => (
              <article key={tr.ids.join('+')} className="panel trio">
                <header className="trio-head">
                  <span className="trio-rank">{t('trios.rank', { n: idx + 1 })}</span>
                  <div className="trio-members">
                    {tr.ids.map((id) => {
                      const c = characterById.get(id)!;
                      return (
                        <Link key={id} to={`/characters/${encodeURIComponent(id)}`} className="trio-member">
                          <Portrait c={c} size={52} />
                          <span>{c.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="trio-score" title={t('trios.score')}>
                    <strong>{num(tr.score, 1)}</strong>
                    <span className="fine">{t('trios.score')}</span>
                  </div>
                </header>
                <div className="trio-body">
                  <div className="trio-bars">
                    <Bar label={t('cat.damage')} value={tr.cover.damage} />
                    <Bar label={t('cat.control')} value={tr.cover.control} />
                    <Bar label={t('cat.defense')} value={tr.cover.defense} />
                    <Bar label={t('cat.sustain')} value={tr.cover.sustain} />
                    <Bar label={t('cat.utility')} value={tr.cover.utility} />
                  </div>
                  <div className="trio-side">
                    <p className="fine">{t('trios.power')} <strong>{num(tr.power, 0)}</strong> · {t('trios.coverage')} <strong>{num(tr.coverage, 0)}</strong> · {t('trios.fit')} <strong>{num(tr.fit, 0)}</strong></p>
                    <div className="cost">
                      {CHAKRA_COLORS.filter((k) => tr.colors[k] >= 0.15).map((k) => <ChakraPip key={k} type={k} />)}
                    </div>
                    {tr.ids.filter((id) => !picked.includes(id)).map((id) => {
                      const gaps = mu.gapsFilled(id, tr.ids.filter((o) => o !== id));
                      return (
                        <p key={id} className="fine">
                          <strong>{characterById.get(id)!.name}</strong>:{' '}
                          {gaps.length ? t('trios.fills', { list: gaps.map((g) => t(`cat.${g}` as Key).toLowerCase()).join(', ') }) : t('trios.addsPower')}
                        </p>
                      );
                    })}
                    <Link className="btn small" to={`/team-builder?team=${tr.ids.map(encodeURIComponent).join(',')}`}>{t('trios.openTeam')}</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {mode === 'counters' && (
        <>
          <h2>{direction === 'counter' ? t('trios.results.counters') : t('trios.results.beats')}</h2>
          {picked.length === 0 ? (
            <div className="empty">{t('trios.none')}</div>
          ) : (
            <div className="counter-list">
              {counters.map((r, idx) => {
                const c = characterById.get(r.id)!;
                return (
                  <article key={r.id} className="panel counter">
                    <Link to={`/characters/${encodeURIComponent(r.id)}`} className="trio-member">
                      <Portrait c={c} size={52} />
                      <span><span className="trio-rank">{t('trios.rank', { n: idx + 1 })}</span> {c.name}</span>
                    </Link>
                    <div className="counter-score" title={t('trios.counterScore')}>
                      <span className="bar"><span className="fill fill-accent" style={{ width: `${Math.round(r.score)}%` }} /></span>
                      <strong>{num(r.score, 0)}</strong>
                    </div>
                    <ul className="reasons">
                      {r.reasons.length
                        ? r.reasons.map((x: { key: CounterReason }) => <li key={x.key}>{t(`counter.${x.key}` as Key)}</li>)
                        : <li className="muted">{t('trios.noReasons')}</li>}
                    </ul>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <section className="panel caveat">
        <h2>{t('trios.caveat.title')}</h2>
        <p className="fine">{mode === 'partners' ? t('trios.caveat.partners') : t('trios.caveat.counters')}</p>
      </section>
    </>
  );
}
