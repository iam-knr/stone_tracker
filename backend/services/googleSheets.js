import dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config();

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

async function callScript(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function readSheet(tabName) {
  const data = await callScript({ action: 'read', tab: tabName });
  return data.rows || [];
}

export async function appendRow(tabName, rowObject, headers) {
  await callScript({ action: 'append', tab: tabName, row: rowObject, headers });
}

export async function updateRowById(tabName, idColumnIndex, id, updatedRow, headers) {
  await callScript({ action: 'update', tab: tabName, idColumnIndex, id, row: updatedRow, headers });
}

export async function deleteRowById(tabName, idColumnIndex, id) {
  await callScript({ action: 'delete', tab: tabName, idColumnIndex, id });
}

export async function createTab(tabName, headers) {
  await callScript({ action: 'createTab', tab: tabName, headers });
}

export async function listTabs() {
  const data = await callScript({ action: 'listTabs' });
  return data.tabs || [];
}
