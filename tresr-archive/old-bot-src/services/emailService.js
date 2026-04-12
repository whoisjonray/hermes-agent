/**
 * Email Service using Resend + React Email
 * Full control over email marketing flows with polished templates
 *
 * Goal: 20-30% of revenue from email
 *
 * Flows:
 * - Welcome flow: 10% discount for signup
 * - Abandoned cart: 3-email sequence (1hr, 24hr, 48hr)
 * - Win-back: Re-engage after 30 days inactive
 * - Product launch: Notify subscribers of new products
 */

import { render } from '@react-email/components';
import { db } from './database.js';

// React Email Templates
import { WelcomeEmail } from '../emails/WelcomeEmail.jsx';
import AbandonedCartEmail, { AbandonedCartEmail1, AbandonedCartEmail2, AbandonedCartEmail3 } from '../emails/AbandonedCartEmail.jsx';
import { WinBackEmail } from '../emails/WinBackEmail.jsx';
import { ProductLaunchEmail } from '../emails/ProductLaunchEmail.jsx';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Per-client email configuration
const EMAIL_CLIENTS = {
  tresr: {
    fromEmail: process.env.TRESR_FROM_EMAIL || 'TRESR <hello@tresr.xyz>',
    storeUrl: process.env.TRESR_STORE_URL || 'tresr.xyz',
    brandName: 'TRESR',
    replyTo: 'support@tresr.xyz'
  },
  doorgrow: {
    fromEmail: process.env.DOORGROW_FROM_EMAIL || 'DoorGrow <hello@doorgrow.com>',
    storeUrl: process.env.DOORGROW_STORE_URL || 'doorgrow.com',
    brandName: 'DoorGrow',
    replyTo: 'support@doorgrow.com'
  },
  awaken: {
    fromEmail: process.env.AWAKEN_FROM_EMAIL || 'Awaken <hello@awakenentrepreneur.com>',
    storeUrl: process.env.AWAKEN_STORE_URL || 'awakenentrepreneur.com',
    brandName: 'Awaken Entrepreneur',
    replyTo: 'support@awakenentrepreneur.com'
  },
  peanutbrittle: {
    fromEmail: process.env.PEANUTBRITTLE_FROM_EMAIL || "Uncle Ray's <hello@uncleraysbrittle.com>",
    storeUrl: process.env.PEANUTBRITTLE_STORE_URL || 'uncleraysbrittle.com',
    brandName: "Uncle Ray's Peanut Brittle",
    replyTo: 'support@uncleraysbrittle.com'
  }
};

// Default/active client
let activeEmailClient = 'tresr';

// ============================================
// DATABASE INITIALIZATION FOR EMAIL SCHEDULING
// ============================================

/**
 * Initialize the scheduled_emails table
 */
export function initEmailSchedulerDb() {
  console.log('Initializing email scheduler database...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_emails (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      cart_data JSON NOT NULL,
      sequence_number INTEGER NOT NULL,
      scheduled_time INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      checkout_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP,
      error TEXT
    )
  `);

  // Index for efficient queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status_time
    ON scheduled_emails(status, scheduled_time)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_emails_checkout
    ON scheduled_emails(checkout_id)
  `);

  console.log('Email scheduler database initialized');
}

// ============================================
// SCHEDULED EMAIL OPERATIONS
// ============================================

/**
 * Schedule an email for later delivery
 */
function scheduleEmail(email, cartData, sequenceNumber, delayHours, checkoutId = null) {
  const id = `email-${Date.now()}-${sequenceNumber}-${Math.random().toString(36).substr(2, 9)}`;
  const scheduledTime = Date.now() + (delayHours * 60 * 60 * 1000);

  const stmt = db.prepare(`
    INSERT INTO scheduled_emails (id, email, cart_data, sequence_number, scheduled_time, checkout_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `);

  stmt.run(id, email, JSON.stringify(cartData), sequenceNumber, scheduledTime, checkoutId);

  console.log(`Scheduled email ${sequenceNumber} for ${email} at ${new Date(scheduledTime).toISOString()}`);

  return id;
}

/**
 * Get all pending emails that are due to be sent
 */
