import { Link, useParams } from 'react-router-dom';
import { characterById, news, updates } from '../lib/data';
import { Badge, Portrait } from '../components/ui';
import { useI18n } from '../lib/i18n';

export default function Updates() {
  const { slug } = useParams();
  const { t, lang, date, patch, num } = useI18n();
  const current = updates.find((u) => u.slug === slug) ?? updates[0];
  const post = news.find((n) => n.slug === current.slug);

  return (
    <>
      <h1 className="page-title">{t('updates.title')}</h1>
      {lang === 'pt' && <p className="fine">{t('note.english')}</p>}
      <div className="split">
        <nav className="side-list" aria-label={t('updates.nav')}>
          {updates.map((u) => (
            <Link key={u.slug} to={`/updates/${u.slug}`} className={u.slug === current.slug ? 'active' : ''}>
              <strong>{patch(u.title)}</strong>
              <span className="muted">{t('updates.row', { date: date(u.date), n: u.entries.length })}</span>
            </Link>
          ))}
        </nav>

        <div>
          <h2 className="no-top">{patch(current.title)}</h2>
          <p className="fine">{date(current.date)}</p>
          {post && <div className="prose pre" lang="en">{post.body.slice(0, 900)}{post.body.length > 900 ? '…' : ''}</div>}

          <div className="history">
            {current.entries.map((e) => {
              const c = characterById.get(e.characterId);
              if (!c) return null;
              return (
                <article key={e.characterId} className="panel">
                  <div className="row-between">
                    <Link to={`/characters/${encodeURIComponent(c.id)}`} className="charlink"><Portrait c={c} size={40} /><strong>{c.name}</strong></Link>
                    <Badge type={e.type} />
                  </div>
                  {e.winRate != null && <p className="fine">{t('updates.wr', { wr: num(e.winRate, 2), n: num(e.matches ?? 0) })}</p>}
                  {e.skills.map((s) => (
                    <div key={s.name} className="change" lang="en">
                      <strong>{s.name}</strong>
                      <ul>{s.changes.map((x, i) => <li key={i}>{x}</li>)}</ul>
                    </div>
                  ))}
                  {e.note && <p className="note" lang="en">{e.note}</p>}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
