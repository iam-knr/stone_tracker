import jwt from 'jsonwebtoken';

export function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Invoicing is a separate, opt-in permission from the role system: the
// Super Admin can grant/revoke it per-user (see PUT /users/:id/invoice-access),
// independent of whether that person is a Task Owner or Task Assignee.
// Admin always has access regardless of the flag.
export function requireInvoiceAccess(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.canAccessInvoices === true) {
    return next();
  }
  return res.status(403).json({ error: 'You do not have access to Invoices. Ask your Super Admin to grant access.' });
}

// Customer Portal sessions are a completely separate track from internal
// users - the JWT is issued to a contactId after a magic-link verification
// (see routes/portal.js), never to an internal username. Kept as its own
// role check (rather than reusing requireInvoiceAccess/requireAdmin) so a
// portal session can never accidentally satisfy an internal-only route, and
// vice versa.
export function requirePortalClient(req, res, next) {
  if (req.user?.role !== 'portal_client' || !req.user?.contactId) {
    return res.status(403).json({ error: 'Portal access required.' });
  }
  next();
}
