import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { OnlineBookingPage } from './OnlineBookingPage';

describe('Online booking content', () => {
  it('renders a concrete scheduling example and setup answers without JavaScript', () => {
    const html = renderToStaticMarkup(<MemoryRouter><OnlineBookingPage /></MemoryRouter>);
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('Как Slotty определяет свободное время');
    expect(html).toContain('13:30');
    expect(html).toContain('14:30');
    expect(html).toContain('Что нужно добавить, чтобы появились свободные слоты?');
    expect(html).toContain('Можно ли записать клиента вручную?');
    for (const path of ['/dlya-mastera', '/dlya-salona', '/zapis-cherez-telegram', '/app?mode=register']) {
      expect(html).toContain(`href="${path}"`);
    }
  });
});
