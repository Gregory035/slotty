import { useEffect, useState } from 'react';
import { hasAnalyticsConfiguration, initializeAnalytics, setAnalyticsConsent, trackPageView } from '../analytics';

export function AnalyticsConsent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(hasAnalyticsConfiguration && localStorage.getItem('slotty-analytics-consent') === null), []);
  if (!visible) return null;

  function decide(value: 'granted' | 'denied') {
    setAnalyticsConsent(value);
    if (value === 'granted') {
      initializeAnalytics();
      trackPageView(window.location.pathname);
    }
    setVisible(false);
  }

  return (
    <section className="analytics-consent" aria-label="Настройки аналитики">
      <div><strong>Помогите улучшить Slotty</strong><p>Используем обезличенную аналитику посещений. Данные записей и клиентов не отправляются.</p></div>
      <div className="analytics-consent-actions"><button className="text-button" onClick={() => decide('denied')}>Только необходимое</button><button className="primary-button lime-button" onClick={() => decide('granted')}>Разрешить</button></div>
    </section>
  );
}
