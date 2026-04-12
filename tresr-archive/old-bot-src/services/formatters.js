/**
 * Message Formatters
 * Consistent HTML formatting for Telegram messages
 */

export function formatStatus(status) {
  const statusEmoji = status.running ? '🟢' : '🔴';
  const statusText = status.running ? 'Running' : 'Paused';

  return `
📊 <b>TRESR STATUS</b>

<b>System:</b> ${statusEmoji} ${statusText}
<b>Last Scan:</b> ${status.lastScan}

━━━━━━━━━━━━━━━━━━━━
<b>TODAY'S METRICS</b>

🎯 Trends Found: ${status.trendsToday}
📦 Products Created: ${status.productsToday}
🛒 Orders: ${status.ordersToday}
⏳ Pending Approvals: ${status.pendingApprovals}
`.trim();
}

export function formatTrendOpportunity(trend) {
  const scoreEmoji = trend.score >= 85 ? '🔥' : trend.score >= 70 ? '⭐' : '📌';

  let message = `
${scoreEmoji} <b>TREND OPPORTUNITY</b>

<b>Niche:</b> ${trend.niche}
<b>Concept:</b> ${trend.concept}
<b>Score:</b> ${trend.score}/100
`.trim();

  if (trend.sources && trend.sources.length > 0) {
    message += '\n\n<b>Sources:</b>\n';
    for (const source of trend.sources) {
      message += `• ${source.platform}: ${source.details}\n`;
    }
  }

  if (trend.suggestedDesigns && trend.suggestedDesigns.length > 0) {
    message += '\n<b>Design Ideas:</b>\n';
    trend.suggestedDesigns.forEach((design, i) => {
      message += `${i + 1}. ${design}\n`;
    });
  }

  if (trend.estimatedPotential) {
    message += `\n<b>Est. Potential:</b> $${trend.estimatedPotential}/month`;
  }

  return message;
}

export function formatDailyReport(report) {
  return `
📊 <b>DAILY REPORT - ${report.date}</b>

━━━━━━━━━━━━━━━━━━━━
<b>🎯 TREND DETECTION</b>
Opportunities Found: ${report.trends.scanned}
Converted to Products: ${report.trends.converted}

━━━━━━━━━━━━━━━━━━━━
<b>📦 PRODUCTS</b>
Created Today: ${report.products.created}

━━━━━━━━━━━━━━━━━━━━
<b>🛒 ORDERS</b>
Total Orders: ${report.orders.count}
Revenue: $${report.orders.revenue?.toFixed(2) || '0.00'}
Avg Order Value: $${report.orders.avgOrderValue?.toFixed(2) || '0.00'}

━━━━━━━━━━━━━━━━━━━━
<b>🚚 FULFILLMENT</b>
Artwork Files Sent: ${report.fulfillment.artworkSent}

━━━━━━━━━━━━━━━━━━━━
<b>📈 TOP PERFORMERS</b>
${report.orders.topProducts?.map((p, i) => `${i + 1}. ${p.title} (${p.quantity} sold)`).join('\n') || 'No sales data yet'}
`.trim();
}

export function formatOrderNotification(order) {
  const items = order.lineItems.map(li =>
    `• ${li.title} x${li.quantity}`
  ).join('\n');

  return `
🛒 <b>NEW ORDER #${order.orderNumber}</b>

<b>Customer:</b> ${order.customerName || order.customerEmail}
<b>Total:</b> $${order.total}

<b>Items:</b>
${items}

<b>Artwork Status:</b> ${order.artworkSent ? '✅ Sent' : '⏳ Pending'}
`.trim();
}

export function formatArtworkSent(result) {
  return `
✅ <b>ARTWORK SENT</b>

<b>Order:</b> #${result.orderNumber}
<b>Files:</b> ${result.filesSent}
<b>Destination:</b> ${result.destination}
<b>Sent at:</b> ${new Date().toLocaleString()}
`.trim();
}

export function formatError(error, context = '') {
  return `
🚨 <b>ERROR${context ? ` - ${context}` : ''}</b>

<code>${error.message}</code>

${error.stack ? `<pre>${error.stack.substring(0, 500)}</pre>` : ''}
`.trim();
}

export function formatProductCreated(product) {
  return `
✅ <b>PRODUCT CREATED</b>

<b>Title:</b> ${product.title}
<b>Niche:</b> ${product.niche}
<b>Price:</b> $${product.price}

<b>Shopify:</b> <a href="${product.url}">View Product</a>
<b>Artwork:</b> ${product.artworkUrl ? '✅ Uploaded' : '⏳ Pending'}
`.trim();
}

export default {
  formatStatus,
  formatTrendOpportunity,
  formatDailyReport,
  formatOrderNotification,
  formatArtworkSent,
  formatError,
  formatProductCreated
};
