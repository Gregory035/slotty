import { useEffect, useState } from 'react';
import { hasAnalyticsConfiguration, initializeAnalytics, setAnalyticsConsent, trackPageView } from '../analytics';
import { initializeWebVitals } from '../web-vitals';

export function AnalyticsConsent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(hasAnalyticsConfiguration && localStorage.getItem('slotty-analytics-consent') === null), []);
  if (!visible) return null;

  function decide(value: 'granted' | 'denied') {
    setAnalyticsConsent(value);
    if (value === 'granted') {
      initializeAnalytics();
      trackPageView(window.location.pathname);
      initializeWebVitals();
    }
    setVisible(false);
  }

  return (
    <section className="analytics-consent" aria-label="Настройки аналитики">
      <div><strong>Аналитика посещений</strong><p>Помогает улучшать Slotty. Без данных клиентов и записей.</p></div>
      <div className="analytics-consent-actions"><button className="text-button" onClick={() => decide('denied')}>Только необходимое</button><button className="primary-button lime-button" onClick={() => decide('granted')}>Разрешить</button></div>
    </section>
  );
}