function getPendingEmails() {
  const now = Date.now();
  const stmt = db.prepare(`
    SELECT * FROM scheduled_emails
    WHERE status = 'pending' AND scheduled_time <= ?
    ORDER BY scheduled_time ASC
  `);

  return stmt.all(now);
}

/**
 * Mark an email as sent
 */
function markEmailSent(id) {
  const stmt = db.prepare(`
    UPDATE scheduled_emails
    SET status = 'sent', sent_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(id);
}

/**
 * Mark an email as failed with error
 */
function markEmailFailed(id, error) {
  const stmt = db.prepare(`
    UPDATE scheduled_emails
    SET status = 'failed', error = ?
    WHERE id = ?
  `);
  stmt.run(error, id);
}

/**
 * Cancel scheduled emails for a checkout (when customer completes purchase)
 */
export function cancelScheduledEmailsForCheckout(checkoutId) {
  const stmt = db.prepare(`
    UPDATE scheduled_emails
    SET status = 'cancelled'
    WHERE checkout_id = ? AND status = 'pending'
  `);

  const result = stmt.run(checkoutId);
  console.log(`Cancelled ${result.changes} scheduled emails for checkout ${checkoutId}`);

  return result.changes;
}

/**
 * Cancel scheduled emails by email address
 */
export function cancelScheduledEmailsForEmail(email) {
  const stmt = db.prepare(`
    UPDATE scheduled_emails
    SET status = 'cancelled'
    WHERE email = ? AND status = 'pending'
  `);

  const result = stmt.run(email);
  console.log(`Cancelled ${result.changes} scheduled emails for ${email}`);

  return result.changes;
}

/**
 * Cleanup old completed/cancelled emails (older than 30 days)
 */
export function cleanupOldScheduledEmails() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  const stmt = db.prepare(`
    DELETE FROM scheduled_emails
    WHERE status IN ('sent', 'cancelled', 'failed')
    AND scheduled_time < ?
  `);

  const result = stmt.run(thirtyDaysAgo);
  console.log(`Cleaned up ${result.changes} old scheduled emails`);

  return result.changes;
}

/**
 * Process all pending scheduled emails
 * This should be called periodically (e.g., every minute by cron)
 */
export async function processScheduledEmails() {
  const pendingEmails = getPendingEmails();

  if (pendingEmails.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  console.log(`Processing ${pendingEmails.length} scheduled emails...`);

  let sent = 0;
  let failed = 0;

  for (const scheduledEmail of pendingEmails) {
    try {
      const cartData = JSON.parse(scheduledEmail.cart_data);
      const { subject, html, text } = await buildAbandonedCartEmail(cartData, scheduledEmail.sequence_number);

      await sendEmail({
        to: scheduledEmail.email,
        subject,
        html,
        text
      });

      markEmailSent(scheduledEmail.id);
      sent++;
      console.log(`Sent scheduled email ${scheduledEmail.sequence_number} to ${scheduledEmail.email}`);

    } catch (error) {
      console.error(`Failed to send scheduled email ${scheduledEmail.id}:`, error.message);
      markEmailFailed(scheduledEmail.id, error.message);
      failed++;
    }
  }

  return { processed: pendingEmails.length, sent, failed };
}

/**
 * Get status of scheduled emails for an email address
 */
export function getScheduledEmailStatus(email) {
  const stmt = db.prepare(`
    SELECT id, sequence_number, scheduled_time, status, sent_at, error
    FROM scheduled_emails
    WHERE email = ?
    ORDER BY sequence_number ASC
  `);

  return stmt.all(email);
}

// ============================================
// CLIENT CONFIG
// ============================================

/**
 * Set the active email client
 */
export function setActiveEmailClient(clientKey) {
  if (!EMAIL_CLIENTS[clientKey]) {
    throw new Error(`Unknown email client: ${clientKey}. Available: ${Object.keys(EMAIL_CLIENTS).join(', ')}`);
  }
  activeEmailClient = clientKey;
  return EMAIL_CLIENTS[clientKey];
}

/**
 * Get email client config
 */
export function getEmailClientConfig(clientKey = activeEmailClient) {
  return EMAIL_CLIENTS[clientKey] || EMAIL_CLIENTS[activeEmailClient];
}

// Legacy compatibility
const FROM_EMAIL = EMAIL_CLIENTS.tresr.fromEmail;
const STORE_URL = EMAIL_CLIENTS.tresr.storeUrl;

/**
 * Send an email via Resend API
 * @param {Object} options - Email options
 * @param {string} options.clientKey - Optional client key for from address
 */
export async function sendEmail({ to, subject, html, text, clientKey, replyTo }) {
  const client = getEmailClientConfig(clientKey);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: client.fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      reply_to: replyTo || client.replyTo
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Send batch emails
 */
export async function sendBatchEmails(emails) {
  const response = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emails.map(email => ({
      from: FROM_EMAIL,
      ...email
    })))
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Resend batch error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Welcome email with 10% discount (React Email template)
 */
export async function buildWelcomeEmail(subscriberName, discountCode) {
  const html = await render(WelcomeEmail({
    customerName: subscriberName || 'friend',
    discountCode,
    storeUrl: `https://${STORE_URL}`,
  }));

  return {
    subject: `Welcome to TRESR! Here's 10% off your first order`,
    html,
    text: `Welcome to TRESR, ${subscriberName || 'friend'}!

You're now part of a community that gets it.

Here's 10% off your first order: ${discountCode}

Shop now: https://${STORE_URL}

We only email when we have something worth sharing. No spam, ever.`
  };
}

