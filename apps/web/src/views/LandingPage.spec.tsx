import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LandingPage } from './LandingPage';

describe('Landing page', () => {
  it('renders the value proposition, trial terms and pricing without JavaScript', () => {
    const html = renderToStaticMarkup(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(html).toContain('Онлайн-запись<br/>прямо в Telegram');
    expect(html).toContain('990 ₽');
    expect(html).toContain('2 490 ₽');
    expect(html).toContain('/ 30 дней');
    expect(html).toContain('до 3 специалистов, 10 услуг и 100 записей');
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html.match(/Начать бесплатно/g)).toHaveLength(2);
    expect(html).not.toContain('Создать рабочее пространство');
  });

  it('labels the demo and explains why confirmation is disabled initially', () => {
    const html = renderToStaticMarkup(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(html).toContain('не создавая настоящую запись');
    expect(html).toContain('class="demo-confirm" disabled=""');
    expect(html).toContain('role="status"');
    expect(html).toContain('Выберите свободное время, чтобы продолжить.');
  });
});
