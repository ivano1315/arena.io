import { Link, useParams } from 'react-router-dom';
import { characterById, characters, historyOf } from '../lib/data';
import { Badge, Cost, Portrait } from '../components/ui';
import { DEFAULT_WEIGHTS, rankAll } from '../lib/rank';
import { useI18n, type Key } from '../lib/i18n';

const defaultRanking = rankAll(characters, DEFAULT_WEIGHTS);

export default function CharacterDetail() {
  const { id = '' } = useParams();
  const { t, lang, date, patch, num } = useI18n();
  const c = characterById.get(decodeURIComponent(id));

  if (!c) {
    return (
      <div className="empty">
        {t('detail.notFound')} <Link to="/characters">{t('detail.back')}</Link>
      </div>
    );
  }

  const history = historyOf(c.id);
  const related = characters.filter((o) => o.baseName === c.baseName && o.id !== c.id);
  const ranked = defaultRanking.find((r) => r.id === c.id);
  const className = (k: string) => t(`class.${k}` as Key) === `class.${k}` ? k : t(`class.${k}` as Key);

  return (
    <>
      <p className="crumbs"><Link to="/characters">{t('nav.characters')}</Link> / {c.name}</p>
      <section className="char-head">
        <Portrait c={c} size={112} />
        <div>
          <h1 className="page-title">{c.name}</h1>
          <p className="prose" lang="en">{c.description}</p>
          {ranked && (
            <p className="rank-pill">
              <span className={`tier tier-${ranked.tier}`}>{ranked.tier}</span>
              <Link to="/ranking">{t('detail.rank', { rank: ranked.rank, total: characters.length })}</Link>
              <span className="muted">{t('detail.score', { score: num(ranked.total, 1) })}</span>
            </p>
          )}
          <p className="fine">
            {c.unlock.type === 'free'
              ? t('detail.unlockedStart')
              : <>{t('detail.unlock')}: <strong lang="en">{c.unlock.detail}</strong> ({t('detail.missionWord')})</>}
          </p>
          {related.length > 0 && (
            <p className="fine">
              {t('detail.versions')}:{' '}
              {related.map((r, i) => (
                <span key={r.id}>{i > 0 && ', '}<Link to={`/characters/${encodeURIComponent(r.id)}`}>{r.name}</Link></span>
              ))}
            </p>
          )}
          {lang === 'pt' && <p className="fine">{t('note.english')}</p>}
        </div>
      </section>

      <h2>{t('detail.skills')}</h2>
      <div className="skills">
        {c.skills.map((s) => (
          <article key={s.name} className="skill">
            <img src={s.image} alt="" width={56} height={56} loading="lazy" referrerPolicy="no-referrer" />
            <div>
              <h3>{s.name}</h3>
              <p lang="en">{s.description}</p>
              <p className="meta-row">
                <span className="meta-item"><span className="muted">{t('detail.cost')}</span> <Cost cost={s.cost} /></span>
                <span className="meta-item"><span className="muted">{t('detail.cooldown')}</span> {s.cooldown || t('detail.none')}</span>
                <span className="meta-item"><span className="muted">{t('detail.classes')}</span> {s.classes.map(className).join(', ')}</span>
              </p>
            </div>
          </article>
        ))}
      </div>

      <h2>{t('detail.history')}</h2>
      {history.length === 0 ? (
        <p className="muted">{t('detail.noHistory')}</p>
      ) : (
        <div className="history">
          {history.map((h) => (
            <article key={h.update.slug} className="panel">
              <div className="row-between">
                <Link to={`/updates/${h.update.slug}`}><strong>{patch(h.update.title)}</strong></Link>
                <span><Badge type={h.type} /> <span className="muted">{date(h.update.date)}</span></span>
              </div>
              {h.winRate != null && (
                <p className="fine">{t('detail.wr', { wr: num(h.winRate, 2), n: num(h.matches ?? 0) })}</p>
              )}
              {h.skills.map((s) => (
                <div key={s.name} className="change" lang="en">
                  <strong>{s.name}</strong>
                  <ul>{s.changes.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              ))}
              {h.note && <p className="note" lang="en">{h.note}</p>}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
