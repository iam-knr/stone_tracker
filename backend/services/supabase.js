import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Maps the old "tab name" concept (from the Google Sheets version) onto
// Supabase/Postgres table names, so the rest of the codebase (routes/*)
// didn't need to change.
const TABLE_MAP = {
  Users: 'users',
  Projects: 'projects',
  Tasks: 'tasks',
  Invoices: 'invoices',
  InvoiceSettings: 'invoice_settings',
};

export async function readSheet(tabName) {
  const table = TABLE_MAP[tabName];
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function appendRow(tabName, rowObject) {
  const table = TABLE_MAP[tabName];
  const { error } = await supabase.from(table).insert([rowObject]);
  if (error) throw new Error(error.message);
}

export async function updateRowById(tabName, _idColumnIndex, id, updatedRow) {
  const table = TABLE_MAP[tabName];
  const { error } = await supabase.from(table).update(updatedRow).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteRowById(tabName, _idColumnIndex, id) {
  const table = TABLE_MAP[tabName];
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export default supabase;
