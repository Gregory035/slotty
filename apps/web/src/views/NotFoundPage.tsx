import { Link } from 'react-router-dom';
import { MarketingLayout } from './MarketingLayout';

export function NotFoundPage() {
  return <MarketingLayout><section className="not-found"><p className="eyebrow">Ошибка 404</p><h1>Такой страницы нет</h1><p>Вернитесь на главную Slotty или откройте рабочее пространство.</p><div className="landing-actions"><Link className="primary-button lime-button" to="/">На главную</Link><Link className="secondary-button" to="/app">Войти</Link></div></section></MarketingLayout>;
}