/**
 * Abandoned cart email sequence (React Email templates)
 */
export async function buildAbandonedCartEmail(cartData, sequenceNumber) {
  const { items, cartUrl, customerName } = cartData;

  const subjects = [
    `Forgot something? Your cart is waiting`,
    `Still thinking about it? Here's a nudge`,
    `Last chance! Your cart expires soon`
  ];

  const EmailComponents = [AbandonedCartEmail1, AbandonedCartEmail2, AbandonedCartEmail3];
  const EmailComponent = EmailComponents[sequenceNumber - 1] || EmailComponents[0];

  const html = await render(EmailComponent({
    customerName,
    items,
    cartUrl,
  }));

  return {
    subject: subjects[sequenceNumber - 1] || subjects[0],
    html,
    text: `Your cart is waiting! Complete your order: ${cartUrl}`
  };
}

/**
 * Win-back email for inactive customers (React Email template)
 */
export async function buildWinBackEmail(customerName, lastOrderDate, discountCode) {
  const html = await render(WinBackEmail({
    customerName: customerName || 'friend',
    lastOrderDate,
    discountCode,
    storeUrl: `https://${STORE_URL}/collections/new`,
  }));

  return {
    subject: `We miss you! Here's 15% off to welcome you back`,
    html,
    text: `Hey${customerName ? ` ${customerName}` : ''}, we miss you!

Here's 15% off to welcome you back: ${discountCode}

See what's new: https://${STORE_URL}/collections/new`
  };
}

/**
 * New product launch email (React Email template)
 */
export async function buildProductLaunchEmail(product, category) {
  const html = await render(ProductLaunchEmail({
    productTitle: product.title,
    productImage: product.imageUrl,
    productPrice: product.price,
    productUrl: product.url,
    category,
  }));

  return {
    subject: `New drop: ${product.title}`,
    html,
    text: `New drop: ${product.title}

$${product.price}

Shop now: ${product.url}

Limited stock. When it's gone, it's gone.`
  };
}

// ============================================
// FLOW HANDLERS
// ============================================

/**
 * Trigger welcome flow for new subscriber
 */
export async function triggerWelcomeFlow(email, name) {
  const discountCode = `WELCOME10-${Date.now().toString(36).toUpperCase()}`;

  const { subject, html, text } = await buildWelcomeEmail(name, discountCode);

  await sendEmail({
    to: email,
    subject,
    html,
    text
  });

  return { discountCode, sent: true };
}

/**
 * Trigger abandoned cart flow
 * Sends email 1 immediately, schedules emails 2 and 3
 * @param {string} email - Customer email
 * @param {Object} cartData - Cart data (items, cartUrl, customerName)
 * @param {string} checkoutId - Optional checkout ID to link emails (for cancellation)
 */
