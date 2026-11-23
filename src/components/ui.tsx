import { Link } from 'react-router-dom';
import { type Chakra, type Character, type ChangeType } from '../lib/data';
import { useI18n } from '../lib/i18n';

export function ChakraPip({ type }: { type: Chakra }) {
  const { t } = useI18n();
  const label = t(`chakra.${type}`);
  return <span className={`pip pip-${type}`} title={label} role="img" aria-label={label} />;
}

export function Cost({ cost }: { cost: Chakra[] }) {
  const { t } = useI18n();
  if (!cost.length) return <span className="muted">{t('chakra.free')}</span>;
  return (
    <span className="cost">
      {cost.map((c, i) => (
        <ChakraPip key={i} type={c} />
      ))}
    </span>
  );
}

export function Badge({ type }: { type: ChangeType }) {
  const { t } = useI18n();
  return <span className={`badge badge-${type}`}>{t(`type.${type}`)}</span>;
}

export function Portrait({ c, size = 56 }: { c: Character; size?: number }) {
  return <img className="portrait" src={c.portrait} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" />;
}

export function CharLink({ c, size = 40 }: { c: Character; size?: number }) {
  return (
    <Link to={`/characters/${encodeURIComponent(c.id)}`} className="charlink">
      <Portrait c={c} size={size} />
      <span>{c.name}</span>
    </Link>
  );
}

export function SectionHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="sechead">
      <div>
        <h2>{title}</h2>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
