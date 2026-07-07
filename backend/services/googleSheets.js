import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function readSheet(tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A:Z`,
  });
  const [headers, ...rows] = res.data.values || [[]];
  return rows.map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] || '']))
  );
}

export async function appendRow(tabName, rowObject, headers) {
  const values = [headers.map((h) => rowObject[h] ?? '')];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function updateRowById(tabName, idColumnIndex, id, updatedRow, headers) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A:Z`,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[idColumnIndex] === id);
  if (rowIndex === -1) throw new Error('Row not found');
  const values = [headers.map((h) => updatedRow[h] ?? rows[rowIndex][headers.indexOf(h)])];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A${rowIndex + 1}:Z${rowIndex + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}
