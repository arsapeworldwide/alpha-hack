import type { FeedItem } from '../../api/types';
import { Modal } from '../../components/ui/Modal';

/** Полный текст материала ленты в модальном окне. */
export function FeedArticle({ item, onClose }: { item: FeedItem | null; onClose: () => void }) {
  return (
    <Modal open={item !== null} onClose={onClose} title={item?.title ?? ''}>
      {item && (
        <article>
          <p className="text-sm text-muted">{item.tag}, {item.read_minutes} мин чтения</p>
          <p className="mt-4 text-lg font-semibold leading-relaxed">{item.summary}</p>
          {item.body.split('\n\n').map((paragraph, i) => (
            <p key={i} className="mt-4 max-w-[65ch] text-[16px] leading-relaxed">{paragraph}</p>
          ))}
          <p className="mt-6 rounded-2xl bg-surface px-4 py-3 text-[13px] text-muted">Синтетический материал для демонстрации прототипа. Не является финансовой или юридической консультацией.</p>
        </article>
      )}
    </Modal>
  );
}
