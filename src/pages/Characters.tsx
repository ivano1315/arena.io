import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHAKRA_ORDER, characters, type Chakra } from '../lib/data';
import { ChakraPip, Portrait } from '../components/ui';
import { useI18n, type Key } from '../lib/i18n';

const CLASSES = ['Physical', 'Chakra', 'Mental', 'Affliction', 'Melee', 'Ranged', 'Action', 'Control'];

export default function Characters() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [chakra, setChakra] = useState<Chakra | ''>('');
  const [cls, setCls] = useState('');
  const [version, setVersion] = useState<'' | 'classic' | 'shippuden'>('');
  const [unlock, setUnlock] = useState<'' | 'free' | 'mission'>('');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return characters.filter((c) => {
      if (needle && !c.name.toLowerCase().includes(needle) && !c.skills.some((s) => s.name.toLowerCase().includes(needle))) return false;
      if (chakra && !c.skills.some((s) => s.cost.includes(chakra))) return false;
      if (cls && !c.classes.includes(cls)) return false;
      if (version === 'shippuden' && !c.shippuden) return false;
      if (version === 'classic' && c.shippuden) return false;
      if (unlock && c.unlock.type !== unlock) return false;
      return true;
    });
  }, [q, chakra, cls, version, unlock]);

  const reset = () => { setQ(''); setChakra(''); setCls(''); setVersion(''); setUnlock(''); };
  const dirty = q || chakra || cls || version || unlock;

  return (
    <>
      <h1 className="page-title">{t('chars.title')}</h1>
      <p className="muted">{t('chars.sub', { n: characters.length })}</p>

      <div className="filters">
        <input type="search" placeholder={t('chars.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('chars.search')} />
        <select value={chakra} onChange={(e) => setChakra(e.target.value as Chakra | '')} aria-label={t('chars.anyChakra')}>
          <option value="">{t('chars.anyChakra')}</option>
          {CHAKRA_ORDER.map((c) => <option key={c} value={c}>{t(`chakra.${c}`)}</option>)}
        </select>
        <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label={t('chars.anyClass')}>
          <option value="">{t('chars.anyClass')}</option>
          {CLASSES.map((c) => <option key={c} value={c}>{t(`class.${c}` as Key)}</option>)}
        </select>
        <select value={version} onChange={(e) => setVersion(e.target.value as typeof version)} aria-label={t('chars.both')}>
          <option value="">{t('chars.both')}</option>
          <option value="classic">{t('chars.classic')}</option>
          <option value="shippuden">{t('chars.shippuden')}</option>
        </select>
        <select value={unlock} onChange={(e) => setUnlock(e.target.value as typeof unlock)} aria-label={t('chars.anyUnlock')}>
          <option value="">{t('chars.anyUnlock')}</option>
          <option value="free">{t('chars.free')}</option>
          <option value="mission">{t('chars.mission')}</option>
        </select>
        {dirty && <button className="btn small" onClick={reset}>{t('chars.reset')}</button>}
      </div>

      <p className="fine" aria-live="polite">{t('chars.shown', { n: list.length })}</p>
      {list.length === 0 ? (
        <div className="empty">{t('chars.empty')}</div>
      ) : (
        <div className="cards">
          {list.map((c) => (
            <Link key={c.id} to={`/characters/${encodeURIComponent(c.id)}`} className="card">
              <Portrait c={c} size={64} />
              <div className="card-body">
                <h3>{c.name}</h3>
                <div className="cost">
                  {c.chakra.length ? c.chakra.map((k) => <ChakraPip key={k} type={k} />) : <span className="muted">{t('chars.randomOnly')}</span>}
                </div>
                <p className="muted clamp">{c.unlock.type === 'free' ? t('chars.starter') : c.unlock.detail}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