export async function triggerAbandonedCartFlow(email, cartData, checkoutId = null) {
  // Generate a checkout ID if not provided
  const effectiveCheckoutId = checkoutId || `checkout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Send first email immediately
  const { subject, html, text } = await buildAbandonedCartEmail(cartData, 1);

  await sendEmail({
    to: email,
    subject,
    html,
    text
  });

  console.log(`Sent abandoned cart email 1 to ${email}`);

  // Schedule email 2 at 24 hours
  const email2Id = scheduleEmail(email, cartData, 2, 24, effectiveCheckoutId);

  // Schedule email 3 at 48 hours
  const email3Id = scheduleEmail(email, cartData, 3, 48, effectiveCheckoutId);

  return {
    checkoutId: effectiveCheckoutId,
    scheduled: [
      { sequence: 1, status: 'sent', sentAt: new Date().toISOString() },
      { sequence: 2, status: 'scheduled', id: email2Id, scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
      { sequence: 3, status: 'scheduled', id: email3Id, scheduledFor: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() }
    ],
    sent: true
  };
}

/**
 * Trigger win-back flow for inactive customer
 */
export async function triggerWinBackFlow(email, name, lastOrderDate) {
  const discountCode = `MISSYOU15-${Date.now().toString(36).toUpperCase()}`;

  const { subject, html, text } = await buildWinBackEmail(name, lastOrderDate, discountCode);

  await sendEmail({
    to: email,
    subject,
    html,
    text
  });

  return { discountCode, sent: true };
}

/**
 * Notify subscribers of new product
 */
export async function notifyProductLaunch(subscribers, product, category) {
  const { subject, html, text } = await buildProductLaunchEmail(product, category);

  // Send in batches of 100
  const batchSize = 100;
  const batches = [];

  for (let i = 0; i < subscribers.length; i += batchSize) {
    const batch = subscribers.slice(i, i + batchSize);
    batches.push(
      sendBatchEmails(batch.map(sub => ({
        to: sub.email,
        subject,
        html,
        text
      })))
    );
  }

  await Promise.all(batches);

  return { sent: subscribers.length };
}

// ============================================
// WEBHOOK HANDLERS (for Shopify integration)
// ============================================

/**
 * Handle new customer signup (Shopify webhook)
 */
export async function handleNewCustomer(customerData) {
  const { email, first_name } = customerData;

  if (customerData.accepts_marketing) {
    await triggerWelcomeFlow(email, first_name);
  }
}

/**
 * Handle checkout abandonment (Shopify webhook)
 */
export async function handleCheckoutAbandoned(checkoutData) {
  const { email, line_items, abandoned_checkout_url, customer, id } = checkoutData;

  if (!email) return;

  const cartData = {
    customerName: customer?.first_name,
    items: line_items.map(item => ({
      title: item.title,
      price: item.price,
      image: item.image?.src
    })),
    cartUrl: abandoned_checkout_url
  };

  await triggerAbandonedCartFlow(email, cartData, id);
}

/**
 * Handle checkout completion (Shopify webhook)
 * Cancels any pending abandoned cart emails
 */
export async function handleCheckoutCompleted(checkoutData) {
  const { id, email } = checkoutData;

  // Cancel by checkout ID if available
  if (id) {
    cancelScheduledEmailsForCheckout(id);
  }

  // Also cancel by email as a fallback
  if (email) {
    cancelScheduledEmailsForEmail(email);
  }
}

export default {
  sendEmail,
  sendBatchEmails,
  triggerWelcomeFlow,
  triggerAbandonedCartFlow,
  triggerWinBackFlow,
  notifyProductLaunch,
  handleNewCustomer,
  handleCheckoutAbandoned,
  handleCheckoutCompleted,
  buildWelcomeEmail,
  buildAbandonedCartEmail,
  buildWinBackEmail,
  buildProductLaunchEmail,
  // Scheduler functions
  initEmailSchedulerDb,
  processScheduledEmails,
  cancelScheduledEmailsForCheckout,
  cancelScheduledEmailsForEmail,
  cleanupOldScheduledEmails,
  getScheduledEmailStatus
};
