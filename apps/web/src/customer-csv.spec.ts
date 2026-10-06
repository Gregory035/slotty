import { describe, expect, it } from 'vitest';
import { parseCustomerCsv } from './customer-csv';

describe('customer CSV import', () => {
  it('parses exported data with quoted commas and newlines', () => {
    const rows = parseCustomerCsv('\uFEFF"Имя","Фамилия","Телефон","Telegram","Заметка"\r\n"Анна","Соколова","\'+79990000000","anna","Строка 1\nСтрока 2, важное"');
    expect(rows).toEqual([{
      firstName: 'Анна',
      lastName: 'Соколова',
      phone: '+79990000000',
      username: 'anna',
      notes: 'Строка 1\nСтрока 2, важное',
    }]);
  });

  it('accepts semicolon-delimited full names', () => {
    expect(parseCustomerCsv('ФИО;Телефон\nИван Петров;+79991112233')).toEqual([{
      firstName: 'Иван', lastName: 'Петров', phone: '+79991112233',
    }]);
  });

  it('rejects missing identifying columns and malformed quotes', () => {
    expect(() => parseCustomerCsv('Имя,Заметка\nАнна,тест')).toThrow('Нужны столбцы');
    expect(() => parseCustomerCsv('Имя,Телефон\n"Анна,+7999')).toThrow('не закрыты');
  });
});
