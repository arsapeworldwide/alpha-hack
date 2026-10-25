import { describe, expect, it } from 'vitest';
import { AFTER_REJECTION, FEED_BY_SEGMENT } from './feedSeed';
import type { FeedSegment } from './types';

describe('материалы умной ленты', () => {
  it('в каждом сегменте 4–5 материалов с заполненными полями', () => {
    for (const segment of Object.keys(FEED_BY_SEGMENT) as FeedSegment[]) {
      const items = FEED_BY_SEGMENT[segment];
      expect(items.length).toBeGreaterThanOrEqual(4);
      expect(items.length).toBeLessThanOrEqual(5);
      for (const item of items) {
        expect(item.title.length).toBeGreaterThan(5);
        expect(item.body.split('\n\n').length).toBeGreaterThanOrEqual(2);
        expect(item.synthetic).toBe(true);
      }
    }
  });

  it('id материалов не повторяются', () => {
    const ids = [...Object.values(FEED_BY_SEGMENT).flat(), ...AFTER_REJECTION].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('после отказа есть советы про долговую нагрузку и кредитную историю', () => {
    const titles = AFTER_REJECTION.map((i) => i.title.toLowerCase()).join(' ');
    expect(titles).toContain('долговую нагрузку');
    expect(titles).toContain('кредитную историю');
  });
});
