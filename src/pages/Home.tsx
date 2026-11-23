import { Link } from 'react-router-dom';
import { characterById, characters, latestStats, news, totalSkills, updates } from '../lib/data';
import { Badge, CharLink, SectionHead } from '../components/ui';
import { useI18n } from '../lib/i18n';

export default function Home() {
  const { t, lang, date, patch, num } = useI18n();
  const latest = updates[0];
  const post = news[0];
  const stats = latestStats().filter((s) => (s.matches ?? 0) >= 1000);
  const top = [...stats].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0)).slice(0, 5);
  const low = [...stats].sort((a, b) => (a.winRate ?? 0) - (b.winRate ?? 0)).slice(0, 5);

  const summary = post.body.split('\n').find((l) => l.trim().length > 40) ?? '';

  return (
    <>
      <section className="hero">
        <p className="eyebrow">{t('home.eyebrow')}</p>
        <h1>{t('home.h1a')}<br />{t('home.h1b')}</h1>
        <p className="lede">{t('home.lede')}</p>
        <div className="hero-actions">
          <Link className="btn primary" to="/characters">{t('home.browse')}</Link>
          <Link className="btn" to="/team-builder">{t('home.openTeam')}</Link>
        </div>
        <dl className="hero-stats">
          <div><dt>{characters.length}</dt><dd>{t('home.stat.characters')}</dd></div>
          <div><dt>{num(totalSkills)}</dt><dd>{t('home.stat.skills')}</dd></div>
          <div><dt>{updates.length}</dt><dd>{t('home.stat.patches')}</dd></div>
          <div><dt>{date(latest.date)}</dt><dd>{t('home.stat.latest')}</dd></div>
        </dl>
      </section>

      <section className="panel">
        <SectionHead
          title={patch(latest.title)}
          sub={t('home.changed', { date: date(latest.date), n: latest.entries.length })}
          right={<Link className="btn small" to={`/updates/${latest.slug}`}>{t('home.fullNotes')}</Link>}
        />
        <p className="prose" lang="en">{summary}</p>
        {lang === 'pt' && <p className="fine">{t('note.english')}</p>}
        <div className="chips">
          {latest.entries.map((e) => {
            const c = characterById.get(e.characterId);
            if (!c) return null;
            return (
              <Link key={e.characterId} to={`/characters/${encodeURIComponent(c.id)}`} className="chip">
                <Badge type={e.type} /> {c.name}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <SectionHead title={t('home.winning')} sub={t('home.winning.sub')} />
          <ul className="rank">
            {top.map((s) => {
              const c = characterById.get(s.characterId);
              return c && (
                <li key={s.characterId}>
                  <CharLink c={c} />
                  <span className="wr up">{num(s.winRate ?? 0, 1)}%</span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="panel">
          <SectionHead title={t('home.struggling')} sub={t('home.struggling.sub')} />
          <ul className="rank">
            {low.map((s) => {
              const c = characterById.get(s.characterId);
              return c && (
                <li key={s.characterId}>
                  <CharLink c={c} />
                  <span className="wr down">{num(s.winRate ?? 0, 1)}%</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <p className="fine">{t('home.fine')}</p>

      <SectionHead title={t('home.tools')} />
      <div className="tools">
        <Link to="/characters" className="tool"><h3>{t('home.tool.chars')}</h3><p>{t('home.tool.chars.d')}</p></Link>
        <Link to="/ranking" className="tool"><h3>{t('home.tool.rank')}</h3><p>{t('home.tool.rank.d')}</p></Link>
        <Link to="/meta" className="tool"><h3>{t('home.tool.meta')}</h3><p>{t('home.tool.meta.d')}</p></Link>
        <Link to="/team-builder" className="tool"><h3>{t('home.tool.team')}</h3><p>{t('home.tool.team.d')}</p></Link>
        <Link to="/updates" className="tool"><h3>{t('home.tool.updates')}</h3><p>{t('home.tool.updates.d')}</p></Link>
      </div>
    </>
  );
}
