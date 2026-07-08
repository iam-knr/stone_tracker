import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) return null;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

async function send({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    console.error('Email not configured (EMAIL_USER / EMAIL_APP_PASSWORD missing) — skipping send.');
    return;
  }
  const recipients = Array.isArray(to) ? [...new Set(to.filter(Boolean))] : to;
  if (!recipients || (Array.isArray(recipients) && recipients.length === 0)) return;
  try {
    await t.sendMail({
      from: `"Stone Tracker" <${process.env.EMAIL_USER}>`,
      to: recipients,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
}

function wrap(title, bodyHtml) {
  return `
    <div style="font-family:Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#202124;">
      <h2 style="color:#1a73e8;margin:0 0 16px;">${title}</h2>
      ${bodyHtml}
      <p style="color:#9aa0a6;font-size:12px;margin-top:32px;">Stone Tracker &middot; automated notification</p>
    </div>
  `;
}

export async function sendPasswordResetEmail(toEmail, resetUrl) {
  await send({
    to: toEmail,
    subject: 'Reset your Stone Tracker password',
    text: `We received a request to reset your Stone Tracker password.\n\nReset it here (link expires in 1 hour): ${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: wrap('Reset your password', `
      <p>We received a request to reset your Stone Tracker password.</p>
      <p style="margin:24px 0;">
        <a href="${resetUrl}" style="background:#1a73e8;color:#fff;text-decoration:none;padding:10px 20px;border-radius:24px;display:inline-block;">Reset Password</a>
      </p>
      <p style="color:#5f6368;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `),
  });
}

export async function sendTaskCreatedEmail(recipients, task, projectName) {
  const rows = `
    <tr><td style="padding:4px 0;color:#5f6368;">Project</td><td style="padding:4px 0;">${projectName || '—'}</td></tr>
    <tr><td style="padding:4px 0;color:#5f6368;">Owner</td><td style="padding:4px 0;">${task.taskOwner || '—'}</td></tr>
    <tr><td style="padding:4px 0;color:#5f6368;">Assignee</td><td style="padding:4px 0;">${task.assignee || '—'}</td></tr>
    <tr><td style="padding:4px 0;color:#5f6368;">Priority</td><td style="padding:4px 0;">${task.priority || '—'}</td></tr>
    <tr><td style="padding:4px 0;color:#5f6368;">Due</td><td style="padding:4px 0;">${task.dueDate || '—'}</td></tr>
  `;
  await send({
    to: recipients,
    subject: `New task created: ${task.taskName}`,
    text: `A new task "${task.taskName}" was created in ${projectName || 'a project'}. Owner: ${task.taskOwner}. Assignee: ${task.assignee}. Due: ${task.dueDate || 'no due date'}.`,
    html: wrap('New task created', `
      <p><strong>${task.taskName}</strong>${task.description ? ` — ${task.description}` : ''}</p>
      <table style="border-collapse:collapse;font-size:14px;">${rows}</table>
    `),
  });
}

export async function sendTaskStatusChangedEmail(recipients, task, projectName, oldStatus, newStatus) {
  await send({
    to: recipients,
    subject: `Task update: ${task.taskName} → ${newStatus}`,
    text: `"${task.taskName}" in ${projectName || 'a project'} moved from ${oldStatus} to ${newStatus}.`,
    html: wrap('Task status updated', `
      <p><strong>${task.taskName}</strong> in ${projectName || 'a project'}</p>
      <p style="font-size:15px;">${oldStatus} &rarr; <strong style="color:#1a73e8;">${newStatus}</strong></p>
      <p style="color:#5f6368;font-size:13px;">Owner: ${task.taskOwner || '—'} &middot; Assignee: ${task.assignee || '—'}</p>
    `),
  });
}

function taskListHtml(tasks, projectByName) {
  if (!tasks.length) return '<p style="color:#5f6368;font-size:13px;">None</p>';
  return `<ul style="padding-left:18px;margin:8px 0;">${tasks.map((t) => `
    <li style="margin-bottom:4px;font-size:13px;">
      <strong>${t.taskName}</strong> — ${projectByName[t.projectId] || 'Unknown project'}
      (${t.assignee || 'unassigned'}, due ${t.dueDate || 'n/a'})
    </li>`).join('')}</ul>`;
}

export async function sendDailyDigestEmail(recipients, { overdueTasks, upcomingTasks, projectByName }) {
  await send({
    to: recipients,
    subject: `Stone Tracker daily digest — ${overdueTasks.length} overdue, ${upcomingTasks.length} due soon`,
    text: `Overdue: ${overdueTasks.length}. Due within 7 days: ${upcomingTasks.length}.`,
    html: wrap('Daily task digest', `
      <p style="font-weight:500;color:#d93025;">Immediate attention required (overdue)</p>
      ${taskListHtml(overdueTasks, projectByName)}
      <p style="font-weight:500;color:#e37400;margin-top:16px;">Due within 7 days</p>
      ${taskListHtml(upcomingTasks, projectByName)}
    `),
  });
}

export async function sendMidnightSummaryEmail(recipients, { projects, tasks }) {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'Done').length;
  const overallProgress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const projectRows = projects.map((p) => {
    const projTasks = tasks.filter((t) => t.projectId === p.id);
    const projDone = projTasks.filter((t) => t.status === 'Done').length;
    const progress = projTasks.length ? Math.round((projDone / projTasks.length) * 100) : 0;
    return `<tr>
      <td style="padding:4px 8px;font-size:13px;">${p.name}</td>
      <td style="padding:4px 8px;font-size:13px;">${p.status}</td>
      <td style="padding:4px 8px;font-size:13px;">${projTasks.length}</td>
      <td style="padding:4px 8px;font-size:13px;">${progress}%</td>
    </tr>`;
  }).join('');
  await send({
    to: recipients,
    subject: `Stone Tracker nightly summary — ${projects.length} projects, ${overallProgress}% overall`,
    text: `Nightly summary: ${projects.length} projects, ${totalTasks} tasks, ${overallProgress}% overall progress.`,
    html: wrap('Nightly summary', `
      <p style="font-size:14px;">${projects.length} projects &middot; ${totalTasks} tasks &middot; <strong>${overallProgress}%</strong> overall progress</p>
      <table style="border-collapse:collapse;width:100%;margin-top:12px;">
        <thead><tr style="text-align:left;color:#5f6368;font-size:12px;"><th style="padding:4px 8px;">Project</th><th style="padding:4px 8px;">Status</th><th style="padding:4px 8px;">Tasks</th><th style="padding:4px 8px;">Progress</th></tr></thead>
        <tbody>${projectRows}</tbody>
      </table>
    `),
  });
}

// Sent to the Super Admin (ADMIN_NOTIFY_EMAIL) whenever a project or task is
// deleted. Deleted items are soft-deleted and recoverable for 30 days from
// Admin > Deleted Items, which this email links the admin toward.
export async function sendItemDeletedEmail(toEmail, { type, name, projectName, deletedBy }) {
  const label = type === 'project' ? 'Project' : 'Task';
  await send({
    to: toEmail,
    subject: `${label} deleted: ${name}`,
    text: `${label} "${name}"${projectName ? ` (in ${projectName})` : ''} was deleted by ${deletedBy || 'a user'}. It can be recovered from Admin > Deleted Items within 30 days, after which it is permanently removed.`,
    html: wrap(`${label} deleted`, `
      <p><strong>${name}</strong>${projectName ? ` — ${projectName}` : ''}</p>
      <p style="color:#5f6368;font-size:13px;">Deleted by ${deletedBy || 'a user'}.</p>
      <p style="font-size:13px;">This item is kept in <strong>Deleted Items</strong> for 30 days and can be restored by a Super Admin during that window. After 30 days it is permanently removed.</p>
    `),
  });
}

export default getTransporter;
