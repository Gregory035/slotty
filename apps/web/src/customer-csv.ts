import type { ImportCustomerRow } from './api';

function splitCsv(text: string): string[][] {
  const delimiter = (text.split(/\r?\n/u, 1)[0]?.match(/;/gu)?.length ?? 0) >
    (text.split(/\r?\n/u, 1)[0]?.match(/,/gu)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error('В CSV не закрыты кавычки');
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function parseCustomerCsv(text: string): ImportCustomerRow[] {
  const data = splitCsv(text.replace(/^\uFEFF/u, ''));
  const header = data.shift()?.map((name) => name.trim().toLowerCase()) ?? [];
  const column = (...aliases: string[]) => header.findIndex((name) => aliases.includes(name));
  const nameColumn = column('имя', 'firstname', 'first_name');
  const fullNameColumn = column('фио', 'клиент', 'fullname', 'full_name', 'name');
  const lastNameColumn = column('фамилия', 'lastname', 'last_name');
  const phoneColumn = column('телефон', 'phone', 'номер телефона');
  const usernameColumn = column('telegram', 'username', 'телеграм');
  const notesColumn = column('заметка', 'notes', 'комментарий');
  if ((nameColumn < 0 && fullNameColumn < 0) || (phoneColumn < 0 && usernameColumn < 0)) {
    throw new Error('Нужны столбцы «Имя» или «ФИО» и «Телефон» или «Telegram»');
  }
  if (data.length > 500) throw new Error('Импортируйте не более 500 клиентов за раз');
  const get = (row: string[], index: number) => {
    if (index < 0) return '';
    const value = (row[index] ?? '').trim();
    return value.replace(/^'(?=[=+\-@])/u, '');
  };
  return data.map((row) => {
    const fullName = get(row, fullNameColumn).split(/\s+/u).filter(Boolean);
    const firstName = get(row, nameColumn) || fullName[0] || '';
    const lastName = get(row, lastNameColumn) || fullName.slice(1).join(' ');
    const phone = get(row, phoneColumn);
    return {
      firstName,
      ...(lastName ? { lastName } : {}),
      ...(phone ? { phone } : {}),
      ...(get(row, usernameColumn) ? { username: get(row, usernameColumn) } : {}),
      ...(get(row, notesColumn) ? { notes: get(row, notesColumn) } : {}),
    };
  });
}
