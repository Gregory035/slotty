export function userErrorMessage(message: string, status?: number, path = ''): string {
  if (status === 429) return 'Слишком много попыток. Подождите немного и повторите.';
  if (status && status >= 500) return 'Сервис временно недоступен. Попробуйте ещё раз немного позже.';
  if (/reset-password/.test(path) && [400, 404, 410].includes(status ?? 0)) return 'Ссылка недействительна или устарела. Запросите новую ссылку для восстановления пароля.';
  if (/invalid email or password/i.test(message)) return 'Неверный email или пароль.';
  if (/token .*|invalid.*token|expired.*token/i.test(message)) return 'Ссылка недействительна или устарела. Запросите новую ссылку.';
  if (status === 401) return 'Сессия завершилась. Войдите в аккаунт снова.';
  if (status === 403) return 'У вас нет доступа к этому действию. Обратитесь к владельцу компании.';
  if (/email must be an email/i.test(message)) return 'Укажите корректный email.';
  if (/email.*(already|exists)|already.*email/i.test(message)) return 'Аккаунт с этим email уже существует. Попробуйте войти.';
  if (/password must be longer than or equal to (\d+)/i.test(message)) return `Пароль должен содержать не менее ${message.match(/equal to (\d+)/i)?.[1]} символов.`;
  if (/password must be shorter than or equal to (\d+)/i.test(message)) return `Пароль должен содержать не более ${message.match(/equal to (\d+)/i)?.[1]} символов.`;
  if (/[а-яё]/i.test(message) && !/stack|prisma|sqlstate|exception|\.tsx?:\d/i.test(message)) return message;
  if (status === 404) return 'Данные не найдены или больше недоступны. Обновите страницу.';
  if (status === 400) return 'Проверьте заполненные поля и повторите попытку.';
  return 'Не удалось выполнить действие. Попробуйте ещё раз.';
}
