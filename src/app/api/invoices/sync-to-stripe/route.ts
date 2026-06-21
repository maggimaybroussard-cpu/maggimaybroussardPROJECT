import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/auditLogger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

/**
 * POST /api/invoices/sync-to-stripe
 *
 * Syncs a client_invoice to the Stripe Invoice API.
 * - Finds or creates a Stripe Customer for the client email
 * - Creates a Stripe Invoice with line items matching the DB invoice
 * - Finalizes the invoice so Stripe generates a hosted payment URL
 * - Stores stripe_invoice_id, stripe_invoice_url, stripe_invoice_pdf back on the DB row
 *
 * Body: { invoiceId: string }
 * Returns: { stripeInvoiceId, hostedUrl, pdfUrl }
 */
export async function POST(req: NextRequest) {
  try {
    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // ── 1. Fetch the invoice from DB ──────────────────────────────────────────
    const { data: invoice, error: fetchErr } = await supabase
      .from('client_invoices')
      .select(`
        id, invoice_number, invoice_date, due_date, amount, amount_paid,
        currency, status, line_items, notes, inquiry_id,
        stripe_invoice_id, stripe_sync_status,
        contact_inquiries ( name, email, service )
      `)
      .eq('id', invoiceId)
      .maybeSingle();

    if (fetchErr || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // ── 2. Idempotency: if already synced, return existing Stripe data ────────
    if (invoice.stripe_invoice_id && invoice.stripe_sync_status === 'synced') {
      try {
        const existing = await stripe.invoices.retrieve(invoice.stripe_invoice_id);
        return NextResponse.json({
          stripeInvoiceId: existing.id,
          hostedUrl: existing.hosted_invoice_url,
          pdfUrl: existing.invoice_pdf,
          alreadySynced: true,
        });
      } catch {
        // Stripe invoice may have been deleted — fall through to re-create
      }
    }

    // Mark as syncing
    await supabase
      .from('client_invoices')
      .update({ stripe_sync_status: 'syncing' })
      .eq('id', invoiceId);

    const clientInfo = (invoice as any).contact_inquiries as { name: string; email: string; service: string } | null;
    const clientEmail = clientInfo?.email ?? '';
    const clientName = clientInfo?.name ?? 'Client';

    if (!clientEmail) {
      await supabase.from('client_invoices').update({ stripe_sync_status: 'failed' }).eq('id', invoiceId);
      return NextResponse.json({ error: 'Client email not found — cannot create Stripe invoice' }, { status: 422 });
    }

    // ── 3. Find or create Stripe Customer ────────────────────────────────────
    let customerId: string;

    const existingCustomers = await stripe.customers.list({ email: clientEmail, limit: 1 });
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      const newCustomer = await stripe.customers.create({
        email: clientEmail,
        name: clientName,
        metadata: { inquiry_id: invoice.inquiry_id ?? '', source: 'broussard_legal_admin' },
      });
      customerId = newCustomer.id;
    }

    // ── 4. Build due date as Unix timestamp ───────────────────────────────────
    const dueDateUnix = invoice.due_date
      ? Math.floor(new Date(invoice.due_date + 'T00:00:00').getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days default

    // ── 5. Create Stripe Invoice ──────────────────────────────────────────────
    const stripeInvoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      due_date: dueDateUnix,
      currency: (invoice.currency || 'usd').toLowerCase(),
      description: `Invoice ${invoice.invoice_number}${clientInfo?.service ? ` — ${clientInfo.service}` : ''}`,
      footer: invoice.notes ?? undefined,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        source: 'broussard_legal_admin',
      },
      auto_advance: false, // We'll finalize manually after adding items
    });

    // ── 6. Add line items to the Stripe Invoice ───────────────────────────────
    const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];

    if (lineItems.length === 0) {
      // Fallback: single line item for the total amount
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: stripeInvoice.id,
        description: `Invoice ${invoice.invoice_number}`,
        amount: Math.round(Number(invoice.amount) * 100),
        currency: (invoice.currency || 'usd').toLowerCase(),
      });
    } else {
      for (const item of lineItems) {
        await stripe.invoiceItems.create({
          customer: customerId,
          invoice: stripeInvoice.id,
          description: item.description || 'Legal Services',
          amount: Math.round(Number(item.total || item.unit_price * item.quantity) * 100),
          currency: (invoice.currency || 'usd').toLowerCase(),
          quantity: 1, // Amount already includes quantity
        });
      }
    }

    // ── 7. Finalize the invoice (generates hosted URL + PDF) ──────────────────
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(stripeInvoice.id, {
      auto_advance: false,
    });

    // ── 8. Send the invoice via Stripe (makes it visible in Stripe portal) ────
    await stripe.invoices.sendInvoice(finalizedInvoice.id);

    // ── 9. Store Stripe data back on the DB invoice ───────────────────────────
    const { error: updateErr } = await supabase
      .from('client_invoices')
      .update({
        stripe_invoice_id: finalizedInvoice.id,
        stripe_invoice_url: finalizedInvoice.hosted_invoice_url,
        stripe_invoice_pdf: finalizedInvoice.invoice_pdf,
        stripe_customer_id: customerId,
        stripe_sync_status: 'synced',
        stripe_synced_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    if (updateErr) {
      console.error('[sync-to-stripe] DB update failed:', updateErr);
    }

    // Audit log the sync
    const { data: { user } } = await supabase.auth.getUser();
    logAuditEvent({
      action_type: 'stripe_invoice_synced',
      actor_email: user?.email ?? 'admin',
      actor_id: user?.id,
      target_type: 'invoice',
      target_id: invoiceId,
      target_label: invoice.invoice_number,
      description: `Invoice ${invoice.invoice_number} synced to Stripe for ${clientName} (${clientEmail})`,
      metadata: {
        stripe_invoice_id: finalizedInvoice.id,
        amount: invoice.amount,
        client_email: clientEmail,
      },
    }).catch(() => {});

    console.log(`[sync-to-stripe] Invoice ${invoice.invoice_number} synced → Stripe ${finalizedInvoice.id}`);

    return NextResponse.json({
      stripeInvoiceId: finalizedInvoice.id,
      hostedUrl: finalizedInvoice.hosted_invoice_url,
      pdfUrl: finalizedInvoice.invoice_pdf,
      customerId,
    });
  } catch (err: unknown) {
    console.error('[sync-to-stripe] error:', err);

    // Mark as failed in DB if we have an invoiceId
    try {
      const body = await (req as any).json?.().catch(() => ({}));
      if (body?.invoiceId) {
        const supabase = await createClient();
        await supabase
          .from('client_invoices')
          .update({ stripe_sync_status: 'failed' })
          .eq('id', body.invoiceId);
      }
    } catch { /* ignore */ }

    const message = err instanceof Error ? err.message : 'Failed to sync invoice to Stripe';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
