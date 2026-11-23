import { useMemo, useState } from 'react';
import { characterById, latestStats, updates } from '../lib/data';
import { Badge, CharLink, SectionHead } from '../components/ui';
import { useI18n } from '../lib/i18n';

type SortKey = 'winRate' | 'matches';

export default function Meta() {
  const { t, date, patch, num } = useI18n();
  const [min, setMin] = useState(1000);
  const [sort, setSort] = useState<SortKey>('winRate');
  const [desc, setDesc] = useState(true);

  const rows = useMemo(() => {
    const r = latestStats().filter((s) => (s.matches ?? 0) >= min);
    r.sort((a, b) => ((a[sort] ?? 0) - (b[sort] ?? 0)) * (desc ? -1 : 1));
    return r;
  }, [min, sort, desc]);

  const latest = updates[0];
  const toggle = (k: SortKey) => { if (sort === k) setDesc(!desc); else { setSort(k); setDesc(true); } };
  const arrow = (k: SortKey) => (sort === k ? (desc ? ' ▼' : ' ▲') : '');

  return (
    <>
      <h1 className="page-title">{t('meta.title')}</h1>
      <p className="muted">{t('meta.sub', { n: updates.length })}</p>

      <section className="panel">
        <SectionHead title={t('meta.latest', { title: patch(latest.title) })} sub={date(latest.date)} />
        <div className="three-col">
          {(['nerf', 'boost', 'tweak'] as const).map((k) => (
            <div key={k}>
              <h3><Badge type={k} /></h3>
              <ul className="plain">
                {latest.entries.filter((e) => e.type === k).map((e) => {
                  const c = characterById.get(e.characterId);
                  return c && <li key={e.characterId}><CharLink c={c} size={32} /></li>;
                })}
                {!latest.entries.some((e) => e.type === k) && <li className="muted">{t('meta.none')}</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="filters">
        <label>
          {t('meta.min')}{' '}
          <select value={min} onChange={(e) => setMin(Number(e.target.value))}>
            {[0, 100, 500, 1000, 5000, 10000].map((n) => <option key={n} value={n}>{num(n)}+</option>)}
          </select>
        </label>
        <span className="fine">{t('meta.count', { n: rows.length })}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('meta.th.char')}</th>
              <th>{t('meta.th.change')}</th>
              <th className="num"><button className="th-btn" onClick={() => toggle('winRate')}>{t('meta.th.wr')}{arrow('winRate')}</button></th>
              <th className="num"><button className="th-btn" onClick={() => toggle('matches')}>{t('meta.th.matches')}{arrow('matches')}</button></th>
              <th>{t('meta.th.patch')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = characterById.get(r.characterId);
              if (!c) return null;
              return (
                <tr key={r.characterId}>
                  <td><CharLink c={c} size={32} /></td>
                  <td><Badge type={r.type} /></td>
                  <td className={`num ${(r.winRate ?? 0) >= 50 ? 'up' : 'down'}`}>{num(r.winRate ?? 0, 2)}%</td>
                  <td className="num">{num(r.matches ?? 0)}</td>
                  <td className="muted">{patch(r.update.title)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">{t('meta.empty')}</div>}
      </div>
    </>
  );
}
