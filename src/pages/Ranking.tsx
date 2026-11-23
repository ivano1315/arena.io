import { Fragment, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { characterById, characters, latestStats } from '../lib/data';
import {
  CATEGORIES, DEFAULT_WEIGHTS, HORIZON, PRESETS, TIER_ORDER, rankAll, spearman,
  type Category, type Tier, type Weights,
} from '../lib/rank';
import { Cost, Portrait } from '../components/ui';
import { useI18n, type Key } from '../lib/i18n';

type SortKey = 'rank' | 'name' | Category | 'winRate';

function parseWeights(raw: string | null): Weights {
  if (!raw) return DEFAULT_WEIGHTS;
  const parts = raw.split(',').map(Number);
  if (parts.length !== CATEGORIES.length || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) return DEFAULT_WEIGHTS;
  return Object.fromEntries(CATEGORIES.map((k, i) => [k, parts[i]])) as Weights;
}

export default function Ranking() {
  const { t, tag, num } = useI18n();
  const [params, setParams] = useSearchParams();
  const weights = parseWeights(params.get('w'));
  const [q, setQ] = useState('');
  const [tier, setTier] = useState<Tier | ''>('');
  const [version, setVersion] = useState<'' | 'classic' | 'shippuden'>('');
  const [sort, setSort] = useState<SortKey>('rank');
  const [desc, setDesc] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const setWeights = (w: Weights) => {
    const same = CATEGORIES.every((k) => w[k] === DEFAULT_WEIGHTS[k]);
    setParams(same ? {} : { w: CATEGORIES.map((k) => w[k]).join(',') }, { replace: true });
  };

  const ranked = useMemo(() => rankAll(characters, weights), [params.get('w')]); // eslint-disable-line react-hooks/exhaustive-deps
  const winRates = useMemo(() => new Map(latestStats().map((s) => [s.characterId, s])), []);

  const validation = useMemo(() => {
    const rows = ranked.filter((r) => (winRates.get(r.id)?.matches ?? 0) >= 1000);
    if (rows.length < 10) return null;
    return {
      n: rows.length,
      rho: spearman(rows.map((r) => r.total), rows.map((r) => winRates.get(r.id)!.winRate!)),
    };
  }, [ranked, winRates]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = ranked.filter((r) => {
      const c = characterById.get(r.id)!;
      if (needle && !c.name.toLowerCase().includes(needle)) return false;
      if (tier && r.tier !== tier) return false;
      if (version === 'shippuden' && !c.shippuden) return false;
      if (version === 'classic' && c.shippuden) return false;
      return true;
    });
    const val = (r: (typeof ranked)[number]) =>
      sort === 'rank' ? r.rank : sort === 'name' ? characterById.get(r.id)!.name : sort === 'winRate' ? winRates.get(r.id)?.winRate ?? -1 : r.scores[sort];
    list.sort((a, b) => {
      const x = val(a), y = val(b);
      const cmp = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
      return desc ? -cmp : cmp;
    });
    return list;
  }, [ranked, q, tier, version, sort, desc, winRates]);

  const clickSort = (k: SortKey) => {
    if (sort === k) setDesc(!desc);
    else { setSort(k); setDesc(k !== 'rank' && k !== 'name'); }
  };
  const arrow = (k: SortKey) => (sort === k ? (desc ? ' ▼' : ' ▲') : '');
  const Th = ({ k, label, title, num: isNum }: { k: SortKey; label: string; title?: string; num?: boolean }) => (
    <th className={isNum ? 'num' : ''} title={title} aria-sort={sort === k ? (desc ? 'descending' : 'ascending') : 'none'}>
      <button className="th-btn" onClick={() => clickSort(k)}>{label}{arrow(k)}</button>
    </th>
  );
  const perTurn = (n: number) => num(n / HORIZON, 1);

  return (
    <>
      <h1 className="page-title">{t('rank.title')}</h1>
      <p className="muted">{t('rank.intro', { n: characters.length })}</p>

      <section className="panel">
        <div className="row-between">
          <h2>{t('rank.counts')}</h2>
          <div className="presets">
            {PRESETS.map((p) => {
              const on = CATEGORIES.every((k) => weights[k] === p.weights[k]);
              return <button key={p.key} className={`btn small ${on ? 'primary' : ''}`} onClick={() => setWeights(p.weights)}>{t(`preset.${p.key}` as Key)}</button>;
            })}
          </div>
        </div>
        <div className="sliders">
          {CATEGORIES.map((k) => (
            <label key={k} className="slider" title={t(`cat.${k}.help` as Key)}>
              <span className="slider-top"><span>{t(`cat.${k}` as Key)}</span><strong>{weights[k]}</strong></span>
              <input type="range" min={0} max={100} step={5} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
      </section>

      <div className="filters">
        <input type="search" placeholder={t('rank.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('rank.search')} />
        <select value={tier} onChange={(e) => setTier(e.target.value as Tier | '')} aria-label={t('rank.th.tier')}>
          <option value="">{t('rank.allTiers')}</option>
          {TIER_ORDER.map((x) => <option key={x} value={x}>{t('rank.tier', { t: x })}</option>)}
        </select>
        <select value={version} onChange={(e) => setVersion(e.target.value as typeof version)} aria-label={t('chars.both')}>
          <option value="">{t('chars.both')}</option>
          <option value="classic">{t('chars.classic')}</option>
          <option value="shippuden">{t('chars.shippuden')}</option>
        </select>
        <span className="fine" aria-live="polite">{t('chars.shown', { n: rows.length })}</span>
      </div>

      <div className="table-wrap">
        <table className="rank-table">
          <thead>
            <tr>
              <Th k="rank" label="#" />
              <Th k="name" label={t('rank.th.char')} />
              <th>{t('rank.th.tier')}</th>
              {CATEGORIES.map((k) => <Th key={k} k={k} label={t(`cat.${k}.short` as Key)} title={`${t(`cat.${k}` as Key)}: ${t(`cat.${k}.help` as Key)}`} num />)}
              <Th k="winRate" label={t('rank.th.win')} title={t('rank.th.win.title')} num />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = characterById.get(r.id)!;
              const wr = winRates.get(r.id);
              const expanded = open === r.id;
              return (
                <Fragment key={r.id}>
                  <tr className={expanded ? 'open' : ''}>
                    <td className="num">{r.rank}</td>
                    <td>
                      <button className="row-btn" onClick={() => setOpen(expanded ? null : r.id)} aria-expanded={expanded} aria-label={t('rank.breakdown', { name: c.name })}>
                        <span className="caret" aria-hidden>{expanded ? '▾' : '▸'}</span>
                        <Portrait c={c} size={32} />
                        <span>{c.name}</span>
                      </button>
                    </td>
                    <td><span className={`tier tier-${r.tier}`}>{r.tier}</span></td>
                    {CATEGORIES.map((k) => (
                      <td key={k} className="num"><span className="heat" style={{ ['--v' as string]: r.scores[k] / 100 }}>{Math.round(r.scores[k])}</span></td>
                    ))}
                    <td className={`num ${wr ? ((wr.winRate ?? 0) >= 50 ? 'up' : 'down') : 'muted'}`}>{wr ? num(wr.winRate ?? 0, 1) : '–'}</td>
                  </tr>
                  {expanded && (
                    <tr className="detail-row">
                      <td colSpan={4 + CATEGORIES.length}>
                        <div className="breakdown">
                          <div className="row-between">
                            <strong>{t('rank.score', { score: num(r.total, 1) })}</strong>
                            <Link to={`/characters/${encodeURIComponent(c.id)}`}>{t('rank.open')}</Link>
                          </div>
                          <p className="fine">
                            {t('rank.perTurn', {
                              dmg: perTurn(r.balanced.damage), ctrl: perTurn(r.balanced.control),
                              def: perTurn(r.balanced.defense), heal: perTurn(r.balanced.sustain),
                            })}
                          </p>
                          <div>
                            <p className="fine">{t('rank.rotation', { n: HORIZON })}</p>
                            <ol className="rotation">
                              {r.rotation.map((idx, turn) => (
                                <li key={turn} className={idx < 0 ? 'rest' : ''}>
                                  <span className="turn">{t('rank.turn', { n: turn + 1 })}</span>
                                  {idx < 0 ? <span className="muted">{t('rank.rest')}</span> : <span title={r.skills[idx].name}>{r.skills[idx].name}</span>}
                                </li>
                              ))}
                            </ol>
                          </div>
                          {r.skills.map((s, i) => {
                            const sk = c.skills[i];
                            return (
                              <div key={s.name} className="bd-skill">
                                <img src={s.image} alt="" width={36} height={36} loading="lazy" referrerPolicy="no-referrer" />
                                <div>
                                  <div className="bd-head"><strong>{s.name}</strong> <Cost cost={sk.cost} /> <span className="muted">{t('detail.cooldown')} {sk.cooldown || '–'}</span></div>
                                  <div className="tags">
                                    {s.tags.length ? s.tags.map((x) => <span key={x} className="tag">{tag(x)}</span>) : <span className="muted">{t('rank.noEffect')}</span>}
                                    {s.source === 'heuristic' && <span className="tag est">{t('rank.estimated')}</span>}
                                  </div>
                                  {s.note && <p className="fine" lang="en">{s.note}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">{t('chars.empty')}</div>}
      </div>

      <section className="panel caveat">
        <h2>{t('rank.trust')}</h2>
        <p>
          {t('rank.trust.p1')} <strong>{t('rank.trust.strong')}</strong> {t('rank.trust.p2')}
          {validation && (
            <>
              {' '}{t('rank.trust.check', { n: validation.n })} <strong>{num(validation.rho, 2)}</strong> {t('rank.trust.scale')}
              {Math.abs(validation.rho) < 0.3 && ` ${t('rank.trust.weak')}`}
            </>
          )}
        </p>
        <details>
          <summary>{t('rank.how')}</summary>
          <ul>
            <li>{t('rank.how.sim', { n: HORIZON })}</li>
            {CATEGORIES.map((k) => <li key={k}><strong>{t(`cat.${k}` as Key)}</strong> — {t(`cat.${k}.help` as Key)}</li>)}
            <li>{t('rank.how.scale')}</li>
            <li>{t('rank.how.tiers')}</li>
            <li>{t('rank.how.limits')}</li>
          </ul>
        </details>
      </section>
    </>
  );
}
