'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { logAuditEvent, getAdminEmail } from '@/lib/auditLogger';
import { trackAdminTabVisit, trackAdminAction, trackWorkflowLeadCreated, trackWorkflowCaseCreated, trackWorkflowPaymentInitiated, trackWorkflowPaymentCollected } from '@/lib/analytics';
import NotificationCenter from '@/components/NotificationCenter';
import LexiNotificationBell from '@/components/LexiNotificationBell';

// ── Lazy-loaded admin tab components ─────────────────────────────────────────
const ClientsTab = dynamic(() => import('./components/ClientsTab'), { ssr: false });
const OperationsDashboard = dynamic(() => import('./components/OperationsDashboard'), { ssr: false });
const AdminAnalyticsDashboard = dynamic(() => import('./components/AdminAnalyticsDashboard'), { ssr: false });
const ProspectScoringDashboard = dynamic(() => import('./components/ProspectScoringDashboard'), { ssr: false });
const BillingHistoryDashboard = dynamic(() => import('./components/BillingHistoryDashboard'), { ssr: false });
const RetainerSubscriptionsDashboard = dynamic(() => import('./components/RetainerSubscriptionsDashboard'), { ssr: false });
const EmailTemplatesDashboard = dynamic(() => import('./components/EmailTemplatesDashboard'), { ssr: false });
const BillingTestDashboard = dynamic(() => import('./components/BillingTestDashboard'), { ssr: false });
const InvoiceGeneratorDashboard = dynamic(() => import('./components/InvoiceGeneratorDashboard'), { ssr: false });
const ReportingDashboard = dynamic(() => import('./components/ReportingDashboard'), { ssr: false });
const PracticeInsightsDashboard = dynamic(() => import('./components/PracticeInsightsDashboard'), { ssr: false });
const PracticeAnalyticsDashboard = dynamic(() => import('./components/PracticeAnalyticsDashboard'), { ssr: false });
const KanbanBoard = dynamic(() => import('./components/KanbanBoard'), { ssr: false });
const TasksDashboard = dynamic(() => import('./components/TasksDashboard'), { ssr: false });
const NotificationEmailComposer = dynamic(() => import('./components/NotificationEmailComposer'), { ssr: false });
const AdminMessagesDashboard = dynamic(() => import('./components/AdminMessagesDashboard'), { ssr: false });
const AdminSecurityDashboard = dynamic(() => import('./components/AdminSecurityDashboard'), { ssr: false });
const ContractTemplatesDashboard = dynamic(() => import('./components/ContractTemplatesDashboard'), { ssr: false });
const IntakeAnalyticsDashboard = dynamic(() => import('./components/IntakeAnalyticsDashboard'), { ssr: false });
const AdminOverviewDashboard = dynamic(() => import('./components/AdminOverviewDashboard'), { ssr: false });
const AdminInvoiceManagement = dynamic(() => import('./components/AdminInvoiceManagement'), { ssr: false });
const AuditTrailDashboard = dynamic(() => import('./components/AuditTrailDashboard'), { ssr: false });
const RoutingAdminPanel = dynamic(() => import('./components/RoutingAdminPanel'), { ssr: false });
const WeeklyDigestDashboard = dynamic(() => import('./components/WeeklyDigestDashboard'), { ssr: false });
const SchedulingDashboard = dynamic(() => import('./components/SchedulingDashboard'), { ssr: false });
const ParalegalAvailabilityCalendar = dynamic(() => import('./components/ParalegalAvailabilityCalendar'), { ssr: false });
const GrowthAnalyticsDashboard = dynamic(() => import('./components/GrowthAnalyticsDashboard'), { ssr: false });
const RetainerBalanceTracker = dynamic(() => import('./components/RetainerBalanceTracker'), { ssr: false });
const StrategicAnalyticsDashboard = dynamic(() => import('./components/StrategicAnalyticsDashboard'), { ssr: false });
const GA4ConversionDashboard = dynamic(() => import('./components/GA4ConversionDashboard'), { ssr: false });
const ParalegalRosterDashboard = dynamic(() => import('./components/ParalegalRosterDashboard'), { ssr: false });
const InvoiceTrackingDashboard = dynamic(() => import('./components/InvoiceTrackingDashboard'), { ssr: false });
const RetainerInvoiceScheduler = dynamic(() => import('./components/RetainerInvoiceScheduler'), { ssr: false });
const StripePaymentReconciliationDashboard = dynamic(() => import('./components/StripePaymentReconciliationDashboard'), { ssr: false });
const AdminBillingOpsHub = dynamic(() => import('./components/AdminBillingOpsHub'), { ssr: false });
const AdminOperationsHub = dynamic(() => import('./components/AdminOperationsHub'), { ssr: false });
const ContactInquiriesAdminDashboard = dynamic(() => import('./components/ContactInquiriesAdminDashboard'), { ssr: false });
const CaseManagementDashboard = dynamic(() => import('./components/CaseManagementDashboard'), { ssr: false });
const ClientInvoicesDashboard = dynamic(() => import('./components/ClientInvoicesDashboard'), { ssr: false });
const IntegrationSettingsHub = dynamic(() => import('./components/IntegrationSettingsHub'), { ssr: false });
const ClientDocumentTemplatesDashboard = dynamic(() => import('./components/ClientDocumentTemplatesDashboard'), { ssr: false });
const IntakeRoutingDashboard = dynamic(() => import('./components/IntakeRoutingDashboard'), { ssr: false });
const BillableHoursReportingDashboard = dynamic(() => import('./components/BillableHoursReportingDashboard'), { ssr: false });
const ConsultationsAdminBoard = dynamic(() => import('./components/ConsultationsAdminBoard'), { ssr: false });
const ConsultationFunnelAnalyticsDashboard = dynamic(() => import('./components/ConsultationFunnelAnalyticsDashboard'), { ssr: false });
const BookingAnalyticsDashboard = dynamic(() => import('./components/BookingAnalyticsDashboard'), { ssr: false });
const ConsultationLeadsBoard = dynamic(() => import('./components/ConsultationLeadsBoard'), { ssr: false });
const ScheduledConsultationsDashboard = dynamic(() => import('./components/ScheduledConsultationsDashboard'), { ssr: false });
const ConsultationAvailabilityManager = dynamic(() => import('./components/ConsultationAvailabilityManager'), { ssr: false });
const IntakeReminderScheduler = dynamic(() => import('./components/IntakeReminderScheduler'), { ssr: false });
const FinancialDashboard = dynamic(() => import('./components/FinancialDashboard'), { ssr: false });
const GoogleCalendarBookingPanel = dynamic(() => import('@/components/GoogleCalendarBookingPanel'), { ssr: false });
const CaseDeliverablesDashboard = dynamic(() => import('./components/CaseDeliverablesDashboard'), { ssr: false });
const CaseActionsTimeline = dynamic(() => import('./components/CaseActionsTimeline'), { ssr: false });
const PostCaseCloseFlowDashboard = dynamic(() => import('./components/PostCaseCloseFlowDashboard'), { ssr: false });
const CaseLifecycleEmailsDashboard = dynamic(() => import('./components/CaseLifecycleEmailsDashboard'), { ssr: false });
const TransactionalEmailCenter = dynamic(() => import('./components/TransactionalEmailCenter'), { ssr: false });
const RealtimeFeedDashboard = dynamic(() => import('./components/RealtimeFeedDashboard'), { ssr: false });
const IOLTATrustLedger = dynamic(() => import('./components/IOLTATrustLedger'), { ssr: false });
const LexiAdminTools = dynamic(() => import('./components/LexiAdminTools'), { ssr: false });
const MonthlyReportDashboard = dynamic(() => import('./components/MonthlyReportDashboard'), { ssr: false });
const ReferralClaimsDashboard = dynamic(() => import('./components/ReferralClaimsDashboard'), { ssr: false });
const LexiDocumentDraftsDashboard = dynamic(() => import('./components/LexiDocumentDraftsDashboard'), { ssr: false });
const LegalDocumentTemplatesDashboard = dynamic(() => import('./components/LegalDocumentTemplatesDashboard'), { ssr: false });
const ParalegalBillableHoursLogger = dynamic(() => import('./components/ParalegalBillableHoursLogger'), { ssr: false });
const EventNotificationConfigDashboard = dynamic(() => import('./components/EventNotificationConfigDashboard'), { ssr: false });
const ClientProfilesManager = dynamic(() => import('./components/ClientProfilesManager'), { ssr: false });
const AdminBillingTab = dynamic(() => import('./components/AdminBillingTab'), { ssr: false });
const MatterProfitabilityReport = dynamic(() => import('./components/MatterProfitabilityReport'), { ssr: false });
const MatterTimeLogger = dynamic(() => import('./components/MatterTimeLogger'), { ssr: false });
const CourtDeadlineCalendar = dynamic(() => import('./components/CourtDeadlineCalendar'), { ssr: false });
const StaffTimeTrackingDashboard = dynamic(() => import('./components/StaffTimeTrackingDashboard'), { ssr: false });
const OutboundWebhooksDashboard = dynamic(() => import('./components/OutboundWebhooksDashboard'), { ssr: false });
const NPSSurveyDashboard = dynamic(() => import('./components/NPSSurveyDashboard'), { ssr: false });
const RetainerAlertsDashboard = dynamic(() => import('./components/RetainerAlertsDashboard'), { ssr: false });
const SecureDocumentSharing = dynamic(() => import('./components/SecureDocumentSharing'), { ssr: false });
const IntakeTemplatesDashboard = dynamic(() => import('./components/IntakeTemplatesDashboard'), { ssr: false });
const AdminReportingExports = dynamic(() => import('./components/AdminReportingExports'), { ssr: false });
const BillableHoursAllocationDashboard = dynamic(() => import('./components/BillableHoursAllocationDashboard'), { ssr: false });
const PracticeKPIDashboard = dynamic(() => import('./components/PracticeKPIDashboard'), { ssr: false });
const SMSRemindersDashboard = dynamic(() => import('./components/SMSRemindersDashboard'), { ssr: false });
const EmailRemindersDashboard = dynamic(() => import('./components/EmailRemindersDashboard'), { ssr: false });
const LegalDocumentExtractor = dynamic(() => import('./components/LegalDocumentExtractor'), { ssr: false });
const MatterInvoiceBuilder = dynamic(() => import('./components/MatterInvoiceBuilder'), { ssr: false });
const CashPositionProjectionDashboard = dynamic(() => import('./components/CashPositionProjectionDashboard'), { ssr: false });
const PortalAdoptionDashboard = dynamic(() => import('./components/PortalAdoptionDashboard'), { ssr: false });
const SubmissionsInboxDashboard = dynamic(() => import('./components/SubmissionsInboxDashboard'), { ssr: false });
const ContractsRepositoryDashboard = dynamic(() => import('./components/ContractsRepositoryDashboard'), { ssr: false });
const AssistantConversationsDashboard = dynamic(() => import('./components/AssistantConversationsDashboard'), { ssr: false });
const LexiTaskAssistant = dynamic(() => import('./components/LexiTaskAssistant'), { ssr: false });
const ClientTaskPortal = dynamic(() => import('./components/ClientTaskPortal'), { ssr: false });
const AdminSummaryWidget = dynamic(() => import('./components/AdminSummaryWidget'), { ssr: false });
const ConsultationAdminScreen = dynamic(() => import('./components/ConsultationAdminScreen'), { ssr: false });
const CaseStudiesManager = dynamic(() => import('./components/CaseStudiesManager'), { ssr: false });
const LeadNurtureSequencesDashboard = dynamic(() => import('./components/LeadNurtureSequencesDashboard'), { ssr: false });
const CalendlyPipelineDashboard = dynamic(() => import('./components/CalendlyPipelineDashboard'), { ssr: false });
const ConversionFunnelDashboard = dynamic(() => import('./components/ConversionFunnelDashboard'), { ssr: false });
const AdminClientDashboardView = dynamic(() => import('./components/AdminClientDashboardView'), { ssr: false });
const RetainerDocAnalyzerDashboard = dynamic(() => import('./components/RetainerDocAnalyzerDashboard'), { ssr: false });
const ClientIntakeFormsDashboard = dynamic(() => import('./components/ClientIntakeFormsDashboard'), { ssr: false });
const EngagementLettersDashboard = dynamic(() => import('./components/EngagementLettersDashboard'), { ssr: false });
const GeminiCaseAnalyzerDashboard = dynamic(() => import('./components/GeminiCaseAnalyzerDashboard'), { ssr: false });
const EmailSMSTemplateManager = dynamic(() => import('./components/EmailSMSTemplateManager'), { ssr: false });
const ActiveCasesDashboard = dynamic(() => import('./components/ActiveCasesDashboard'), { ssr: false });
const RealtimeCaseNotificationsDashboard = dynamic(() => import('./components/RealtimeCaseNotificationsDashboard'), { ssr: false });
const DocumentESignatureManager = dynamic(() => import('./components/DocumentESignatureManager'), { ssr: false });
const RetainerInvoiceAutomationDashboard = dynamic(() => import('./components/RetainerInvoiceAutomationDashboard'), { ssr: false });
const CaseFlowManager = dynamic(() => import('./components/CaseFlowManager'), { ssr: false });
const RetainerRenewalNotificationsDashboard = dynamic(() => import('./components/RetainerRenewalNotificationsDashboard'), { ssr: false });
const ClientCommunicationHub = dynamic(() => import('./components/ClientCommunicationHub'), { ssr: false });
const NotionIntegrationDashboard = dynamic(() => import('./components/NotionIntegrationDashboard'), { ssr: false });
const TimeEntryModule = dynamic(() => import('./components/TimeEntryModule'), { ssr: false });
const CaseFileRepository = dynamic(() => import('./components/CaseFileRepository'), { ssr: false });
const CasePipelineTimeline = dynamic(() => import('./components/CasePipelineTimeline'), { ssr: false });
const AdminKPIDashboard = dynamic(() => import('./components/AdminKPIDashboard'), { ssr: false });
const CaseCalendar = dynamic(() => import('./components/CaseCalendar'), { ssr: false });
const AutomatedIntakeDashboard = dynamic(() => import('./components/AutomatedIntakeDashboard'), { ssr: false });
const ClientJourneyAutomationDashboard = dynamic(() => import('./components/ClientJourneyAutomationDashboard'), { ssr: false });
const EmailNurtureTemplateLibrary = dynamic(() => import('./components/EmailNurtureTemplateLibrary'), { ssr: false });
const DocumentManagementDashboard = dynamic(() => import('./components/DocumentManagementDashboard'), { ssr: false });
const PracticeManagementSuite = dynamic(() => import('./components/PracticeManagementSuite'), { ssr: false });
const AILegalSecretaryDashboard = dynamic(() => import('./components/AILegalSecretaryDashboard'), { ssr: false });
const TeamPermissionsDashboard = dynamic(() => import('./components/TeamPermissionsDashboard'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface Inquiry {
  id: string;
  name: string;
  firm: string;
  email: string;
  service: string;
  message: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface EmailSequence {
  id: string;
  inquiry_id: string;
  sequence_type: string;
  step_number: number;
  scheduled_at: string;
  sent_at: string | null;
  send_status: 'pending' | 'sent' | 'failed' | 'skipped';
  resend_email_id: string | null;
  error_message: string | null;
  created_at: string;
  contact_inquiries: {
    name: string;
    email: string;
    firm: string;
    service: string;
  } | null;
}

interface Booking {
  id: string;
  name: string;
  email: string;
  event_type?: string;
  start_time: string;
  end_time?: string;
  status: string;
  invitee_uri?: string;
  created_at: string;
  canceled_at?: string | null;
  cancel_reason?: string | null;
}

interface CaseDocumentAdmin {
  id: string;
  inquiry_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  category: string | null;
  description: string | null;
  created_at: string;
  contact_inquiries?: {
    name: string;
    email: string;
    firm: string;
    service: string;
  } | null;
}

interface CaseInquiryOption {
  id: string;
  name: string;
  firm: string;
  email: string;
  service: string;
}

interface Payment {
  id: string;
  payment_intent_id: string;
  stripe_customer_id?: string;
  stripe_charge_id?: string;
  amount: number;
  currency: string;
  payment_status: string;
  payment_type: string;
  description?: string;
  customer_name: string;
  customer_email: string;
  created_at: string;
  updated_at: string;
}

interface GA4Summary {
  totalUsers: number;
  newUsers: number;
  sessions: number;
  avgSessionDuration: number;
  bounceRate: number;
  pageViews: number;
}

interface TrafficSource {
  source: string;
  sessions: number;
  percentage: number;
}

interface FunnelStep {
  step: string;
  users: number;
  dropOff: number;
}

interface ServiceInterest {
  service: string;
  views: number;
  inquiries: number;
  conversionRate: number;
}

interface TopPage {
  page: string;
  title: string;
  pageViews: number;
  avgTimeOnPage: number;
  bounceRate: number;
}

interface DailyUser {
  date: string;
  users: number;
  sessions: number;
}

interface GA4Data {
  demo: boolean;
  summary: GA4Summary;
  trafficSources: TrafficSource[];
  conversionFunnel: FunnelStep[];
  serviceInterest: ServiceInterest[];
  topPages: TopPage[];
  dailyUsers: DailyUser[];
}

interface ProspectEmailItem {
  sequenceId: string;
  resendEmailId: string | null;
  inquiryId: string;
  prospectName: string;
  prospectEmail: string;
  firm: string;
  service: string;
  sequenceType: string;
  stepNumber: number;
  stepLabel: string;
  scheduledAt: string;
  sentAt: string | null;
  sendStatus: 'pending' | 'sent' | 'failed' | 'skipped';
  subject: string | null;
  lastEvent: string | null;
  createdAt: string | null;
  displayStatus: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed' | 'skipped';
}

interface ProspectEmailStats {
  total: number;
  queued: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  skipped: number;
  resendConnected: boolean;
}

// ─── Consultation Types ───────────────────────────────────────────────────────

interface Consultation {
  id: string;
  name: string;
  firm: string;
  email: string;
  service: string;
  status: string;
  notes: string | null;
  booking_stage: string;
  calendly_event_uuid: string | null;
  calendly_invitee_uuid: string | null;
  calendly_start_time: string | null;
  calendly_end_time: string | null;
  calendly_event_name: string | null;
  calendly_meeting_location: string | null;
  created_at: string;
  updated_at: string;
}

interface ConsultationStats {
  total: number;
  upcoming: number;
  past: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['new', 'in_review', 'contacted', 'closed'];

const BOOKING_STAGE_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  consultation_booked: 'Consultation Booked',
  proposal_sent: 'Proposal Sent',
  active_client: 'Active Client',
  completed: 'Completed',
  closed: 'Closed',
};

const BOOKING_STAGE_COLORS: Record<string, string> = {
  inquiry: 'bg-blue-100 text-blue-700 border-blue-200',
  consultation_booked: 'bg-purple-100 text-purple-700 border-purple-200',
  proposal_sent: 'bg-amber-100 text-amber-700 border-amber-200',
  active_client: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  contacted: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  in_review: 'In Review',
  contacted: 'Contacted',
  closed: 'Closed',
};

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'text/plain': 'TXT',
};
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const CHART_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba', '#d1f0d9'];
const ACCENT = '#355E3B';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function notifyClient(
  clientEmail: string,
  clientName: string,
  eventType: 'status_change' | 'booking_stage_change' | 'case_note' | 'document_upload',
  details: Record<string, string>
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    await fetch(`${supabaseUrl}/functions/v1/notify-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientEmail, clientName, eventType, details }),
    });
  } catch {
    // Non-blocking
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

function formatNumber(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function formatCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

function exportToCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── GA4 Sub-components ───────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
      <p className="text-3xl font-semibold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function TrafficSourcesChart({ data }: { data: TrafficSource[] }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="font-serif text-lg text-foreground mb-1">Traffic Sources</h3>
      <p className="text-xs text-muted-foreground mb-5">Sessions by acquisition channel — last 30 days</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="sessions"
              nameKey="source"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={50}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [value.toLocaleString(), 'Sessions']}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-2.5">
          {data.map((item, i) => (
            <div key={item.source} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="text-sm text-foreground truncate">{item.source}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-sm font-medium text-foreground">{item.sessions.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground w-10 text-right">{item.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConversionFunnel({ data }: { data: FunnelStep[] }) {
  const maxUsers = data[0]?.users || 1;
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="font-serif text-lg text-foreground mb-1">Booking Conversion Funnel</h3>
      <p className="text-xs text-muted-foreground mb-5">User journey from site visit to confirmed booking — last 30 days</p>
      <div className="flex flex-col gap-3">
        {data.map((step, i) => {
          const width = Math.round((step.users / maxUsers) * 100);
          return (
            <div key={step.step}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-sm text-foreground font-medium">{step.step}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{step.users.toLocaleString()}</span>
                  {step.dropOff > 0 && (
                    <span className="text-xs text-red-500 font-medium">−{step.dropOff}%</span>
                  )}
                </div>
              </div>
              <div className="h-8 bg-secondary/40 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all duration-700 flex items-center pl-3"
                  style={{ width: `${width}%`, background: `${ACCENT}${Math.round(255 * (0.4 + 0.6 * (width / 100))).toString(16).padStart(2, '0')}` }}
                >
                  {width > 20 && (
                    <span className="text-xs text-white font-medium">{width}%</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Overall conversion rate</span>
        <span className="text-sm font-semibold text-foreground">
          {data.length > 1 ? `${((data[data.length - 1].users / data[0].users) * 100).toFixed(1)}%` : '—'}
        </span>
      </div>
    </div>
  );
}

function ServiceInterestChart({ data }: { data: ServiceInterest[] }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="font-serif text-lg text-foreground mb-1">Service Interest Breakdown</h3>
      <p className="text-xs text-muted-foreground mb-5">Page views and inquiries per service — last 30 days</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="service"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={48}
          />
          <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
          <Bar dataKey="views" name="Page Views" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
          <Bar dataKey="inquiries" name="Inquiries" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {data.slice(0, 3).map((s) => (
          <div key={s.service} className="bg-secondary/30 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground truncate">{s.service}</p>
            <p className="text-lg font-semibold text-foreground mt-0.5">{s.conversionRate}%</p>
            <p className="text-xs text-muted-foreground">conv. rate</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopPagesTable({ data }: { data: TopPage[] }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-6 pt-6 pb-4">
        <h3 className="font-serif text-lg text-foreground mb-1">Top Performing Pages</h3>
        <p className="text-xs text-muted-foreground">Ranked by page views — last 30 days</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Page</th>
              <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Views</th>
              <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Avg. Time</th>
              <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Bounce Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((page, i) => (
              <tr key={page.page} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                <td className="px-6 py-3.5">
                  <p className="font-medium text-foreground">{page.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{page.page}</p>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <span className="font-semibold text-foreground">{page.pageViews.toLocaleString()}</span>
                </td>
                <td className="px-6 py-3.5 text-right hidden sm:table-cell text-muted-foreground">
                  {formatDuration(page.avgTimeOnPage)}
                </td>
                <td className="px-6 py-3.5 text-right hidden md:table-cell">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    page.bounceRate < 0.3 ? 'bg-green-100 text-green-700' :
                    page.bounceRate < 0.5 ? 'bg-amber-100 text-amber-700': 'bg-red-100 text-red-700'
                  }`}>
                    {Math.round(page.bounceRate * 100)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DailyTrendChart({ data }: { data: DailyUser[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="font-serif text-lg text-foreground mb-1">Daily Users & Sessions</h3>
      <p className="text-xs text-muted-foreground mb-5">30-day trend</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={formatted} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            interval={6}
          />
          <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
          <Line type="monotone" dataKey="users" name="Users" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="sessions" name="Sessions" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AnalyticsDashboard() {
  const [data, setData] = useState<GA4Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ga4');
      if (!res.ok) throw new Error('Failed to fetch analytics data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 py-4">
        {/* Skeleton summary stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5">
              <div className="w-16 h-3 bg-muted/40 rounded animate-pulse mb-3" />
              <div className="w-12 h-7 bg-muted/60 rounded animate-pulse mb-1" />
              <div className="w-20 h-3 bg-muted/40 rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Skeleton chart */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="w-40 h-5 bg-muted/60 rounded animate-pulse mb-2" />
          <div className="w-28 h-3 bg-muted/40 rounded animate-pulse mb-5" />
          <div className="w-full h-48 bg-muted/30 rounded-xl animate-pulse" />
        </div>
        {/* Skeleton two-column charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6">
              <div className="w-36 h-5 bg-muted/60 rounded animate-pulse mb-2" />
              <div className="w-24 h-3 bg-muted/40 rounded animate-pulse mb-5" />
              <div className="w-full h-40 bg-muted/30 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
        {/* Skeleton table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div className="w-40 h-5 bg-muted/60 rounded animate-pulse mb-2" />
            <div className="w-28 h-3 bg-muted/40 rounded animate-pulse" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border-t border-border px-6 py-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="w-32 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                <div className="w-20 h-3 bg-muted/40 rounded animate-pulse" />
              </div>
              <div className="w-12 h-4 bg-muted/50 rounded animate-pulse" />
              <div className="w-16 h-4 bg-muted/40 rounded animate-pulse hidden sm:block" />
              <div className="w-10 h-6 bg-muted/50 rounded-full animate-pulse hidden md:block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
        {error ?? 'No data available'}
      </div>
    );
  }

  const { summary, trafficSources, conversionFunnel, serviceInterest, topPages, dailyUsers } = data;

  return (
    <div className="space-y-6">
      {/* Demo Banner */}
      {data.demo && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 flex-shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Demo Data</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Add <code className="bg-amber-100 px-1 rounded">GA4_PROPERTY_ID</code> and <code className="bg-amber-100 px-1 rounded">GA4_SERVICE_ACCOUNT_KEY</code> to your environment variables to connect live GA4 data.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <SummaryCard label="Total Users" value={formatNumber(summary.totalUsers)} sub="Last 30 days" />
        <SummaryCard label="New Users" value={formatNumber(summary.newUsers)} sub={`${Math.round((summary.newUsers / summary.totalUsers) * 100)}% of total`} />
        <SummaryCard label="Sessions" value={formatNumber(summary.sessions)} />
        <SummaryCard label="Avg. Duration" value={formatDuration(summary.avgSessionDuration)} />
        <SummaryCard label="Bounce Rate" value={`${Math.round(summary.bounceRate * 100)}%`} />
        <SummaryCard label="Page Views" value={formatNumber(summary.pageViews)} />
      </div>

      {/* Daily Trend */}
      <DailyTrendChart data={dailyUsers} />

      {/* Traffic + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrafficSourcesChart data={trafficSources} />
        <ConversionFunnel data={conversionFunnel} />
      </div>

      {/* Service Interest */}
      <ServiceInterestChart data={serviceInterest} />

      {/* Top Pages */}
      <TopPagesTable data={topPages} />

      {/* Refresh */}
      <div className="flex justify-end">
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm text-foreground hover:border-accent/50 transition-all"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          Refresh Data
        </button>
      </div>
    </div>
  );
}

// ─── Email Sequences Dashboard ────────────────────────────────────────────────

const SEQUENCE_LABELS: Record<string, string> = {
  booking_reminder: 'Booking Reminder',lead_nurture: 'Lead Nurture',consultation_followup: 'Consultation Follow-up',reengagement: 'Re-engagement',post_booking_kickoff: 'Post-Booking Kickoff',welcome: 'Welcome',post_service_followup: 'Post-Service Follow-up',payment_reminder: 'Payment Reminder',
};

const SEQUENCE_STEP_LABELS: Record<string, Record<number, string>> = {
  booking_reminder: { 1: 'Day 1 — First Follow-up', 2: 'Day 3 — Second Follow-up' },
  lead_nurture: { 1: 'Day 7 — Value-Add / Case Studies' },
  reengagement: { 1: 'Day 14 — Final Check-in' },
  post_booking_kickoff: { 1: 'Immediate — Document Checklist', 2: 'Day 1 — Retainer Confirmation', 3: 'Day 3 — Next-Step Reminders' },
  post_service_followup: { 1: 'Day 3 — Satisfaction Check-in', 2: 'Day 14 — Testimonial & Referral Ask' },
  welcome: { 1: 'Immediate — Welcome Email' },
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-700 border-blue-200',sent: 'bg-green-100 text-green-700 border-green-200',failed: 'bg-red-100 text-red-700 border-red-200',skipped: 'bg-gray-100 text-gray-500 border-gray-200',
};

function SequencesDashboard() {
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const fetchSequences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter !== 'all'
        ? `/api/admin/sequences?status=${statusFilter}&limit=100`
        : '/api/admin/sequences?limit=100';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch sequences');
      const json = await res.json();
      setSequences(json.sequences || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sequences');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleAction = async (action: string, sequenceId: string, inquiryId?: string) => {
    setActionLoading(sequenceId);
    try {
      const res = await fetch('/api/admin/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sequenceId, inquiryId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Action failed');
      setToast({ msg: action === 'send_now' ? 'Email sent successfully.' : 'Sequence updated.', type: 'success' });
      await fetchSequences();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'Action failed', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const counts = {
    all: sequences.length,
    pending: sequences.filter((s) => s.send_status === 'pending').length,
    sent: sequences.filter((s) => s.send_status === 'sent').length,
    failed: sequences.filter((s) => s.send_status === 'failed').length,
    skipped: sequences.filter((s) => s.send_status === 'skipped').length,
  };

  const filtered = statusFilter === 'all' ? sequences : sequences.filter((s) => s.send_status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 max-w-sm px-5 py-4 rounded-2xl shadow-xl border backdrop-blur-sm flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-card border-accent/30 text-foreground' : 'bg-card border-red-400/30 text-foreground'
        }`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            toast.type === 'success' ? 'bg-accent/15 text-accent' : 'bg-red-400/15 text-red-400'
          }`}>
            {toast.type === 'success' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            )}
          </div>
          <p className="text-sm">{toast.msg}</p>
        </div>
      )}

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary flex-shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <p className="text-sm font-semibold text-foreground">Automated Nurture Sequences</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each new inquiry automatically schedules 4 emails: Day 1 booking reminder, Day 3 follow-up, Day 7 lead nurture with case studies, and Day 14 re-engagement. Use "Send Now" to trigger immediately or "Cancel" to skip a step.
          </p>
        </div>
      </div>

      {/* Payment Reminders Panel */}
      <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <div className="flex items-start gap-3 flex-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 flex-shrink-0 mt-0.5">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-900">Payment Reminder Automation</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Automatically emails clients: 3-day advance notice for upcoming invoices, overdue alerts for past-due invoices, and 7-day retainer deadline reminders. Runs daily via cron or trigger manually below.
            </p>
          </div>
        </div>
        <button
          onClick={async () => {
            setActionLoading('payment_reminders');
            try {
              const { data: { session } } = await createClient().auth.getSession();
              const res = await fetch('/api/admin/payment-reminders', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session?.access_token ?? ''}`,
                },
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error || 'Failed');
              setToast({ msg: `Reminders sent: ${json.sent ?? 0} sent, ${json.skipped ?? 0} skipped, ${json.failed ?? 0} failed.`, type: 'success' });
              await fetchSequences();
            } catch (err) {
              setToast({ msg: err instanceof Error ? err.message : 'Failed to run reminders', type: 'error' });
            } finally {
              setActionLoading(null);
            }
          }}
          disabled={actionLoading === 'payment_reminders'}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-60 transition-colors"
        >
          {actionLoading === 'payment_reminders' ? (
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          )}
          Run Now
        </button>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'sent', 'failed', 'skipped'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border transition-all ${
              statusFilter === s
                ? 'bg-primary text-white border-primary' :'bg-card text-muted-foreground border-border hover:border-primary/40'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s] ?? 0})
          </button>
        ))}
        <button
          onClick={fetchSequences}
          className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold border border-border bg-card text-muted-foreground hover:border-accent/50 transition-all flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="border-b border-border bg-secondary/40 px-5 py-3 flex gap-6">
            <div className="w-24 h-3 bg-muted/50 rounded animate-pulse" />
            <div className="w-20 h-3 bg-muted/50 rounded animate-pulse hidden sm:block" />
            <div className="w-16 h-3 bg-muted/50 rounded animate-pulse hidden md:block" />
            <div className="w-16 h-3 bg-muted/50 rounded animate-pulse" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="w-32 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                <div className="w-20 h-3 bg-muted/40 rounded animate-pulse" />
              </div>
              <div className="w-20 h-3 bg-muted/40 rounded animate-pulse hidden sm:block" />
              <div className="w-24 h-3 bg-muted/40 rounded animate-pulse hidden md:block" />
              <div className="w-16 h-6 bg-muted/50 rounded-full animate-pulse" />
              <div className="w-16 h-7 bg-muted/40 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <p className="text-muted-foreground text-sm">No email sequences found. They are created automatically when a contact form is submitted.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Lead</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Sequence</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Scheduled</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                  <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((seq, i) => {
                  const inq = seq.contact_inquiries;
                  const stepLabel = SEQUENCE_STEP_LABELS[seq.sequence_type]?.[seq.step_number] ?? `Step ${seq.step_number}`;
                  const scheduledDate = new Date(seq.scheduled_at);
                  const isPast = scheduledDate < new Date();
                  return (
                    <tr key={seq.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-foreground">{inq?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{inq?.email ?? '—'}</p>
                        {inq?.service && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">{inq.service}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <p className="text-xs font-semibold text-foreground">{SEQUENCE_LABELS[seq.sequence_type] ?? seq.sequence_type}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{stepLabel}</p>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <p className={`text-xs font-medium ${isPast && seq.send_status === 'pending' ? 'text-amber-600' : 'text-foreground'}`}>
                          {scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                        {seq.sent_at && (
                          <p className="text-xs text-green-600 mt-0.5">
                            Sent {new Date(seq.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_BADGE[seq.send_status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {seq.send_status.charAt(0).toUpperCase() + seq.send_status.slice(1)}
                        </span>
                        {seq.error_message && (
                          <p className="text-xs text-red-500 mt-1 max-w-[160px] truncate" title={seq.error_message}>{seq.error_message}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {seq.send_status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleAction('send_now', seq.id)}
                                disabled={actionLoading === seq.id}
                                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {actionLoading === seq.id ? (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                ) : (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                )}
                                Send Now
                              </button>
                              <button
                                onClick={() => handleAction('cancel', seq.id)}
                                disabled={actionLoading === seq.id}
                                className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground hover:border-red-300 hover:text-red-600 transition-all disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {seq.send_status === 'failed' && (
                            <button
                              onClick={() => handleAction('send_now', seq.id)}
                              disabled={actionLoading === seq.id}
                              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-all disabled:opacity-50"
                            >
                              Retry
                            </button>
                          )}
                          {(seq.send_status === 'sent' || seq.send_status === 'skipped') && (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Payment Reminders Dashboard ─────────────────────────────────────────────

interface ClientInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  notes: string | null;
  inquiry_id: string | null;
  created_at: string;
  updated_at: string;
  contact_inquiries: {
    name: string;
    email: string;
    firm: string;
    service: string;
  } | null;
}

interface ReminderSequence {
  id: string;
  inquiry_id: string | null;
  sequence_type: string;
  step_number: number;
  scheduled_at: string;
  sent_at: string | null;
  send_status: 'pending' | 'sent' | 'failed' | 'skipped';
  resend_email_id: string | null;
  error_message: string | null;
  created_at: string;
  contact_inquiries: {
    name: string;
    email: string;
    firm: string;
    service: string;
  } | null;
}

interface ReminderSummary {
  total: number;
  pending: number;
  overdue: number;
  paid: number;
  cancelled: number;
  totalOutstanding: number;
  remindersSent: number;
  remindersPending: number;
  remindersFailed: number;
}

const INVOICE_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const REMINDER_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-700 border-blue-200',
  sent: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  skipped: 'bg-gray-100 text-gray-500 border-gray-200',
};

function PaymentRemindersDashboard() {
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [sequences, setSequences] = useState<ReminderSequence[]>([]);
  const [summary, setSummary] = useState<ReminderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'invoices' | 'reminders'>('invoices');
  const [invoiceFilter, setInvoiceFilter] = useState<string>('all');
  const [reminderFilter, setReminderFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('09:00');
  const [runningAll, setRunningAll] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/payment-reminders');
      if (!res.ok) throw new Error('Failed to fetch payment reminders data');
      const json = await res.json();
      setInvoices(json.invoices || []);
      setSequences(json.sequences || []);
      setSummary(json.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  const handleRunAll = async () => {
    setRunningAll(true);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const res = await fetch('/api/admin/payment-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ action: 'run_all' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to run reminders');
      const sent = json.sent ?? json.results?.filter((r: any) => r.status === 'sent').length ?? 0;
      const failed = json.failed ?? json.results?.filter((r: any) => r.status === 'failed').length ?? 0;
      showToast(`Reminders processed: ${sent} sent, ${failed} failed.`, 'success');
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to run reminders', 'error');
    } finally {
      setRunningAll(false);
    }
  };

  const handleResend = async (sequenceId: string) => {
    setActionLoading(sequenceId);
    try {
      const res = await fetch('/api/admin/payment-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend', sequenceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to resend');
      showToast('Reminder email resent successfully.', 'success');
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Resend failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelReminder = async (sequenceId: string) => {
    setActionLoading(sequenceId);
    try {
      const res = await fetch('/api/admin/payment-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_reminder', sequenceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to cancel');
      showToast('Reminder cancelled.', 'success');
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cancel failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReschedule = async (sequenceId: string) => {
    if (!rescheduleDate) { showToast('Please select a date.', 'error'); return; }
    const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
    setActionLoading(sequenceId);
    try {
      const res = await fetch('/api/admin/payment-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', sequenceId, scheduledAt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to reschedule');
      showToast('Reminder rescheduled.', 'success');
      setRescheduleId(null);
      setRescheduleDate('');
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reschedule failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleInvoiceStatus = async (invoiceId: string, status: string) => {
    setActionLoading(invoiceId);
    try {
      const action = status === 'paid' ? 'mark_paid' : 'update_invoice_status';
      const res = await fetch('/api/admin/payment-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, invoiceId, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update');
      showToast(`Invoice marked as ${status}.`, 'success');
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredInvoices = invoiceFilter === 'all'
    ? invoices
    : invoices.filter((inv) => inv.status === invoiceFilter);

  const filteredSequences = reminderFilter === 'all'
    ? sequences
    : sequences.filter((s) => s.send_status === reminderFilter);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 max-w-sm px-5 py-4 rounded-2xl shadow-xl border backdrop-blur-sm flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-card border-accent/30 text-foreground' : 'bg-card border-red-400/30 text-foreground'
        }`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            toast.type === 'success' ? 'bg-accent/15 text-accent' : 'bg-red-400/15 text-red-400'
          }`}>
            {toast.type === 'success' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            )}
          </div>
          <p className="text-sm">{toast.msg}</p>
        </div>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-2xl font-semibold text-foreground">{summary.total}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Total Invoices</p>
          </div>
          <div className="bg-card border border-amber-200 rounded-xl p-4">
            <p className="text-2xl font-semibold text-amber-700">{summary.pending}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Pending</p>
          </div>
          <div className="bg-card border border-red-200 rounded-xl p-4">
            <p className="text-2xl font-semibold text-red-600">{summary.overdue}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Overdue</p>
          </div>
          <div className="bg-card border border-green-200 rounded-xl p-4">
            <p className="text-2xl font-semibold text-green-700">{summary.paid}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Paid</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 col-span-2 sm:col-span-1">
            <p className="text-2xl font-semibold text-foreground">{formatCurrency(summary.totalOutstanding)}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Outstanding</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 col-span-2 sm:col-span-1">
            <p className="text-2xl font-semibold text-foreground">{summary.remindersSent}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Reminders Sent</p>
          </div>
        </div>
      )}

      {/* Trigger Panel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-amber-50 border border-amber-200">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">Payment Reminder Automation</p>
            <p className="text-xs text-amber-700 mt-0.5 max-w-lg">
              Sends 3-day advance notices for upcoming invoices, overdue alerts for past-due invoices, and 7-day retainer deadline reminders. Runs daily via cron or trigger manually.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 bg-white text-amber-800 text-xs font-semibold hover:bg-amber-50 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
          <button
            onClick={handleRunAll}
            disabled={runningAll}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-60 transition-colors"
          >
            {runningAll ? (
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            )}
            {runningAll ? 'Running…' : 'Run All Reminders'}
          </button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-1 p-1 bg-secondary/40 rounded-xl w-fit border border-border">
        <button
          onClick={() => setActiveView('invoices')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
            activeView === 'invoices' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => setActiveView('reminders')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all flex items-center gap-1.5 ${
            activeView === 'reminders' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Reminder Log
          {summary && summary.remindersFailed > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">{summary.remindersFailed}</span>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* ── Invoices View ── */}
      {activeView === 'invoices' && (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'overdue', 'paid', 'cancelled'] as const).map((s) => {
              const count = s === 'all' ? invoices.length : invoices.filter((i) => i.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setInvoiceFilter(s)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border transition-all ${
                    invoiceFilter === s
                      ? 'bg-primary text-white border-primary' :'bg-card text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)} ({count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-32 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                    <div className="w-20 h-3 bg-muted/40 rounded animate-pulse" />
                  </div>
                  <div className="w-20 h-3 bg-muted/40 rounded animate-pulse hidden sm:block" />
                  <div className="w-16 h-6 bg-muted/50 rounded-full animate-pulse" />
                  <div className="w-24 h-7 bg-muted/40 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <p className="text-muted-foreground text-sm">No invoices found for this filter.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Invoice #</th>
                      <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Amount</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Due Date</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                      <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv, i) => {
                      const client = inv.contact_inquiries;
                      const dueDate = new Date(inv.due_date + 'T12:00:00Z');
                      const isOverdue = dueDate < new Date() && inv.status !== 'paid' && inv.status !== 'cancelled';
                      const daysOverdue = isOverdue ? Math.floor((new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                      const isExpanded = expandedInvoice === inv.id;
                      const relatedReminders = sequences.filter((s) => s.inquiry_id === inv.inquiry_id);

                      return (
                        <React.Fragment key={inv.id}>
                          <tr
                            className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                              isExpanded ? 'bg-secondary/20' : i % 2 === 0 ? 'hover:bg-secondary/20' : 'bg-secondary/10 hover:bg-secondary/20'
                            }`}
                            onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}
                          >
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-foreground">{client?.name ?? '—'}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{client?.email ?? '—'}</p>
                              {client?.service && (
                                <p className="text-xs text-muted-foreground/70 mt-0.5">{client.service}</p>
                              )}
                            </td>
                            <td className="px-5 py-3.5 hidden sm:table-cell">
                              <p className="text-xs font-mono font-semibold text-foreground">{inv.invoice_number}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Issued {new Date(inv.invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <p className="font-semibold text-foreground">{formatCurrency(inv.amount, inv.currency)}</p>
                              {inv.amount_paid > 0 && inv.amount_paid < inv.amount && (
                                <p className="text-xs text-green-600 mt-0.5">{formatCurrency(inv.amount_paid)} paid</p>
                              )}
                            </td>
                            <td className="px-5 py-3.5 hidden md:table-cell">
                              <p className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-foreground'}`}>
                                {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                              {isOverdue && (
                                <p className="text-xs text-red-500 mt-0.5">{daysOverdue}d overdue</p>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${INVOICE_STATUS_BADGE[inv.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleInvoiceStatus(inv.id, 'paid'); }}
                                    disabled={actionLoading === inv.id}
                                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {actionLoading === inv.id ? (
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                    ) : (
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    )}
                                    Mark Paid
                                  </button>
                                )}
                                {inv.status === 'pending' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleInvoiceStatus(inv.id, 'overdue'); }}
                                    disabled={actionLoading === inv.id}
                                    className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-all disabled:opacity-50"
                                  >
                                    Mark Overdue
                                  </button>
                                )}
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className={`p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all ${isExpanded ? 'bg-secondary/60' : ''}`}
                                  aria-label="Expand invoice"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                    <polyline points="6 9 12 15 18 9"/>
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {/* Expanded: Reminder History */}
                          {isExpanded && (
                            <tr className="border-b border-border bg-secondary/5">
                              <td colSpan={6} className="px-5 py-4">
                                <div className="space-y-3">
                                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Reminder History for this Invoice</p>
                                  {relatedReminders.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">No reminders sent yet for this client.</p>
                                  ) : (
                                    <div className="flex flex-col gap-2">
                                      {relatedReminders.map((seq) => (
                                        <div key={seq.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
                                          <div className="flex items-center gap-3 min-w-0">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${REMINDER_STATUS_BADGE[seq.send_status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                              {seq.send_status.charAt(0).toUpperCase() + seq.send_status.slice(1)}
                                            </span>
                                            <div className="min-w-0">
                                              <p className="text-xs font-medium text-foreground">Payment Reminder · Step {seq.step_number}</p>
                                              <p className="text-xs text-muted-foreground mt-0.5">
                                                {seq.sent_at
                                                  ? `Sent ${new Date(seq.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                                                  : `Scheduled ${new Date(seq.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                                                }
                                              </p>
                                              {seq.error_message && (
                                                <p className="text-xs text-red-500 mt-0.5 truncate max-w-xs" title={seq.error_message}>{seq.error_message}</p>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            {(seq.send_status === 'sent' || seq.send_status === 'failed') && (
                                              <button
                                                onClick={() => handleResend(seq.id)}
                                                disabled={actionLoading === seq.id}
                                                className="px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-1"
                                              >
                                                {actionLoading === seq.id ? (
                                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                                ) : (
                                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                                )}
                                                Resend
                                              </button>
                                            )}
                                            {seq.send_status === 'pending' && (
                                              <>
                                                {rescheduleId === seq.id ? (
                                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                      type="date"
                                                      value={rescheduleDate}
                                                      min={today}
                                                      onChange={(e) => setRescheduleDate(e.target.value)}
                                                      className="px-2 py-1 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent/40"
                                                    />
                                                    <input
                                                      type="time"
                                                      value={rescheduleTime}
                                                      onChange={(e) => setRescheduleTime(e.target.value)}
                                                      className="px-2 py-1 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent/40 w-24"
                                                    />
                                                    <button
                                                      onClick={() => handleReschedule(seq.id)}
                                                      disabled={actionLoading === seq.id}
                                                      className="px-2.5 py-1 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-all disabled:opacity-50"
                                                    >
                                                      Save
                                                    </button>
                                                    <button
                                                      onClick={() => setRescheduleId(null)}
                                                      className="px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-all"
                                                    >
                                                      ✕
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <>
                                                    <button
                                                      onClick={() => { setRescheduleId(seq.id); setRescheduleDate(''); }}
                                                      className="px-2.5 py-1 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-accent/50 transition-all flex items-center gap-1"
                                                    >
                                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                      Reschedule
                                                    </button>
                                                    <button
                                                      onClick={() => handleCancelReminder(seq.id)}
                                                      disabled={actionLoading === seq.id}
                                                      className="px-2.5 py-1 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:border-red-300 hover:text-red-600 transition-all disabled:opacity-50"
                                                    >
                                                      Cancel
                                                    </button>
                                                  </>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground">
                Showing {filteredInvoices.length} of {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Reminder Log View ── */}
      {activeView === 'reminders' && (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'sent', 'failed', 'skipped'] as const).map((s) => {
              const count = s === 'all' ? sequences.length : sequences.filter((seq) => seq.send_status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setReminderFilter(s)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border transition-all ${
                    reminderFilter === s
                      ? 'bg-primary text-white border-primary' :'bg-card text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)} ({count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-32 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                    <div className="w-20 h-3 bg-muted/40 rounded animate-pulse" />
                  </div>
                  <div className="w-20 h-3 bg-muted/40 rounded animate-pulse hidden sm:block" />
                  <div className="w-16 h-6 bg-muted/50 rounded-full animate-pulse" />
                  <div className="w-20 h-7 bg-muted/40 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredSequences.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <p className="text-muted-foreground text-sm">No payment reminders found. They are created when invoices are processed.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Type</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Scheduled / Sent</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                      <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSequences.map((seq, i) => {
                      const client = seq.contact_inquiries;
                      const scheduledDate = new Date(seq.scheduled_at);
                      const isPastDue = scheduledDate < new Date() && seq.send_status === 'pending';
                      const isRescheduling = rescheduleId === seq.id;

                      return (
                        <tr key={seq.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-foreground">{client?.name ?? '—'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{client?.email ?? '—'}</p>
                            {client?.service && (
                              <p className="text-xs text-muted-foreground/70 mt-0.5">{client.service}</p>
                            )}
                          </td>
                          <td className="px-5 py-3.5 hidden md:table-cell">
                            <p className="text-xs font-semibold text-foreground">Payment Reminder</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Step {seq.step_number}</p>
                            {seq.resend_email_id && (
                              <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono truncate max-w-[120px]" title={seq.resend_email_id}>{seq.resend_email_id}</p>
                            )}
                          </td>
                          <td className="px-5 py-3.5 hidden sm:table-cell">
                            {seq.sent_at ? (
                              <>
                                <p className="text-xs font-medium text-green-600">
                                  Sent {new Date(seq.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(seq.sent_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className={`text-xs font-medium ${isPastDue ? 'text-amber-600' : 'text-foreground'}`}>
                                  {scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </p>
                                {isPastDue && (
                                  <p className="text-xs text-amber-600 mt-0.5 font-medium">Past scheduled time</p>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${REMINDER_STATUS_BADGE[seq.send_status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {seq.send_status.charAt(0).toUpperCase() + seq.send_status.slice(1)}
                            </span>
                            {seq.error_message && (
                              <p className="text-xs text-red-500 mt-1 max-w-[160px] truncate" title={seq.error_message}>{seq.error_message}</p>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {isRescheduling ? (
                              <div className="flex items-center justify-end gap-2 flex-wrap">
                                <input
                                  type="date"
                                  value={rescheduleDate}
                                  min={today}
                                  onChange={(e) => setRescheduleDate(e.target.value)}
                                  className="px-2 py-1 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent/40"
                                />
                                <input
                                  type="time"
                                  value={rescheduleTime}
                                  onChange={(e) => setRescheduleTime(e.target.value)}
                                  className="px-2 py-1 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent/40 w-24"
                                />
                                <button
                                  onClick={() => handleReschedule(seq.id)}
                                  disabled={actionLoading === seq.id}
                                  className="px-2.5 py-1 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-all disabled:opacity-50"
                                >
                                  {actionLoading === seq.id ? '…' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setRescheduleId(null)}
                                  className="px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-all"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                {seq.send_status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleResend(seq.id)}
                                      disabled={actionLoading === seq.id}
                                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                      {actionLoading === seq.id ? (
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                      ) : (
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                      )}
                                      Send Now
                                    </button>
                                    <button
                                      onClick={() => { setRescheduleId(seq.id); setRescheduleDate(''); }}
                                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-accent/50 transition-all flex items-center gap-1.5"
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                      Reschedule
                                    </button>
                                    <button
                                      onClick={() => handleCancelReminder(seq.id)}
                                      disabled={actionLoading === seq.id}
                                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:border-red-300 hover:text-red-600 transition-all disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                                {seq.send_status === 'failed' && (
                                  <button
                                    onClick={() => handleResend(seq.id)}
                                    disabled={actionLoading === seq.id}
                                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {actionLoading === seq.id ? (
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                    ) : (
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                    )}
                                    Retry
                                  </button>
                                )}
                                {seq.send_status === 'sent' && (
                                  <button
                                    onClick={() => handleResend(seq.id)}
                                    disabled={actionLoading === seq.id}
                                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                    Resend
                                  </button>
                                )}
                                {seq.send_status === 'skipped' && (
                                  <span className="text-xs text-muted-foreground italic">Cancelled</span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground">
                Showing {filteredSequences.length} of {sequences.length} {sequences.length === 1 ? 'reminder' : 'reminders'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Consultations Dashboard ─────────────────────────────────────────────────

const CONSULTATION_STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  contacted: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

const CONSULTATION_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  in_review: 'In Review',
  contacted: 'Contacted',
  closed: 'Closed',
};

function ConsultationsDashboard() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [stats, setStats] = useState<ConsultationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editStage, setEditStage] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [showReschedule, setShowReschedule] = useState(false);
  // Email template state
  const [selectedTemplate, setSelectedTemplate] = useState('consultation_reminder');
  const [customMessage, setCustomMessage] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSendResult, setEmailSendResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchConsultations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/admin/consultations?${params}`);
      if (!res.ok) throw new Error('Failed to fetch consultations');
      const json = await res.json();
      setConsultations(json.consultations || []);
      setStats(json.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load consultations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  useEffect(() => {
    if (selected) {
      setEditNotes(selected.notes || '');
      setEditStatus(selected.status || 'new');
      setEditStage(selected.booking_stage || 'consultation_booked');
      if (selected.calendly_start_time) {
        const d = new Date(selected.calendly_start_time);
        setRescheduleDate(d.toISOString().slice(0, 10));
        setRescheduleTime(d.toISOString().slice(11, 16));
      } else {
        setRescheduleDate('');
        setRescheduleTime('');
      }
      setShowReschedule(false);
      setSaveError(null);
      setSaveSuccess(null);
      // Reset email state when switching consultations
      setSelectedTemplate('consultation_reminder');
      setCustomMessage('');
      setCustomSubject('');
      setEmailSendResult(null);
    }
  }, [selected]);

  const now = new Date();
  const filtered = consultations.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch = !search ||
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.firm?.toLowerCase().includes(q) ||
      c.service?.toLowerCase().includes(q) ||
      c.calendly_event_name?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const startTime = c.calendly_start_time ? new Date(c.calendly_start_time) : null;
    const matchesTime =
      timeFilter === 'all' ||
      (timeFilter === 'upcoming' && startTime && startTime > now) ||
      (timeFilter === 'past' && startTime && startTime <= now);
    return matchesSearch && matchesStatus && matchesTime;
  });

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const updates: Record<string, unknown> = {
        id: selected.id,
        status: editStatus,
        notes: editNotes,
        booking_stage: editStage,
      };
      if (showReschedule && rescheduleDate && rescheduleTime) {
        const newStart = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
        updates.calendly_start_time = newStart.toISOString();
        if (selected.calendly_end_time && selected.calendly_start_time) {
          const origDuration = new Date(selected.calendly_end_time).getTime() - new Date(selected.calendly_start_time).getTime();
          updates.calendly_end_time = new Date(newStart.getTime() + origDuration).toISOString();
        }
      }
      const res = await fetch('/api/admin/consultations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      const json = await res.json();
      const updated = json.consultation;
      setConsultations((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      setSelected(updated);
      setSaveSuccess('Changes saved successfully.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selected) return;
    setSendingEmail(true);
    setEmailSendResult(null);
    try {
      const res = await fetch('/api/admin/send-client-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate,
          clientEmail: selected.email,
          clientName: selected.name,
          clientFirm: selected.firm,
          clientService: selected.service,
          consultationDate: selected.calendly_start_time,
          customMessage: selectedTemplate === 'custom' ? customMessage : undefined,
          customSubject: selectedTemplate === 'custom' ? customSubject : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send email');
      setEmailSendResult({ type: 'success', msg: `Email sent successfully to ${selected.email}` });
    } catch (err) {
      setEmailSendResult({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to send email' });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleExport = () => {
    const rows = filtered.map((c) => ({
      Name: c.name,
      Firm: c.firm,
      Email: c.email,
      Service: c.service,
      'Event Type': c.calendly_event_name ?? '',
      'Start Time': c.calendly_start_time ? new Date(c.calendly_start_time).toLocaleString('en-US') : '',
      'End Time': c.calendly_end_time ? new Date(c.calendly_end_time).toLocaleString('en-US') : '',
      Location: c.calendly_meeting_location ?? '',
      Status: CONSULTATION_STATUS_LABELS[c.status] ?? c.status,
      Stage: BOOKING_STAGE_LABELS[c.booking_stage] ?? c.booking_stage,
      Notes: c.notes ?? '',
      'Booked On': c.created_at ? new Date(c.created_at).toLocaleString('en-US') : '',
    }));
    exportToCSV(rows, `consultations-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const upcomingCount = consultations.filter((c) => c.calendly_start_time && new Date(c.calendly_start_time) > now).length;
  const pastCount = consultations.filter((c) => c.calendly_start_time && new Date(c.calendly_start_time) <= now).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-semibold text-foreground">{consultations.length}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Total Booked</p>
        </div>
        <div className="bg-card border border-green-200 rounded-xl p-4">
          <p className="text-2xl font-semibold text-green-700">{upcomingCount}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Upcoming</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-semibold text-muted-foreground">{pastCount}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Past</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-semibold text-foreground">{filtered.length}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Filtered</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search name, email, firm, service…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none cursor-pointer min-w-[150px]"
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="in_review">In Review</option>
          <option value="contacted">Contacted</option>
          <option value="closed">Closed</option>
        </select>
        <div className="flex rounded-xl border border-border overflow-hidden bg-card">
          {(['all', 'upcoming', 'past'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeFilter(t)}
              className={`px-4 py-2.5 text-sm font-medium transition-all capitalize ${
                timeFilter === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchConsultations}
            className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className={`grid gap-6 ${selected ? 'lg:grid-cols-5' : 'grid-cols-1'}`}>
        {/* Table */}
        <div className={selected ? 'lg:col-span-3' : 'col-span-1'}>
          {loading ? (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="w-36 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                    <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
                  </div>
                  <div className="w-28 h-3 bg-muted/40 rounded animate-pulse hidden sm:block" />
                  <div className="w-20 h-3 bg-muted/40 rounded animate-pulse hidden md:block" />
                  <div className="w-16 h-6 bg-muted/50 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-14 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <p className="text-muted-foreground text-sm">
                {search || statusFilter !== 'all' || timeFilter !== 'all' ?'No consultations match your filters.' :'No booked consultations yet. They appear here once a Calendly booking is confirmed.'}
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Service</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Date & Time</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Stage</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => {
                      const isUpcoming = c.calendly_start_time && new Date(c.calendly_start_time) > now;
                      const isSelected = selected?.id === c.id;
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSelected(isSelected ? null : c)}
                          className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary/5 border-l-2 border-l-primary'
                              : i % 2 === 0 ? 'hover:bg-secondary/30' : 'bg-secondary/10 hover:bg-secondary/30'
                          }`}
                        >
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-foreground">{c.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{c.email}</p>
                            <p className="text-xs text-muted-foreground/60 mt-0.5 sm:hidden">{c.firm}</p>
                          </td>
                          <td className="px-5 py-3.5 hidden sm:table-cell">
                            <p className="text-sm text-foreground/80">{c.service}</p>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">{c.firm}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            {c.calendly_start_time ? (
                              <>
                                <p className={`text-sm font-medium ${isUpcoming ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {new Date(c.calendly_start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(c.calendly_start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                  {c.calendly_end_time && (
                                    <> – {new Date(c.calendly_end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
                                  )}
                                </p>
                                {isUpcoming && (
                                  <span className="inline-flex items-center gap-1 mt-1 text-xs text-green-600 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Upcoming
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 hidden md:table-cell">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${BOOKING_STAGE_COLORS[c.booking_stage] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                              {BOOKING_STAGE_LABELS[c.booking_stage] ?? c.booking_stage}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${CONSULTATION_STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                              {CONSULTATION_STATUS_LABELS[c.status] ?? c.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground">
                Showing {filtered.length} of {consultations.length} {consultations.length === 1 ? 'consultation' : 'consultations'}
              </div>
            </div>
          )}
        </div>

        {/* Detail / Edit Panel */}
        {selected && (
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-2xl p-6 sticky top-28 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-serif text-xl text-foreground">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{selected.firm}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors p-1"
                  aria-label="Close panel"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Contact Info */}
              <div className="flex flex-col gap-2.5">
                <a href={`mailto:${selected.email}`} className="flex items-center gap-2.5 text-sm text-accent hover:underline">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  {selected.email}
                </a>
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                  </svg>
                  {selected.service}
                </div>
                {selected.calendly_event_name && (
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground/70">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {selected.calendly_event_name}
                  </div>
                )}
                {selected.calendly_meeting_location && (
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground/70">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    {selected.calendly_meeting_location}
                  </div>
                )}
              </div>

              {/* Current Date/Time */}
              {selected.calendly_start_time && (
                <div className="bg-secondary/40 rounded-xl p-4 border border-border">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Scheduled Time</p>
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(selected.calendly_start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {new Date(selected.calendly_start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {selected.calendly_end_time && (
                      <> – {new Date(selected.calendly_end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
                    )}
                  </p>
                </div>
              )}

              {/* Reschedule Toggle */}
              <div>
                <button
                  onClick={() => setShowReschedule(!showReschedule)}
                  className="flex items-center gap-2 text-xs font-semibold text-accent hover:underline"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  {showReschedule ? 'Cancel Reschedule' : 'Reschedule Consultation'}
                </button>
                {showReschedule && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1 block">New Date</label>
                      <input
                        type="date"
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1 block">New Time</label>
                      <input
                        type="time"
                        value={rescheduleTime}
                        onChange={(e) => setRescheduleTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Lead Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CONSULTATION_STATUS_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setEditStatus(key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        editStatus === key
                          ? CONSULTATION_STATUS_COLORS[key]
                          : 'bg-transparent border-border text-muted-foreground hover:border-accent/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Booking Stage */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Booking Stage</p>
                <select
                  value={editStage}
                  onChange={(e) => setEditStage(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none cursor-pointer"
                >
                  {Object.entries(BOOKING_STAGE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Internal Notes</p>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add internal notes about this consultation…"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
                />
              </div>

              {/* Save / Error / Success */}
              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
              )}
              {saveSuccess && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{saveSuccess}</p>
              )}

              {/* ── Email Client Section ── */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-secondary/40 border-b border-border flex items-center gap-2">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent flex-shrink-0">
                    <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Email Client</p>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Select Template</label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => { setSelectedTemplate(e.target.value); setEmailSendResult(null); }}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none cursor-pointer"
                    >
                      <option value="consultation_reminder">📅 Consultation Reminder</option>
                      <option value="follow_up">🤝 Post-Consultation Follow-Up</option>
                      <option value="proposal_ready">📋 Proposal Ready</option>
                      <option value="welcome_client">🎉 Welcome New Client</option>
                      <option value="document_request">📎 Document Request</option>
                      <option value="custom">✏️ Custom Message</option>
                    </select>
                  </div>

                  {selectedTemplate === 'custom' && (
                    <>
                      <div>
                        <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Subject Line</label>
                        <input
                          type="text"
                          value={customSubject}
                          onChange={(e) => setCustomSubject(e.target.value)}
                          placeholder="Email subject…"
                          className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Message</label>
                        <textarea
                          rows={4}
                          value={customMessage}
                          onChange={(e) => setCustomMessage(e.target.value)}
                          placeholder="Write your message here…"
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
                        />
                      </div>
                    </>
                  )}

                  {emailSendResult && (
                    <p className={`text-xs rounded-lg px-3 py-2 ${
                      emailSendResult.type === 'success' ?'text-green-700 bg-green-50 border border-green-200' :'text-red-600 bg-red-50 border border-red-200'
                    }`}>
                      {emailSendResult.msg}
                    </p>
                  )}

                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail || (selectedTemplate === 'custom' && !customMessage.trim())}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: '#355E3B', color: '#fff' }}
                  >
                    {sendingEmail ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        Sending…
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                        Send Email
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <a
                  href={`mailto:${selected.email}?subject=Re: Your Consultation — Maggi May Broussard`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  Open in Mail App
                </a>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  {saving ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Saving…
                    </>
                  ) : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bookings Dashboard ───────────────────────────────────────────────────────

const BOOKING_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  canceled: 'bg-red-100 text-red-600 border-red-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
};

function BookingsDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('calendly_bookings')
        .select('*')
        .order('start_time', { ascending: false });
      if (fetchError) throw fetchError;
      setBookings(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const filtered = bookings.filter((b) => {
    const q = search.toLowerCase();
    const matchesSearch = !search ||
      b.name?.toLowerCase().includes(q) ||
      b.email?.toLowerCase().includes(q) ||
      b.event_type?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || b.status?.toLowerCase() === statusFilter;
    const startDate = new Date(b.start_time);
    const matchesFrom = !dateFrom || startDate >= new Date(dateFrom);
    const matchesTo = !dateTo || startDate <= new Date(dateTo + 'T23:59:59');
    return matchesSearch && matchesStatus && matchesFrom && matchesTo;
  });

  const confirmedCount = bookings.filter((b) => ['active', 'confirmed'].includes(b.status?.toLowerCase())).length;
  const canceledCount = bookings.filter((b) => ['canceled', 'cancelled'].includes(b.status?.toLowerCase())).length;

  const handleExport = () => {
    const rows = filtered.map((b) => ({
      Name: b.name,
      Email: b.email,
      'Event Type': b.event_type ?? '',
      'Start Time': b.start_time ? new Date(b.start_time).toLocaleString('en-US') : '',
      'End Time': b.end_time ? new Date(b.end_time).toLocaleString('en-US') : '',
      Status: b.status,
      'Booked On': b.created_at ? new Date(b.created_at).toLocaleString('en-US') : '',
      'Canceled At': b.canceled_at ? new Date(b.canceled_at).toLocaleString('en-US') : '',
      'Cancel Reason': b.cancel_reason ?? '',
    }));
    exportToCSV(rows, `bookings-export-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-semibold text-foreground">{bookings.length}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Total Bookings</p>
        </div>
        <div className="bg-card border border-green-200 rounded-xl p-4">
          <p className="text-2xl font-semibold text-green-700">{confirmedCount}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Confirmed</p>
        </div>
        <div className="bg-card border border-red-200 rounded-xl p-4">
          <p className="text-2xl font-semibold text-red-600">{canceledCount}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Canceled</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-semibold text-foreground">{filtered.length}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Filtered Results</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search name, email, event type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none cursor-pointer min-w-[150px]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Confirmed / Active</option>
          <option value="canceled">Canceled</option>
          <option value="pending">Pending</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          title="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          title="To date"
        />
        <div className="flex gap-2">
          <button
            onClick={fetchBookings}
            className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="border-b border-border bg-secondary/40 px-5 py-3 flex gap-6">
            <div className="w-28 h-3 bg-muted/50 rounded animate-pulse" />
            <div className="w-20 h-3 bg-muted/50 rounded animate-pulse hidden sm:block" />
            <div className="w-16 h-3 bg-muted/50 rounded animate-pulse hidden md:block" />
            <div className="w-16 h-3 bg-muted/50 rounded animate-pulse" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="w-36 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
              </div>
              <div className="w-28 h-3 bg-muted/40 rounded animate-pulse hidden sm:block" />
              <div className="w-20 h-3 bg-muted/40 rounded animate-pulse hidden md:block" />
              <div className="w-16 h-6 bg-muted/50 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30 mx-auto mb-3">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p className="text-muted-foreground text-sm">
            {search || statusFilter !== 'all' || dateFrom || dateTo ? 'No bookings match your filters.' : 'No bookings found. Bookings sync automatically from Calendly.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Event Type</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Scheduled</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Booked On</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => {
                  const statusKey = b.status?.toLowerCase() ?? '';
                  const isCanceled = ['canceled', 'cancelled'].includes(statusKey);
                  return (
                    <tr key={b.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-foreground">{b.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{b.email}</p>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className="text-foreground/80 text-sm">{b.event_type ?? '—'}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className={`text-sm font-medium ${isCanceled ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {b.start_time ? new Date(b.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {b.start_time ? new Date(b.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                        </p>
                        {isCanceled && b.cancel_reason && (
                          <p className="text-xs text-red-500 mt-0.5 max-w-[180px] truncate" title={b.cancel_reason}>
                            Reason: {b.cancel_reason}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${BOOKING_STATUS_COLORS[statusKey] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {isCanceled ? 'Canceled' : b.status ? b.status.charAt(0).toUpperCase() + b.status.slice(1) : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground text-xs">
                        {b.created_at ? formatDate(b.created_at) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground">
            Showing {filtered.length} of {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Payments Dashboard ───────────────────────────────────────────────────────

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  succeeded: 'bg-green-100 text-green-700 border-green-200',paid: 'bg-green-100 text-green-700 border-green-200',pending: 'bg-amber-100 text-amber-700 border-amber-200',processing: 'bg-blue-100 text-blue-700 border-blue-200',failed: 'bg-red-100 text-red-600 border-red-200',refunded: 'bg-gray-100 text-gray-500 border-gray-200',canceled: 'bg-gray-100 text-gray-500 border-gray-200',
};

function PaymentsDashboard() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('payments').select('*').order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setPayments(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch = !search ||
      p.customer_name?.toLowerCase().includes(q) ||
      p.customer_email?.toLowerCase().includes(q) ||
      p.payment_intent_id?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.payment_type?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || p.payment_status?.toLowerCase() === statusFilter;
    const matchesType = typeFilter === 'all' || p.payment_type?.toLowerCase() === typeFilter;
    const createdDate = new Date(p.created_at);
    const matchesFrom = !dateFrom || createdDate >= new Date(dateFrom);
    const matchesTo = !dateTo || createdDate <= new Date(dateTo + 'T23:59:59');
    return matchesSearch && matchesStatus && matchesType && matchesFrom && matchesTo;
  });

  const totalRevenue = filtered
    .filter((p) => ['succeeded', 'paid'].includes(p.payment_status?.toLowerCase()))
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const uniqueTypes = Array.from(new Set(payments.map((p) => p.payment_type).filter(Boolean)));

  const handleExport = () => {
    const rows = filtered.map((p) => ({
      'Customer Name': p.customer_name,'Customer Email': p.customer_email,
      Amount: formatCurrency(Number(p.amount), p.currency),
      Currency: p.currency?.toUpperCase(),
      Status: p.payment_status,
      Type: p.payment_type,
      Description: p.description ?? '','Payment Intent ID': p.payment_intent_id,'Stripe Charge ID': p.stripe_charge_id ?? '',Date: p.created_at ? new Date(p.created_at).toLocaleString('en-US') : '',
    }));
    exportToCSV(rows, `payments-export-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-semibold text-foreground">{payments.length}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Total Transactions</p>
        </div>
        <div className="bg-card border border-green-200 rounded-xl p-4">
          <p className="text-2xl font-semibold text-green-700">
            {formatCurrency(
              payments.filter((p) => ['succeeded', 'paid'].includes(p.payment_status?.toLowerCase())).reduce((s, p) => s + Number(p.amount), 0),
              payments[0]?.currency ?? 'usd'
            )}
          </p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Total Revenue</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-semibold text-foreground">
            {payments.filter((p) => ['succeeded', 'paid'].includes(p.payment_status?.toLowerCase())).length}
          </p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Successful</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-semibold text-foreground">
            {filtered.length !== payments.length ? formatCurrency(totalRevenue, payments[0]?.currency ?? 'usd') : filtered.length}
          </p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
            {filtered.length !== payments.length ? 'Filtered Revenue' : 'Filtered Results'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search name, email, payment ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none cursor-pointer min-w-[150px]"
        >
          <option value="all">All Statuses</option>
          <option value="succeeded">Succeeded</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="canceled">Canceled</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none cursor-pointer min-w-[150px]"
        >
          <option value="all">All Types</option>
          {uniqueTypes.map((t) => (
            <option key={t} value={t.toLowerCase()}>{t}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          title="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          title="To date"
        />
        <div className="flex gap-2">
          <button
            onClick={fetchPayments}
            className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          {/* Skeleton summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4">
                <div className="w-16 h-3 bg-muted/40 rounded animate-pulse mb-2" />
                <div className="w-20 h-6 bg-muted/60 rounded animate-pulse" />
              </div>
            ))}
          </div>
          {/* Skeleton table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="border-b border-border bg-secondary/40 px-5 py-3 flex gap-6">
              <div className="w-28 h-3 bg-muted/50 rounded animate-pulse" />
              <div className="w-20 h-3 bg-muted/50 rounded animate-pulse hidden sm:block" />
              <div className="w-16 h-3 bg-muted/50 rounded animate-pulse hidden md:block" />
              <div className="w-16 h-3 bg-muted/50 rounded animate-pulse" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="w-36 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                  <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
                </div>
                <div className="w-20 h-4 bg-muted/50 rounded animate-pulse hidden sm:block" />
                <div className="w-16 h-3 bg-muted/40 rounded animate-pulse hidden md:block" />
                <div className="w-16 h-6 bg-muted/50 rounded-full animate-pulse" />
                <div className="w-8 h-8 bg-muted/40 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30 mx-auto mb-3">
            <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          <p className="text-muted-foreground text-sm">
            {search || statusFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo? 'No payments match your filters.': 'No payment records found. Payments are recorded automatically via Stripe.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Customer</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Type</th>
                  <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Amount</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Date</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Payment ID</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const statusKey = p.payment_status?.toLowerCase() ?? '';
                  return (
                    <tr key={p.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-foreground">{p.customer_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.customer_email}</p>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className="text-foreground/80 text-sm capitalize">{p.payment_type?.replace(/_/g, ' ') ?? '—'}</span>
                        {p.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 max-w-[160px] truncate" title={p.description}>{p.description}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatCurrency(Number(p.amount), p.currency)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${PAYMENT_STATUS_COLORS[statusKey] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {p.payment_status ? p.payment_status.charAt(0).toUpperCase() + p.payment_status.slice(1) : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground text-xs">
                        {p.created_at ? formatDate(p.created_at) : '—'}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className="font-mono text-xs text-muted-foreground/70 truncate max-w-[140px] block" title={p.payment_intent_id}>
                          {p.payment_intent_id?.slice(0, 20)}…
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border bg-secondary/20 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {filtered.length} of {payments.length} {payments.length === 1 ? 'transaction' : 'transactions'}
            </span>
            {filtered.length > 0 && (
              <span className="text-xs font-semibold text-foreground">
                Filtered total: {formatCurrency(
                  filtered.filter((p) => ['succeeded', 'paid'].includes(p.payment_status?.toLowerCase())).reduce((s, p) => s + Number(p.amount), 0),
                  filtered[0]?.currency ?? 'usd'
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

interface KPIData {
  totalLeads: number;
  totalBookings: number;
  totalPayments: number;
  leadToBookingRate: number;
  bookingToPaymentRate: number;
  overallConversionRate: number;
  totalRevenue: number;
  avgClientValue: number;
  repeatClientCount: number;
  nurtureTotal: number;
  nurtureSent: number;
  nurtureDeliveryRate: number;
  nurturePending: number;
  nurtureFailed: number;
}

function useKPIData(): { data: KPIData | null; loading: boolean } {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKPIs() {
      try {
        const supabase = createClient();

        const [inquiriesRes, bookingsRes, paymentsRes, sequencesRes] = await Promise.all([
          supabase.from('contact_inquiries').select('id, status', { count: 'exact' }),
          supabase.from('calendly_bookings').select('id, email', { count: 'exact' }),
          supabase.from('payments').select('id, amount, customer_email, payment_status', { count: 'exact' }),
          supabase.from('email_sequences').select('id, send_status', { count: 'exact' }),
        ]);

        const leads = inquiriesRes.data || [];
        const bookings = bookingsRes.data || [];
        const payments = (paymentsRes.data || []).filter((p) => p.payment_status === 'succeeded');
        const sequences = sequencesRes.data || [];

        const totalLeads = leads.length;
        const totalBookings = bookings.length;
        const totalPayments = payments.length;

        const leadToBookingRate = totalLeads > 0 ? (totalBookings / totalLeads) * 100 : 0;
        const bookingToPaymentRate = totalBookings > 0 ? (totalPayments / totalBookings) * 100 : 0;
        const overallConversionRate = totalLeads > 0 ? (totalPayments / totalLeads) * 100 : 0;

        const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const uniquePayingClients = new Set(payments.map((p) => p.customer_email)).size;
        const avgClientValue = uniquePayingClients > 0 ? totalRevenue / uniquePayingClients : 0;

        const emailCounts: Record<string, number> = {};
        payments.forEach((p) => {
          emailCounts[p.customer_email] = (emailCounts[p.customer_email] || 0) + 1;
        });
        const repeatClientCount = Object.values(emailCounts).filter((c) => c > 1).length;

        const nurtureTotal = sequences.length;
        const nurtureSent = sequences.filter((s) => s.send_status === 'sent').length;
        const nurturePending = sequences.filter((s) => s.send_status === 'pending').length;
        const nurtureFailed = sequences.filter((s) => s.send_status === 'failed').length;
        const nurtureDeliveryRate = nurtureTotal > 0 ? (nurtureSent / nurtureTotal) * 100 : 0;

        setData({
          totalLeads,
          totalBookings,
          totalPayments,
          leadToBookingRate,
          bookingToPaymentRate,
          overallConversionRate,
          totalRevenue,
          avgClientValue,
          repeatClientCount,
          nurtureTotal,
          nurtureSent,
          nurtureDeliveryRate,
          nurturePending,
          nurtureFailed,
        });
      } catch {
        // Non-blocking — KPI cards fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchKPIs();
  }, []);

  return { data, loading };
}

function KPICards() {
  const { data, loading } = useKPIData();

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5">
            <div className="w-20 h-3 bg-muted/40 rounded animate-pulse mb-3" />
            <div className="w-14 h-7 bg-muted/60 rounded animate-pulse mb-2" />
            <div className="w-full h-1.5 bg-muted/30 rounded-full animate-pulse mb-2" />
            <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const kpis = [
    {
      group: 'Conversion Funnel',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
      ),
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      items: [
        {
          label: 'Lead → Booking',
          value: `${data.leadToBookingRate.toFixed(1)}%`,
          bar: data.leadToBookingRate,
          sub: `${data.totalBookings} of ${data.totalLeads} leads`,
          barColor: 'bg-blue-500',
        },
        {
          label: 'Booking → Payment',
          value: `${data.bookingToPaymentRate.toFixed(1)}%`,
          bar: data.bookingToPaymentRate,
          sub: `${data.totalPayments} of ${data.totalBookings} bookings`,
          barColor: 'bg-indigo-500',
        },
        {
          label: 'Overall Conversion',
          value: `${data.overallConversionRate.toFixed(1)}%`,
          bar: data.overallConversionRate,
          sub: `Lead → Paid client`,
          barColor: 'bg-violet-500',
        },
      ],
    },
    {
      group: 'Client Lifetime Value',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      items: [
        {
          label: 'Total Revenue',
          value: formatCurrency(data.totalRevenue / 100),
          bar: null,
          sub: `${data.totalPayments} paid transaction${data.totalPayments !== 1 ? 's' : ''}`,
          barColor: '',
        },
        {
          label: 'Avg. Client Value',
          value: formatCurrency(data.avgClientValue / 100),
          bar: null,
          sub: `Per paying client`,
          barColor: '',
        },
        {
          label: 'Repeat Clients',
          value: String(data.repeatClientCount),
          bar: null,
          sub: `Clients with 2+ payments`,
          barColor: '',
        },
      ],
    },
    {
      group: 'Nurture Performance',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      items: [
        {
          label: 'Delivery Rate',
          value: `${data.nurtureDeliveryRate.toFixed(1)}%`,
          bar: data.nurtureDeliveryRate,
          sub: `${data.nurtureSent} of ${data.nurtureTotal} emails sent`,
          barColor: 'bg-amber-500',
        },
        {
          label: 'Pending Sends',
          value: String(data.nurturePending),
          bar: data.nurtureTotal > 0 ? (data.nurturePending / data.nurtureTotal) * 100 : 0,
          sub: `Scheduled & awaiting send`,
          barColor: 'bg-sky-400',
        },
        {
          label: 'Failed Sends',
          value: String(data.nurtureFailed),
          bar: data.nurtureTotal > 0 ? (data.nurtureFailed / data.nurtureTotal) * 100 : 0,
          sub: `Require attention`,
          barColor: data.nurtureFailed > 0 ? 'bg-red-500' : 'bg-gray-300',
        },
      ],
    },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Performance KPIs</h2>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((group) => (
          <div key={group.group} className="bg-card border border-border rounded-2xl p-5">
            {/* Group Header */}
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-7 h-7 rounded-lg ${group.bg} ${group.color} flex items-center justify-center flex-shrink-0`}>
                {group.icon}
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{group.group}</p>
            </div>
            {/* Metrics */}
            <div className="flex flex-col gap-4">
              {group.items.map((item) => (
                <div key={item.label}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-base font-semibold text-foreground tabular-nums">{item.value}</span>
                  </div>
                  {item.bar !== null && (
                    <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden mb-1">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${item.barColor}`}
                        style={{ width: `${Math.min(item.bar, 100)}%` }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/60">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Case Documents Dashboard ─────────────────────────────────────────────────

const DOC_TYPE_CATEGORIES = [
  { label: 'All', value: 'all' },
  { label: 'Work Product', value: 'work_product' },
  { label: 'Discovery', value: 'discovery' },
  { label: 'Case Files', value: 'case_files' },
  { label: 'Court Filings', value: 'court_filings' },
  { label: 'Contracts', value: 'contracts' },
  { label: 'Correspondence', value: 'correspondence' },
  { label: 'Other', value: 'other' },
];

const DOC_CATEGORY_LABELS: Record<string, string> = {
  work_product: 'Work Product',
  discovery: 'Discovery',
  case_files: 'Case Files',
  court_filings: 'Court Filing',
  contracts: 'Contract',
  correspondence: 'Correspondence',
  other: 'Other',
};

const DOC_CATEGORY_COLORS: Record<string, string> = {
  work_product: 'bg-green-100 text-green-700',
  discovery: 'bg-amber-100 text-amber-700',
  case_files: 'bg-blue-100 text-blue-700',
  court_filings: 'bg-orange-100 text-orange-700',
  contracts: 'bg-indigo-100 text-indigo-700',
  correspondence: 'bg-emerald-100 text-emerald-700',
  other: 'bg-gray-100 text-gray-600',
};

function getDocCategory(doc: { category?: string | null; file_name: string }): string {
  if (doc.category && doc.category !== 'other') return doc.category;
  const lower = doc.file_name.toLowerCase();
  if (['motion', 'order', 'complaint', 'summons', 'subpoena', 'brief', 'petition', 'affidavit', 'judgment', 'court'].some(k => lower.includes(k))) return 'court_filings';
  if (['contract', 'agreement', 'retainer', 'engagement', 'terms', 'nda', 'mou'].some(k => lower.includes(k))) return 'contracts';
  if (['letter', 'email', 'memo', 'notice', 'correspondence'].some(k => lower.includes(k))) return 'correspondence';
  if (['deposition', 'discovery', 'interrogatory', 'evidence', 'exhibit'].some(k => lower.includes(k))) return 'discovery';
  if (['memo', 'analysis', 'research', 'brief', 'opinion', 'report'].some(k => lower.includes(k))) return 'work_product';
  return doc.category ?? 'other';
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocTypeIcon({ fileType }: { fileType: string | null }) {
  const type = (fileType ?? '').toUpperCase();
  const colorMap: Record<string, string> = {
    PDF: 'bg-red-100 text-red-700',
    DOC: 'bg-blue-100 text-blue-700',
    DOCX: 'bg-blue-100 text-blue-700',
    XLS: 'bg-green-100 text-green-700',
    XLSX: 'bg-green-100 text-green-700',
    JPEG: 'bg-purple-100 text-purple-700',
    PNG: 'bg-purple-100 text-purple-700',
    GIF: 'bg-purple-100 text-purple-700',
    TXT: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-bold flex-shrink-0 ${colorMap[type] ?? 'bg-secondary text-muted-foreground'}`}>
      {type || 'FILE'}
    </span>
  );
}

function CaseDocumentsDashboard() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<CaseDocumentAdmin[]>([]);
  const [inquiries, setInquiries] = useState<CaseInquiryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');

  // Upload state
  const [selectedInquiryId, setSelectedInquiryId] = useState('');
  const [docLabel, setDocLabel] = useState('');
  const [docCategory, setDocCategory] = useState('work_product');
  const [docDescription, setDocDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = createClient();
      const [docsRes, inqRes] = await Promise.all([
        sb
          .from('case_documents')
          .select('*, contact_inquiries(name, email, firm, service)')
          .order('created_at', { ascending: false }),
        sb
          .from('contact_inquiries')
          .select('id, name, firm, email, service')
          .order('created_at', { ascending: false }),
      ]);
      if (docsRes.error) throw docsRes.error;
      if (inqRes.error) throw inqRes.error;
      setDocuments(docsRes.data || []);
      setInquiries(inqRes.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES[file.type]) return 'File type not allowed. Accepted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT';
    if (file.size > MAX_FILE_SIZE) return 'File too large. Maximum size is 10 MB.';
    return null;
  };

  const handleUpload = async (file: File) => {
    if (!selectedInquiryId) { setUploadError('Please select a client case first.'); return; }
    const validationError = validateFile(file);
    if (validationError) { setUploadError(validationError); return; }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const sb = createClient();
      const storagePath = `paralegal/${selectedInquiryId}/${Date.now()}_${file.name}`;
      const { error: storageError } = await sb.storage
        .from('case-documents')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });
      if (storageError) throw storageError;

      const { data: { publicUrl } } = sb.storage.from('case-documents').getPublicUrl(storagePath);
      const ext = file.name.split('.').pop();
      const finalName = docLabel.trim() ? `${docLabel.trim()}.${ext}` : file.name;

      const { error: dbError } = await sb.from('case_documents').insert({
        inquiry_id: selectedInquiryId,
        file_name: finalName,
        file_url: publicUrl,
        file_type: ALLOWED_TYPES[file.type] ?? ext ?? null,
        file_size: file.size,
        uploaded_by: 'Staff',
        category: docCategory,
        description: docDescription.trim() || null,
      });
      if (dbError) throw dbError;

      setUploadSuccess(`"${finalName}" attached to case successfully.`);
      setDocLabel('');
      setDocDescription('');
      showToast(`"${finalName}" uploaded successfully.`, 'success');
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setUploadError(msg);
      showToast(msg, 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (doc: CaseDocumentAdmin) => {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    try {
      const sb = createClient();
      const { error: dbError } = await sb.from('case_documents').delete().eq('id', doc.id);
      if (dbError) throw dbError;
      showToast(`"${doc.file_name}" deleted.`, 'success');
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = documents.filter((doc) => {
    const matchesSearch = !searchQuery ||
      doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.contact_inquiries?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.contact_inquiries?.firm.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || getDocCategory(doc) === categoryFilter;
    const matchesClient = clientFilter === 'all' || doc.inquiry_id === clientFilter;
    return matchesSearch && matchesCategory && matchesClient;
  });

  const totalSize = documents.reduce((sum, d) => sum + (d.file_size ?? 0), 0);
  const uniqueClients = new Set(documents.map((d) => d.inquiry_id)).size;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 max-w-sm px-5 py-4 rounded-2xl shadow-xl border backdrop-blur-sm flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-card border-accent/30 text-foreground' : 'bg-card border-red-400/30 text-foreground'
        }`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            toast.type === 'success' ? 'bg-accent/15 text-accent' : 'bg-red-400/15 text-red-400'
          }`}>
            {toast.type === 'success' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            )}
          </div>
          <p className="text-sm">{toast.msg}</p>
        </div>
      )}

      {/* Stats Bento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Total Documents</p>
          <p className="text-3xl font-semibold text-foreground">{documents.length}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Client Cases</p>
          <p className="text-3xl font-semibold text-foreground">{uniqueClients}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Storage Used</p>
          <p className="text-3xl font-semibold text-foreground">{formatFileSize(totalSize) || '0 B'}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">This Month</p>
          <p className="text-3xl font-semibold text-foreground">
            {documents.filter((d) => {
              const created = new Date(d.created_at);
              const now = new Date();
              return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
            }).length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Panel */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-2xl p-6 sticky top-28">
            <h2 className="font-serif text-lg text-foreground mb-1">Attach Document</h2>
            <p className="text-xs text-muted-foreground mb-5">Upload court filings, contracts, or correspondence to a client case.</p>

            {/* Client Case Selector */}
            <div className="mb-4">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold block mb-2">Client Case *</label>
              <select
                value={selectedInquiryId}
                onChange={(e) => { setSelectedInquiryId(e.target.value); setUploadError(null); }}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              >
                <option value="">Select a client case…</option>
                {inquiries.map((inq) => (
                  <option key={inq.id} value={inq.id}>
                    {inq.name} — {inq.service}
                  </option>
                ))}
              </select>
            </div>

            {/* Document Label */}
            <div className="mb-4">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold block mb-2">Document Label <span className="normal-case font-normal">(optional)</span></label>
              <input
                type="text"
                value={docLabel}
                onChange={(e) => setDocLabel(e.target.value)}
                placeholder="e.g. Motion to Dismiss, Retainer Agreement…"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>

            {/* Category Selector */}
            <div className="mb-4">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold block mb-2">Document Category *</label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              >
                <option value="work_product">Work Product — Legal analysis, memos, deliverables</option>
                <option value="discovery">Discovery Materials — Evidence, depositions, exhibits</option>
                <option value="case_files">Case Files — Court records, pleadings, orders</option>
                <option value="court_filings">Court Filings — Motions, complaints, briefs</option>
                <option value="contracts">Contracts — Retainers, agreements, NDAs</option>
                <option value="correspondence">Correspondence — Letters, notices, memos</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold block mb-2">Description <span className="normal-case font-normal">(optional)</span></label>
              <input
                type="text"
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
                placeholder="Brief note about this document…"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>

            {/* Drop Zone */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            />
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleUpload(f);
              }}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                dragOver
                  ? 'border-accent bg-accent/5' :'border-border hover:border-accent/50 hover:bg-secondary/20'
              } ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-accent">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  <p className="text-sm text-muted-foreground font-medium">Uploading…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Drop file here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT</p>
                    <p className="text-xs text-muted-foreground">Max 10 MB per file</p>
                  </div>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-xs text-red-700">{uploadError}</p>
              </div>
            )}
            {uploadSuccess && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-green-50 border border-green-200">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 flex-shrink-0 mt-0.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <p className="text-xs text-green-700">{uploadSuccess}</p>
              </div>
            )}

            {/* Document Category Guide */}
            <div className="mt-5 pt-5 border-t border-border">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Category Guide</p>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Work Product', desc: 'Memos, analysis, research, deliverables', color: 'bg-green-100 text-green-700' },
                  { label: 'Discovery', desc: 'Evidence, depositions, interrogatories', color: 'bg-amber-100 text-amber-700' },
                  { label: 'Case Files', desc: 'Court records, pleadings, orders', color: 'bg-blue-100 text-blue-700' },
                  { label: 'Court Filings', desc: 'Motions, complaints, briefs', color: 'bg-orange-100 text-orange-700' },
                  { label: 'Contracts', desc: 'Retainers, agreements, NDAs', color: 'bg-indigo-100 text-indigo-700' },
                  { label: 'Correspondence', desc: 'Letters, notices, memos', color: 'bg-emerald-100 text-emerald-700' },
                ].map((cat) => (
                  <div key={cat.label} className="flex items-start gap-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${cat.color}`}>{cat.label}</span>
                    <p className="text-xs text-muted-foreground">{cat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Documents List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search documents or clients…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            >
              <option value="all">All Clients</option>
              {inquiries.map((inq) => (
                <option key={inq.id} value={inq.id}>{inq.name}</option>
              ))}
            </select>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2">
            {DOC_TYPE_CATEGORIES.map((cat) => {
              const count = cat.value === 'all'
                ? documents.length
                : documents.filter((d) => getDocCategory(d) === cat.value).length;
              return (
                <button
                  key={cat.value}
                  onClick={() => setCategoryFilter(cat.value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    categoryFilter === cat.value
                      ? 'bg-primary text-white border-primary' :'bg-card text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
            <button
              onClick={fetchData}
              className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold border border-border bg-card text-muted-foreground hover:border-accent/50 transition-all flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
              Refresh
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          {/* Document Cards */}
          {loading ? (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-muted/50 animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="w-48 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                    <div className="w-32 h-3 bg-muted/40 rounded animate-pulse" />
                  </div>
                  <div className="w-20 h-3 bg-muted/40 rounded animate-pulse hidden sm:block" />
                  <div className="w-16 h-7 bg-muted/40 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                {documents.length === 0 ? 'No documents yet' : 'No documents match your filters'}
              </p>
              <p className="text-xs text-muted-foreground">
                {documents.length === 0
                  ? 'Select a client case and upload the first document using the panel on the left.'
                  : 'Try adjusting your search or filter criteria.'}
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="border-b border-border bg-secondary/40 px-5 py-3 flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                  {filtered.length} {filtered.length === 1 ? 'Document' : 'Documents'}
                </p>
              </div>
              <div className="divide-y divide-border">
                {filtered.map((doc) => {
                  const client = doc.contact_inquiries;
                  const category = getDocCategory(doc);
                  const categoryColor = DOC_CATEGORY_COLORS[category] ?? 'bg-gray-100 text-gray-600';
                  const categoryLabel = DOC_CATEGORY_LABELS[category] ?? 'Other';
                  return (
                    <div key={doc.id} className="px-5 py-4 flex items-start gap-4 hover:bg-secondary/10 transition-colors group">
                      <DocTypeIcon fileType={doc.file_type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate max-w-[280px]" title={doc.file_name}>
                            {doc.file_name}
                          </p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${categoryColor}`}>
                            {categoryLabel}
                          </span>
                        </div>
                        {doc.description && (
                          <p className="text-xs text-muted-foreground font-light mt-0.5 line-clamp-1">{doc.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {client && (
                            <span className="text-xs text-muted-foreground font-medium">{client.name}</span>
                          )}
                          {client?.firm && (
                            <span className="text-xs text-muted-foreground/60">{client.firm}</span>
                          )}
                          {doc.file_size && (
                            <span className="text-xs text-muted-foreground/60">{formatFileSize(doc.file_size)}</span>
                          )}
                          <span className="text-xs text-muted-foreground/50">
                            {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        {client?.service && (
                          <p className="text-xs text-muted-foreground/50 mt-0.5">{client.service}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                          title="View document"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          View
                        </a>
                        <button
                          onClick={() => handleDelete(doc)}
                          disabled={deletingId === doc.id}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-border bg-card text-muted-foreground hover:border-red-300 hover:text-red-600 transition-all disabled:opacity-50"
                          title="Delete document"
                          aria-label="Delete document"
                        >
                          {deletingId === doc.id ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground">
                Showing {filtered.length} of {documents.length} {documents.length === 1 ? 'document' : 'documents'} · {formatFileSize(totalSize) || '0 B'} total
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

// CaseManagementDashboard is imported from ./components/CaseManagementDashboard
// Legacy inline types kept for reference
interface CaseClient {
  id: string; name: string; firm: string; email: string; service: string;
  message: string; status: string; notes: string | null; booking_stage: string;
  calendly_start_time: string | null; calendly_event_name: string | null;
  created_at: string; updated_at: string;
}
interface CaseNote { id: string; inquiry_id: string; content: string; author: string; created_at: string; }
interface CaseInvoice {
  id: string; inquiry_id: string | null; invoice_number: string; invoice_date: string;
  due_date: string; amount: number; amount_paid: number; currency: string; status: string;
  line_items: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
  notes: string | null; created_at: string;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _CaseManagementDashboardInline_REMOVED() {
  const [clients, setClients] = useState<CaseClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<CaseClient | null>(null);
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>([]);
  const [invoices, setInvoices] = useState<CaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'invoices' | 'communications'>('overview');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Case status/stage update
  const [updatingStage, setUpdatingStage] = useState(false);

  // New note
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // New invoice
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    description: '',
    amount: '',
    due_date: '',
    notes: '',
  });
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [generatingLinkId, setGeneratingLinkId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const handleCopyPaymentLink = async (inv: CaseInvoice) => {
    setGeneratingLinkId(inv.id);
    try {
      const res = await fetch('/api/invoices/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          description: inv.line_items?.[0]?.description || `Invoice ${inv.invoice_number}`,
          amount: Number(inv.amount) - Number(inv.amount_paid),
          currency: inv.currency,
          customerEmail: selectedClient?.email ?? '',
          customerName: selectedClient?.name ?? '',
          dueDate: inv.due_date,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Failed to create payment link');
      await navigator.clipboard.writeText(data.url);
      setCopiedLinkId(inv.id);
      showToast('Payment link copied to clipboard!', 'success');
      setTimeout(() => setCopiedLinkId(null), 3000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate payment link.', 'error');
    } finally {
      setGeneratingLinkId(null);
    }
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('contact_inquiries')
        .select('*')
        .order('updated_at', { ascending: false });
      if (fetchError) throw fetchError;
      setClients(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClientDetails = useCallback(async (inquiryId: string) => {
    setDetailLoading(true);
    try {
      const supabase = createClient();
      const [notesRes, invoicesRes] = await Promise.all([
        supabase
          .from('case_notes')
          .select('*')
          .eq('inquiry_id', inquiryId)
          .order('created_at', { ascending: false }),
        supabase
          .from('client_invoices')
          .select('*')
          .eq('inquiry_id', inquiryId)
          .order('created_at', { ascending: false }),
      ]);
      setCaseNotes(notesRes.data || []);
      setInvoices(invoicesRes.data || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load details.', 'error');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  useEffect(() => {
    if (selectedClient) {
      fetchClientDetails(selectedClient.id);
      setActiveDetailTab('overview');
      setNewNote('');
      setShowInvoiceForm(false);
    }
  }, [selectedClient, fetchClientDetails]);

  const handleStageUpdate = async (stage: string) => {
    if (!selectedClient) return;
    setUpdatingStage(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('contact_inquiries')
        .update({ booking_stage: stage, updated_at: new Date().toISOString() })
        .eq('id', selectedClient.id);
      if (updateError) throw updateError;
      const updated = { ...selectedClient, booking_stage: stage };
      setSelectedClient(updated);
      setClients((prev) => prev.map((c) => c.id === selectedClient.id ? updated : c));
      showToast(`Case stage updated to "${BOOKING_STAGE_LABELS[stage]}".`, 'success');
      // Track workflow funnel: case progression
      try {
        if (stage === 'active_client' || stage === 'retainer_signed') {
          trackWorkflowCaseCreated({ caseId: selectedClient.id, serviceType: selectedClient.service, source: 'admin_stage_update' });
        }
        trackAdminAction('update_case_stage', 'clients', { stage, service_type: selectedClient.service });
      } catch { /* analytics non-blocking */ }
      // Send automated email notification to client
      notifyClient(selectedClient.email, selectedClient.name, 'booking_stage_change', {
        newStage: stage,
        service: selectedClient.service,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update stage.', 'error');
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!selectedClient) return;
    setUpdatingStage(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('contact_inquiries')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', selectedClient.id);
      if (updateError) throw updateError;
      const updated = { ...selectedClient, status };
      setSelectedClient(updated);
      setClients((prev) => prev.map((c) => c.id === selectedClient.id ? updated : c));
      showToast(`Status updated to "${STATUS_LABELS[status] ?? status}".`, 'success');
      // Track workflow funnel: lead status change
      try {
        if (status === 'contacted' || status === 'in_review') {
          trackWorkflowLeadCreated({ source: 'admin_status_update', serviceType: selectedClient.service, inquiryId: selectedClient.id });
        }
        trackAdminAction('update_inquiry_status', 'clients', { status, service_type: selectedClient.service });
      } catch { /* analytics non-blocking */ }
      // Send automated email notification to client
      notifyClient(selectedClient.email, selectedClient.name, 'status_change', {
        newStatus: status,
        service: selectedClient.service,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status.', 'error');
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedClient || !newNote.trim()) return;
    setSavingNote(true);
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from('case_notes')
        .insert({
          inquiry_id: selectedClient.id,
          content: newNote.trim(),
          author: 'Maggi May Broussard',
        })
        .select()
        .single();
      if (insertError) throw insertError;
      setCaseNotes((prev) => [data, ...prev]);
      setNewNote('');
      showToast('Note added successfully.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add note.', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from('case_notes')
        .delete()
        .eq('id', noteId);
      if (deleteError) throw deleteError;
      setCaseNotes((prev) => prev.filter((n) => n.id !== noteId));
      showToast('Note deleted.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete note.', 'error');
    }
  };

  const handleCreateInvoice = async () => {
    if (!selectedClient || !invoiceForm.description || !invoiceForm.amount || !invoiceForm.due_date) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }
    setSavingInvoice(true);
    try {
      const supabase = createClient();
      const amount = parseFloat(invoiceForm.amount);
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      const lineItems = [{ description: invoiceForm.description, quantity: 1, unit_price: amount, total: amount }];
      const { data, error: insertError } = await supabase
        .from('client_invoices')
        .insert({
          inquiry_id: selectedClient.id,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: invoiceForm.due_date,
          amount,
          amount_paid: 0,
          currency: 'usd',
          status: 'pending',
          line_items: lineItems,
          notes: invoiceForm.notes || null,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      setInvoices((prev) => [data, ...prev]);
      setInvoiceForm({ description: '', amount: '', due_date: '', notes: '' });
      setShowInvoiceForm(false);
      showToast(`Invoice ${invoiceNumber} created.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create invoice.', 'error');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleInvoiceStatusUpdate = async (invoiceId: string, status: string) => {
    setUpdatingInvoiceId(invoiceId);
    try {
      const supabase = createClient();
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === 'paid') updates.amount_paid = invoices.find((i) => i.id === invoiceId)?.amount ?? 0;
      const { error: updateError } = await supabase
        .from('client_invoices')
        .update(updates)
        .eq('id', invoiceId);
      if (updateError) throw updateError;
      setInvoices((prev) => prev.map((inv) => inv.id === invoiceId ? { ...inv, status, ...(status === 'paid' ? { amount_paid: inv.amount } : {}) } : inv));
      showToast(`Invoice marked as ${status}.`, 'success');
      // Track workflow funnel: payment collected
      try {
        const inv = invoices.find((i) => i.id === invoiceId);
        if (status === 'paid' && inv) {
          trackWorkflowPaymentCollected({
            caseId: selectedClient?.id,
            paymentType: 'invoice',
            amount: inv.amount ?? 0,
            transactionId: invoiceId,
          });
          trackAdminAction('mark_invoice_paid', 'clients', { invoice_id: invoiceId, amount: inv.amount });
        } else if (status === 'pending' && inv) {
          trackWorkflowPaymentInitiated({ caseId: selectedClient?.id, paymentType: 'invoice', amount: inv.amount ?? 0 });
        }
      } catch { /* analytics non-blocking */ }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update invoice.', 'error');
    } finally {
      setUpdatingInvoiceId(null);
    }
  };

  const filtered = clients.filter((c) => {
    const matchesSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.firm.toLowerCase().includes(search.toLowerCase()) ||
      c.service.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === 'all' || c.booking_stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const stageCounts = Object.keys(BOOKING_STAGE_LABELS).reduce<Record<string, number>>((acc, s) => {
    acc[s] = clients.filter((c) => c.booking_stage === s).length;
    return acc;
  }, {});

  const activeCount = clients.filter((c) => c.booking_stage === 'active_client').length;
  const pendingInvoicesCount = invoices.filter((i) => i.status === 'pending' || i.status === 'overdue').length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 max-w-sm px-5 py-4 rounded-2xl shadow-xl border backdrop-blur-sm flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-card border-accent/30 text-foreground' : 'bg-card border-red-400/30 text-foreground'
        }`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            toast.type === 'success' ? 'bg-accent/15 text-accent' : 'bg-red-400/15 text-red-400'
          }`}>
            {toast.type === 'success' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            )}
          </div>
          <p className="text-sm">{toast.msg}</p>
        </div>
      )}

      {/* Stage Summary Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStageFilter('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border transition-all ${
            stageFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/40'
          }`}
        >
          All ({clients.length})
        </button>
        {Object.entries(BOOKING_STAGE_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStageFilter(stageFilter === key ? 'all' : key)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border transition-all ${
              stageFilter === key ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/40'
            }`}
          >
            {label} ({stageCounts[key] ?? 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Search by name, email, firm, or service…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
        />
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Main Grid: List + Detail */}
      <div className={`grid gap-6 ${selectedClient ? 'lg:grid-cols-5' : 'grid-cols-1'}`}>

        {/* Client List */}
        <div className={selectedClient ? 'lg:col-span-2' : 'col-span-1'}>
          {loading ? (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-32 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                    <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
                  </div>
                  <div className="w-20 h-6 bg-muted/50 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <p className="text-muted-foreground text-sm">No cases found.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Stage</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((client, i) => (
                      <tr
                        key={client.id}
                        onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
                        className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                          selectedClient?.id === client.id
                            ? 'bg-accent/8'
                            : i % 2 === 0 ? 'hover:bg-secondary/30' : 'bg-secondary/10 hover:bg-secondary/30'
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-foreground">{client.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{client.email}</p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">{client.service}</p>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${BOOKING_STAGE_COLORS[client.booking_stage] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            {BOOKING_STAGE_LABELS[client.booking_stage] ?? client.booking_stage}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell text-xs text-muted-foreground">
                          {formatDate(client.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground">
                {filtered.length} of {clients.length} cases · {activeCount} active
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedClient && (
          <div className="lg:col-span-3">
            <div className="bg-card border border-border rounded-2xl overflow-hidden sticky top-28">
              {/* Header */}
              <div className="px-6 pt-5 pb-4 border-b border-border">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-serif text-xl text-foreground">{selectedClient.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedClient.firm} · {selectedClient.service}</p>
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="text-muted-foreground/50 hover:text-foreground transition-colors p-1"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={`mailto:${selectedClient.email}`} className="text-xs text-accent hover:underline flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    {selectedClient.email}
                  </a>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="text-xs text-muted-foreground">Submitted {formatDate(selectedClient.created_at)}</span>
                </div>
              </div>

              {/* Detail Tabs */}
              <div className="flex border-b border-border bg-secondary/20">
                {(['overview', 'invoices', 'communications'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveDetailTab(tab)}
                    className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all ${
                      activeDetailTab === tab
                        ? 'text-foreground border-b-2 border-primary bg-card'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab === 'overview' ? 'Overview' : tab === 'invoices' ? `Invoices${pendingInvoicesCount > 0 && activeDetailTab !== 'invoices' ? ` (${pendingInvoicesCount})` : ''}` : 'Communications'}
                  </button>
                ))}
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {detailLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <>
                    {/* ── Overview Tab ── */}
                    {activeDetailTab === 'overview' && (
                      <div className="space-y-5">
                        {/* Case Stage */}
                        <div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Case Stage</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(BOOKING_STAGE_LABELS).map(([key, label]) => (
                              <button
                                key={key}
                                onClick={() => handleStageUpdate(key)}
                                disabled={updatingStage}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-60 ${
                                  selectedClient.booking_stage === key
                                    ? BOOKING_STAGE_COLORS[key]
                                    : 'bg-transparent border-border text-muted-foreground hover:border-accent/50'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Inquiry Status */}
                        <div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Inquiry Status</p>
                          <div className="flex flex-wrap gap-2">
                            {STATUS_OPTIONS.map((s) => (
                              <button
                                key={s}
                                onClick={() => handleStatusUpdate(s)}
                                disabled={updatingStage}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-60 ${
                                  selectedClient.status === s
                                    ? STATUS_COLORS[s]
                                    : 'bg-transparent border-border text-muted-foreground hover:border-accent/50'
                                }`}
                              >
                                {STATUS_LABELS[s]}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Calendly Booking */}
                        {selectedClient.calendly_start_time && (
                          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                            <p className="text-xs uppercase tracking-widest text-purple-600 font-semibold mb-1">Consultation Booked</p>
                            <p className="text-sm font-medium text-purple-900">{selectedClient.calendly_event_name ?? 'Consultation'}</p>
                            <p className="text-xs text-purple-700 mt-0.5">
                              {new Date(selectedClient.calendly_start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                              {' · '}
                              {new Date(selectedClient.calendly_start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                        )}

                        {/* Original Message */}
                        <div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Original Message</p>
                          <p className="text-sm text-foreground/80 leading-relaxed bg-secondary/40 rounded-xl p-4 border border-border">
                            {selectedClient.message}
                          </p>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex gap-2">
                          <a
                            href={`mailto:${selectedClient.email}?subject=Re: Your Case — Maggi May Broussard`}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                            style={{ background: '#355E3B', color: '#fff' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                            Email Client
                          </a>
                          <button
                            onClick={() => { setActiveDetailTab('invoices'); setShowInvoiceForm(true); }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            New Invoice
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Invoices Tab ── */}
                    {activeDetailTab === 'invoices' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">{invoices.length} Invoice{invoices.length !== 1 ? 's' : ''}</p>
                          <button
                            onClick={() => setShowInvoiceForm(!showInvoiceForm)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            {showInvoiceForm ? 'Cancel' : 'New Invoice'}
                          </button>
                        </div>

                        {/* New Invoice Form */}
                        {showInvoiceForm && (
                          <div className="p-4 rounded-xl border border-accent/30 bg-accent/5 space-y-3">
                            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Create Invoice</p>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Description *</label>
                              <input
                                type="text"
                                placeholder="e.g. Retainer Agreement — Immigration Consultation"
                                value={invoiceForm.description}
                                onChange={(e) => setInvoiceForm((f) => ({ ...f, description: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Amount (USD) *</label>
                                <input
                                  type="number"
                                  placeholder="1500.00"
                                  value={invoiceForm.amount}
                                  onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))}
                                  className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Due Date *</label>
                                <input
                                  type="date"
                                  value={invoiceForm.due_date}
                                  onChange={(e) => setInvoiceForm((f) => ({ ...f, due_date: e.target.value }))}
                                  className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
                              <textarea
                                rows={2}
                                placeholder="Payment terms, special instructions…"
                                value={invoiceForm.notes}
                                onChange={(e) => setInvoiceForm((f) => ({ ...f, notes: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
                              />
                            </div>
                            <button
                              onClick={handleCreateInvoice}
                              disabled={savingInvoice}
                              className="w-full py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                              style={{ background: '#355E3B', color: '#fff' }}
                            >
                              {savingInvoice ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              )}
                              {savingInvoice ? 'Creating…' : 'Create Invoice'}
                            </button>
                          </div>
                        )}

                        {/* Invoice List */}
                        {invoices.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">No invoices yet.</div>
                        ) : (
                          <div className="space-y-3">
                            {invoices.map((inv) => (
                              <div key={inv.id} className="p-4 rounded-xl border border-border bg-secondary/20">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{inv.invoice_number}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {inv.line_items?.[0]?.description ?? 'Invoice'}
                                    </p>
                                  </div>
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${INVOICE_STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                                  <span className="font-semibold text-foreground text-base">{formatCurrency(inv.amount, inv.currency)}</span>
                                  <span>Due {formatDate(inv.due_date)}</span>
                                </div>
                                {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                  <div className="flex gap-2">
                                    {inv.status !== 'paid' && (
                                      <button
                                        onClick={() => handleInvoiceStatusUpdate(inv.id, 'paid')}
                                        disabled={updatingInvoiceId === inv.id}
                                        className="flex-1 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors"
                                      >
                                        Mark Paid
                                      </button>
                                    )}
                                    {inv.status === 'pending' && (
                                      <button
                                        onClick={() => handleInvoiceStatusUpdate(inv.id, 'overdue')}
                                        disabled={updatingInvoiceId === inv.id}
                                        className="flex-1 py-1.5 rounded-lg border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-60 transition-colors"
                                      >
                                        Mark Overdue
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleCopyPaymentLink(inv)}
                                      disabled={generatingLinkId === inv.id}
                                      title="Copy payment link to send to client"
                                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:border-accent/50 hover:text-accent disabled:opacity-60 transition-colors flex items-center gap-1"
                                    >
                                      {generatingLinkId === inv.id ? (
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                      ) : copiedLinkId === inv.id ? (
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                      ) : (
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                      )}
                                      {copiedLinkId === inv.id ? 'Copied!' : 'Copy Link'}
                                    </button>
                                    <button
                                      onClick={() => handleInvoiceStatusUpdate(inv.id, 'cancelled')}
                                      disabled={updatingInvoiceId === inv.id}
                                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:border-red-300 hover:text-red-600 disabled:opacity-60 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                                {inv.notes && (
                                  <p className="mt-2 text-xs text-muted-foreground italic">{inv.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Communications Tab ── */}
                    {activeDetailTab === 'communications' && (
                      <div className="space-y-4">
                        {/* Add Note */}
                        <div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Add Case Note</p>
                          <textarea
                            rows={3}
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Log a call, email summary, case update, or internal note…"
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
                          />
                          <button
                            onClick={handleAddNote}
                            disabled={savingNote || !newNote.trim()}
                            className="mt-2 w-full py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                            style={{ background: '#355E3B', color: '#fff' }}
                          >
                            {savingNote ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            )}
                            {savingNote ? 'Saving…' : 'Add Note'}
                          </button>
                        </div>

                        {/* Notes Timeline */}
                        <div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Communication History ({caseNotes.length})</p>
                          {caseNotes.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">No notes yet. Add the first note above.</div>
                          ) : (
                            <div className="space-y-3">
                              {caseNotes.map((note) => (
                                <div key={note.id} className="relative pl-4 border-l-2 border-accent/30">
                                  <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-accent/40 border-2 border-background" />
                                  <div className="bg-secondary/30 rounded-xl p-3 border border-border">
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-foreground">{note.author}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                          {' · '}
                                          {new Date(note.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleDeleteNote(note.id)}
                                        className="text-muted-foreground/30 hover:text-red-500 transition-colors flex-shrink-0"
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                        </svg>
                                      </button>
                                    </div>
                                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Quick Email */}
                        <div className="pt-3 border-t border-border">
                          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Quick Actions</p>
                          <div className="flex gap-2">
                            <a
                              href={`mailto:${selectedClient.email}?subject=Case Update — Maggi May Broussard`}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                              style={{ background: '#355E3B', color: '#fff' }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                              Email Client
                            </a>
                            <a
                              href="https://calendly.com/maggimaybroussard"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                              Schedule
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Integrations Dashboard ───────────────────────────────────────────────────

function IntegrationsDashboard() {
  const [gcalStatus, setGcalStatus] = React.useState<{
    connected: boolean;
    accountEmail?: string;
    calendarId?: string;
    connectedAt?: string;
  } | null>(null);
  const [gcalLoading, setGcalLoading] = React.useState(true);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [gcalMsg, setGcalMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

  React.useEffect(() => {
    // Check for OAuth callback result in URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const gcal = params.get('gcal');
      const email = params.get('email');
      const reason = params.get('reason');
      if (gcal === 'connected' && email) {
        setGcalMsg({ type: 'success', text: `Connected as ${email}` });
        // Clean URL
        const url = new URL(window.location.href);
        url.searchParams.delete('gcal');
        url.searchParams.delete('email');
        window.history.replaceState({}, '', url.toString());
      } else if (gcal === 'error') {
        const reasonMap: Record<string, string> = {
          no_refresh_token: 'No refresh token received. Make sure to grant offline access.',
          missing_credentials: 'Google OAuth credentials not configured in environment variables.',
          no_code: 'Authorization was denied.',
          server_error: 'A server error occurred during OAuth.',
        };
        setGcalMsg({ type: 'error', text: reasonMap[reason ?? ''] ?? `OAuth error: ${reason}` });
        const url = new URL(window.location.href);
        url.searchParams.delete('gcal');
        url.searchParams.delete('reason');
        window.history.replaceState({}, '', url.toString());
      }
    }

    fetch('/api/google-calendar/status')
      .then((r) => r.json())
      .then((d) => setGcalStatus(d))
      .catch(() => setGcalStatus({ connected: false }))
      .finally(() => setGcalLoading(false));
  }, []);

  function handleConnect() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setGcalMsg({ type: 'error', text: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Add it to your environment variables.' });
      return;
    }
    const redirectUri = encodeURIComponent(`${siteUrl}/api/google-calendar/callback`);
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    window.location.href = url;
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/google-calendar/status', { method: 'DELETE' });
      if (res.ok) {
        setGcalStatus({ connected: false });
        setGcalMsg({ type: 'success', text: 'Google Calendar disconnected.' });
      } else {
        setGcalMsg({ type: 'error', text: 'Failed to disconnect.' });
      }
    } catch {
      setGcalMsg({ type: 'error', text: 'Network error.' });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Google Calendar Card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-secondary/30 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-border flex items-center justify-center shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="4" width="18" height="18" rx="2" fill="#4285F4" opacity="0.15"/>
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="1.5"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke="#4285F4" strokeWidth="1.5"/>
              <rect x="7" y="13" width="4" height="4" rx="0.5" fill="#4285F4"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Google Calendar</h3>
            <p className="text-xs text-muted-foreground">Auto-sync confirmed Calendly bookings to your Google Calendar</p>
          </div>
          <div className="ml-auto">
            {gcalLoading ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/40 text-xs text-muted-foreground">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Checking…
              </span>
            ) : gcalStatus?.connected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/40 border border-border text-muted-foreground text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                Not connected
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-5">
          {gcalMsg && (
            <div className={`mb-4 p-3 rounded-xl text-sm flex items-start gap-2 ${gcalMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                {gcalMsg.type === 'success'
                  ? <><polyline points="20 6 9 17 4 12"/></>
                  : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
              </svg>
              {gcalMsg.text}
            </div>
          )}

          {gcalStatus?.connected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary/40 rounded-xl p-4 border border-border">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Connected Account</p>
                  <p className="text-sm font-medium text-foreground">{gcalStatus.accountEmail}</p>
                </div>
                <div className="bg-secondary/40 rounded-xl p-4 border border-border">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Calendar</p>
                  <p className="text-sm font-medium text-foreground">{gcalStatus.calendarId ?? 'primary'}</p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 mt-0.5 shrink-0">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-green-800">Sync active</p>
                    <p className="text-xs text-green-700 mt-0.5">New Calendly bookings will automatically appear in your Google Calendar. Cancellations will remove the event.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-all disabled:opacity-60"
              >
                {disconnecting ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                )}
                Disconnect Google Calendar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-secondary/30 rounded-xl p-4 border border-border">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">How it works</p>
                <ul className="space-y-2">
                  {[
                    'When a client books a Calendly consultation, the event is automatically added to your Google Calendar',
                    'If the client cancels, the event is removed from your calendar',
                    'The client receives a calendar invite with all meeting details',
                    'Reminders are set for 24 hours and 1 hour before the consultation',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-800 mb-1">Before connecting</p>
                <p className="text-xs text-amber-700">Make sure <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>, <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_ID</code>, and <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> are set in your environment variables. You&apos;ll need a Google Cloud project with the Calendar API enabled and an OAuth 2.0 Web Client credential with the redirect URI: <span className="font-mono break-all">{siteUrl}/api/google-calendar/callback</span></p>
              </div>

              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#4285F4' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Connect Google Calendar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminInquiriesPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'inquiries' | 'bookings' | 'payments' | 'analytics' | 'sequences' | 'documents' | 'reminders' | 'cases' | 'emails' | 'consultations' | 'testimonials' | 'clients' | 'client_profiles' | 'integrations' | 'operations' | 'intake_nurture' | 'analytics_dashboard' | 'prospect_scoring' | 'billing_history' | 'retainer_subscriptions' | 'retainer_balance' | 'email_templates' | 'billing_test' | 'billable_hours' | 'invoice_generator' | 'invoice_reminders' | 'invoice_tracking' | 'invoices' | 'reporting' | 'practice_insights' | 'kanban' | 'tasks' | 'notification_emails' | 'messages' | 'security' | 'doc_templates' | 'client_doc_templates' | 'contracts_repository' | 'intake_analytics' | 'intake_routing' | 'audit_trail' | 'routing_admin' | 'scheduling' | 'availability' | 'growth_analytics' | 'strategic_analytics' | 'notifications' | 'roster' | 'retainer_invoice_scheduler' | 'stripe_reconciliation' | 'billing_ops_hub' | 'client_invoices_overview' | 'consultation_funnel' | 'booking_analytics' | 'financial_dashboard' | 'deliverables' | 'case_actions' | 'post_case_close' | 'lifecycle_emails' | 'realtime_feed' | 'ga4_conversion' | 'iolta_ledger' | 'lexi_admin_tools' | 'lexi_document_drafts' | 'monthly_reports' | 'referral_claims' | 'contact_leads' | 'hours_reporting' | 'paralegal_hours' | 'event_notifications' | 'practice_analytics' | 'billing' | 'matter_profitability' | 'matter_time_logger' | 'court_deadlines' | 'staff_time' | 'webhooks' | 'nps_surveys' | 'retainer_alerts' | 'secure_sharing' | 'intake_templates' | 'reporting_exports' | 'billable_allocation' | 'practice_kpi' | 'email_reminders' | 'doc_extractor' | 'matter_invoice_builder' | 'cash_position' | 'portal_adoption' | 'scheduled_consultations' | 'consultation_availability' | 'submissions_inbox' | 'assistant_conversations' | 'lexi_assistant' | 'sms_reminders' | 'client_task_portal' | 'consultation_admin' | 'case_studies_manager' | 'lead_nurture' | 'calendly_pipeline' | 'conversion_funnel' | 'client_dashboard_view' | 'retainer_doc_analyzer' | 'client_intake_forms' | 'engagement_letters' | 'gemini_case_analyzer' | 'email_sms_templates' | 'active_cases' | 'realtime_case_notifications' | 'doc_esignature_manager' | 'retainer_invoice_automation' | 'caseflow_manager' | 'retainer_renewal_notifications' | 'client_communication_hub' | 'notion_integration' | 'time_entry' | 'case_file_repository' | 'case_pipeline' | 'admin_kpi' | 'transactional_emails' | 'email_nurture_templates' | 'case_calendar' | 'automated_intake' | 'client_journey_automation' | 'document_management' | 'practice_management_suite' | 'ai_legal_secretary' | 'team_admin'>('overview');
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadDocError, setUploadDocError] = useState<string | null>(null);
  const [uploadDocSuccess, setUploadDocSuccess] = useState<string | null>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('contact_inquiries').select('*').order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setInquiries(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load inquiries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  useEffect(() => {
    if (selectedInquiry) {
      setNotesValue(selectedInquiry.notes || '');
    }
  }, [selectedInquiry]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('contact_inquiries')
        .update({ status: newStatus })
        .eq('id', id);

      if (updateError) throw updateError;
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === id ? { ...inq, status: newStatus } : inq))
      );
      if (selectedInquiry?.id === id) {
        setSelectedInquiry((prev) => prev ? { ...prev, status: newStatus } : prev);
      }

      const target = inquiries.find((inq) => inq.id === id);
      if (target) {
        await notifyClient(target.email, target.name, 'status_change', {
          newStatus,
          service: target.service,
        });
        const actor = await getAdminEmail();
        logAuditEvent({
          action_type: 'case_status_changed',
          actor_email: actor.email,
          actor_id: actor.id,
          target_type: 'case',
          target_id: id,
          target_label: `${target.name} (${target.service})`,
          description: `Case status changed to "${STATUS_LABELS[newStatus] ?? newStatus}" for ${target.name}`,
          metadata: { previous_status: target.status, new_status: newStatus, client_email: target.email },
        });
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this inquiry? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from('contact_inquiries').delete().eq('id', id);

      if (deleteError) throw deleteError;
      setInquiries((prev) => prev.filter((inq) => inq.id !== id));
      if (selectedInquiry?.id === id) setSelectedInquiry(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete inquiry.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedInquiry) return;
    setSavingNotes(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('contact_inquiries')
        .update({ notes: notesValue })
        .eq('id', selectedInquiry.id);

      if (updateError) throw updateError;
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === selectedInquiry.id ? { ...inq, notes: notesValue } : inq))
      );
      setSelectedInquiry((prev) => prev ? { ...prev, notes: notesValue } : prev);

      if (notesValue.trim()) {
        await notifyClient(selectedInquiry.email, selectedInquiry.name, 'case_note', {
          noteContent: notesValue,
        });
      }

      const actor = await getAdminEmail();
      logAuditEvent({
        action_type: 'case_note_added',
        actor_email: actor.email,
        actor_id: actor.id,
        target_type: 'case',
        target_id: selectedInquiry.id,
        target_label: `${selectedInquiry.name} (${selectedInquiry.service})`,
        description: `Case note updated for ${selectedInquiry.name}`,
        metadata: { client_email: selectedInquiry.email },
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDocUpload = async (file: File) => {
    if (!selectedInquiry) return;
    if (!ALLOWED_TYPES[file.type]) {
      setUploadDocError('File type not allowed. Accepted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadDocError('File too large. Maximum size is 10 MB.');
      return;
    }
    setUploadingDoc(true);
    setUploadDocError(null);
    setUploadDocSuccess(null);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const storagePath = `paralegal/${selectedInquiry.id}/${Date.now()}_${file.name}`;

      const { error: storageError } = await supabase.storage
        .from('case-documents')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage
        .from('case-documents')
        .getPublicUrl(storagePath);

      const { error: dbError } = await supabase.from('case_documents').insert({
        inquiry_id: selectedInquiry.id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: ALLOWED_TYPES[file.type] ?? ext ?? null,
        file_size: file.size,
        uploaded_by: 'Maggi May Broussard',
      });

      if (dbError) throw dbError;

      setUploadDocSuccess(`"${file.name}" uploaded and client notified.`);

      await notifyClient(selectedInquiry.email, selectedInquiry.name, 'document_upload', {
        fileName: file.name,
        uploadedBy: 'Maggi May Broussard',
      });

      const actor = await getAdminEmail();
      logAuditEvent({
        action_type: 'document_upload',
        actor_email: actor.email,
        actor_id: actor.id,
        target_type: 'case',
        target_id: selectedInquiry.id,
        target_label: `${selectedInquiry.name} — ${file.name}`,
        description: `Document "${file.name}" uploaded for case: ${selectedInquiry.name} (${selectedInquiry.service})`,
        metadata: {
          file_name: file.name,
          file_type: ALLOWED_TYPES[file.type] ?? ext ?? null,
          file_size: file.size,
          client_email: selectedInquiry.email,
        },
      });
    } catch (err: unknown) {
      setUploadDocError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploadingDoc(false);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
    }
  };

  const filtered = inquiries.filter((inq) => {
    const matchesSearch =
      !search ||
      inq.name.toLowerCase().includes(search.toLowerCase()) ||
      inq.email.toLowerCase().includes(search.toLowerCase()) ||
      inq.firm.toLowerCase().includes(search.toLowerCase()) ||
      inq.service.toLowerCase().includes(search.toLowerCase()) ||
      inq.message.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inq.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const counts = STATUS_OPTIONS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = inquiries.filter((inq) => inq.status === s).length;
    return acc;
  }, {});

  const handleExportInquiries = () => {
    const rows = filtered.map((inq) => ({
      Name: inq.name,
      Firm: inq.firm,
      Email: inq.email,
      Service: inq.service,
      Status: STATUS_LABELS[inq.status] ?? inq.status,
      Message: inq.message,
      Notes: inq.notes ?? '','Submitted On': inq.created_at ? new Date(inq.created_at).toLocaleString('en-US') : '',
    }));
    exportToCSV(rows, `contact-inquiries-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const newLeadsCount = inquiries.filter((inq) => inq.status === 'new').length;

  const EMAIL_STATUS_CONFIG: Record<
    ProspectEmailItem['displayStatus'],
    { label: string; color: string; dot: string }
  > = {
    queued:     { label: 'Queued',     color: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-400' },
    sent:       { label: 'Sent',       color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
    delivered:  { label: 'Delivered',  color: 'bg-teal-50 text-teal-700 border-teal-200',     dot: 'bg-teal-500' },
    opened:     { label: 'Opened',     color: 'bg-green-50 text-green-700 border-green-200',  dot: 'bg-green-500' },
    clicked:    { label: 'Clicked',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    bounced:    { label: 'Bounced',    color: 'bg-red-50 text-red-700 border-red-200',        dot: 'bg-red-500' },
    complained: { label: 'Complained', color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
    failed:     { label: 'Failed',     color: 'bg-red-100 text-red-800 border-red-300',       dot: 'bg-red-600' },
    skipped:    { label: 'Skipped',    color: 'bg-gray-100 text-gray-500 border-gray-200',    dot: 'bg-gray-400' },
  };

  function ProspectEmailsDashboard() {
    const [emails, setEmails] = useState<ProspectEmailItem[]>([]);
    const [stats, setStats] = useState<ProspectEmailStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchEmails = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: '100' });
        if (statusFilter !== 'all') params.set('status', statusFilter);
        const res = await fetch(`/api/admin/prospect-emails?${params}`);
        if (!res.ok) throw new Error('Failed to fetch prospect emails');
        const json = await res.json();
        setEmails(json.emails || []);
        setStats(json.stats || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load emails');
      } finally {
        setLoading(false);
      }
    }, [statusFilter]);

    useEffect(() => {
      fetchEmails();
    }, [fetchEmails]);

    const filtered = emails.filter((e) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        e.prospectName.toLowerCase().includes(q) ||
        e.prospectEmail.toLowerCase().includes(q) ||
        e.firm.toLowerCase().includes(q) ||
        e.service.toLowerCase().includes(q) ||
        (e.subject?.toLowerCase().includes(q) ?? false)
      );
    });

    const openRate = stats && stats.sent > 0
      ? Math.round((stats.opened / stats.sent) * 100)
      : 0;
    const clickRate = stats && stats.sent > 0
      ? Math.round((stats.clicked / stats.sent) * 100)
      : 0;
    const bounceRate = stats && stats.sent > 0
      ? Math.round((stats.bounced / stats.sent) * 100)
      : 0;

    return (
      <div>
        {/* Resend connection warning */}
        {stats && !stats.resendConnected && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 mt-0.5 flex-shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">Resend API key not configured</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Add your <code className="font-mono bg-amber-100 px-1 rounded">RESEND_API_KEY</code> to the environment variables to see live open/click tracking. Sequence data from Supabase is still shown below.
              </p>
            </div>
          </div>
        )}

        {/* KPI Strip */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
            {[
              { label: 'Total', value: stats.total, color: 'text-foreground' },
              { label: 'Queued', value: stats.queued, color: 'text-blue-600' },
              { label: 'Sent', value: stats.sent, color: 'text-slate-600' },
              { label: 'Open Rate', value: `${openRate}%`, color: 'text-green-600' },
              { label: 'Click Rate', value: `${clickRate}%`, color: 'text-emerald-600' },
              { label: 'Bounced', value: stats.bounced, color: 'text-red-600' },
              { label: 'Bounce Rate', value: `${bounceRate}%`, color: stats.bounced > 0 ? 'text-red-600' : 'text-muted-foreground' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{kpi.label}</p>
                <p className={`text-2xl font-semibold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, firm, service, subject…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none cursor-pointer min-w-[160px]"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Queued</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
          <button
            onClick={fetchEmails}
            className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="w-40 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                  <div className="w-28 h-3 bg-muted/40 rounded animate-pulse" />
                </div>
                <div className="w-24 h-3 bg-muted/40 rounded animate-pulse hidden sm:block" />
                <div className="w-20 h-6 bg-muted/50 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-14 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>
            <p className="text-muted-foreground text-sm">
              {search || statusFilter !== 'all' ?'No emails match your filters.' :'No prospect follow-up emails found. They appear here once the contact form is submitted.'}
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Prospect</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Step</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Subject</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Scheduled</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                    <th className="px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden xl:table-cell text-right">Resend ID</th>
                    <th className="px-3 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((email, i) => {
                    const cfg = EMAIL_STATUS_CONFIG[email.displayStatus] ?? EMAIL_STATUS_CONFIG['sent'];
                    const isExpanded = expandedId === email.sequenceId;
                    return (
                      <React.Fragment key={email.sequenceId}>
                        <tr
                          className={`border-b border-border last:border-0 transition-colors cursor-pointer ${
                            isExpanded
                              ? 'bg-secondary/30'
                              : i % 2 === 0 ? 'hover:bg-secondary/20' : 'bg-secondary/10 hover:bg-secondary/20'
                          }`}
                          onClick={() => setExpandedId(isExpanded ? null : email.sequenceId)}
                        >
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-foreground">{email.prospectName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{email.prospectEmail}</p>
                            <p className="text-xs text-muted-foreground/70 mt-0.5 md:hidden">{email.firm}</p>
                          </td>
                          <td className="px-5 py-3.5 hidden md:table-cell">
                            <span className="text-xs font-medium text-foreground/80 bg-secondary/60 px-2.5 py-1 rounded-full border border-border">
                              {email.stepLabel}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 hidden lg:table-cell">
                            <p className="text-sm text-foreground/80 truncate max-w-[220px]">
                              {email.subject ?? <span className="text-muted-foreground/50 italic">—</span>}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground text-xs">
                            {formatDate(email.scheduledAt)}
                            {email.sentAt && (
                              <p className="text-muted-foreground/60 mt-0.5">Sent {formatDate(email.sentAt)}</p>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 hidden xl:table-cell text-right">
                            {email.resendEmailId ? (
                              <span className="font-mono text-xs text-muted-foreground/60 truncate max-w-[120px] inline-block">
                                {email.resendEmailId.slice(0, 8)}…
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <svg
                              width="14" height="14"
                              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              className={`text-muted-foreground/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            >
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-border bg-secondary/20">
                            <td colSpan={7} className="px-5 py-4">
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
                                <div>
                                  <p className="text-muted-foreground uppercase tracking-widest font-semibold mb-1">Firm</p>
                                  <p className="text-foreground">{email.firm || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground uppercase tracking-widest font-semibold mb-1">Service</p>
                                  <p className="text-foreground">{email.service || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground uppercase tracking-widest font-semibold mb-1">Step</p>
                                  <p className="text-foreground">{email.stepLabel}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground uppercase tracking-widest font-semibold mb-1">Last Event</p>
                                  <p className="text-foreground capitalize">{email.lastEvent ?? '—'}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground uppercase tracking-widest font-semibold mb-1">Resend ID</p>
                                  <p className="font-mono text-foreground/70 break-all">{email.resendEmailId ?? '—'}</p>
                                </div>
                                {email.subject && (
                                  <div className="col-span-2 sm:col-span-3 lg:col-span-5">
                                    <p className="text-muted-foreground uppercase tracking-widest font-semibold mb-1">Subject</p>
                                    <p className="text-foreground">{email.subject}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground flex items-center justify-between">
              <span>Showing {filtered.length} of {emails.length} emails</span>
              {stats?.resendConnected && (
                <span className="flex items-center gap-1.5 text-green-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Resend connected — live tracking active
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Testimonials Dashboard ───────────────────────────────────────────────

  interface TestimonialRow {
    id: string;
    name: string;
    role: string;
    firm: string;
    location: string;
    service: string;
    rating: number;
    quote: string;
    full_quote: string;
    image: string;
    alt: string;
    featured: boolean;
    sort_order: number;
    active: boolean;
  }

  const EMPTY_TESTIMONIAL: Omit<TestimonialRow, 'id'> = {
    name: '', role: '', firm: '', location: '', service: '', rating: 5,
    quote: '', full_quote: '', image: '', alt: '', featured: false, sort_order: 0, active: true,
  };

  function TestimonialsDashboard() {
    const supabase = createClient();
    const [testimonials, setTestimonials] = useState<TestimonialRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<Omit<TestimonialRow, 'id'>>(EMPTY_TESTIMONIAL);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const fetchTestimonials = useCallback(async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('testimonials')
        .select('*')
        .order('sort_order', { ascending: true });
      if (err) setError(err.message);
      else setTestimonials((data ?? []) as TestimonialRow[]);
      setLoading(false);
    }, [supabase]);

    useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);

    function openAdd() {
      setEditingId(null);
      setForm(EMPTY_TESTIMONIAL);
      setShowForm(true);
      setError(null);
    }

    function openEdit(t: TestimonialRow) {
      setEditingId(t.id);
      setForm({ name: t.name, role: t.role, firm: t.firm, location: t.location, service: t.service, rating: t.rating, quote: t.quote, full_quote: t.full_quote, image: t.image, alt: t.alt, featured: t.featured, sort_order: t.sort_order, active: t.active });
      setShowForm(true);
      setError(null);
    }

    function cancelForm() {
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_TESTIMONIAL);
      setError(null);
    }

    async function handleSave() {
      if (!form.name.trim() || !form.quote.trim()) {
        setError('Name and quote are required.');
        return;
      }
      setSaving(true);
      setError(null);
      if (editingId) {
        const { error: err } = await supabase.from('testimonials').update(form).eq('id', editingId);
        if (err) { setError(err.message); setSaving(false); return; }
      } else {
        const { error: err } = await supabase.from('testimonials').insert([form]);
        if (err) { setError(err.message); setSaving(false); return; }
      }
      setSaving(false);
      cancelForm();
      fetchTestimonials();
    }

    async function handleDelete(id: string) {
      const { error: err } = await supabase.from('testimonials').delete().eq('id', id);
      if (err) { setError(err.message); return; }
      setDeleteConfirmId(null);
      fetchTestimonials();
    }

    async function toggleActive(t: TestimonialRow) {
      await supabase.from('testimonials').update({ active: !t.active }).eq('id', t.id);
      fetchTestimonials();
    }

    async function toggleFeatured(t: TestimonialRow) {
      await supabase.from('testimonials').update({ featured: !t.featured }).eq('id', t.id);
      fetchTestimonials();
    }

    return (
      <div>
        {/* Header actions */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">{testimonials.length} testimonial{testimonials.length !== 1 ? 's' : ''} total · {testimonials.filter(t => t.active).length} visible on site</p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Testimonial
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Add / Edit Form */}
        {showForm && (
          <div className="mb-6 bg-card border border-border rounded-2xl p-6">
            <h3 className="font-serif text-lg text-foreground mb-5">{editingId ? 'Edit Testimonial' : 'Add New Testimonial'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  placeholder="Client full name"
                />
              </div>
              {/* Role */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Role / Title</label>
                <input
                  type="text"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  placeholder="e.g. Partner"
                />
              </div>
              {/* Firm */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Firm / Company</label>
                <input
                  type="text"
                  value={form.firm}
                  onChange={e => setForm(f => ({ ...f, firm: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  placeholder="e.g. Smith & Associates"
                />
              </div>
              {/* Location */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  placeholder="e.g. Austin, TX"
                />
              </div>
              {/* Service */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Service</label>
                <input
                  type="text"
                  value={form.service}
                  onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  placeholder="e.g. Litigation Support"
                />
              </div>
              {/* Rating */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Rating (1–5)</label>
                <select
                  value={form.rating}
                  onChange={e => setForm(f => ({ ...f, rating: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} Star{n !== 1 ? 's' : ''}</option>)}
                </select>
              </div>
              {/* Sort Order */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Sort Order</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  min={0}
                />
              </div>
              {/* Image URL */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Image URL</label>
                <input
                  type="text"
                  value={form.image}
                  onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  placeholder="https://..."
                />
              </div>
              {/* Alt text */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Image Alt Text</label>
                <input
                  type="text"
                  value={form.alt}
                  onChange={e => setForm(f => ({ ...f, alt: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  placeholder="Descriptive alt text for accessibility"
                />
              </div>
              {/* Short Quote */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Short Quote * <span className="normal-case font-normal text-muted-foreground">(shown on homepage)</span></label>
                <textarea
                  value={form.quote}
                  onChange={e => setForm(f => ({ ...f, quote: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                  placeholder="Brief quote for homepage display..."
                />
              </div>
              {/* Full Quote */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Full Quote <span className="normal-case font-normal text-muted-foreground">(shown on testimonials page)</span></label>
                <textarea
                  value={form.full_quote}
                  onChange={e => setForm(f => ({ ...f, full_quote: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                  placeholder="Extended testimonial for the testimonials page..."
                />
              </div>
              {/* Toggles */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="w-4 h-4 rounded accent-primary" />
                  <span className="text-sm text-foreground">Featured</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 rounded accent-primary" />
                  <span className="text-sm text-foreground">Visible on site</span>
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-border">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Testimonial'}
              </button>
              <button onClick={cancelForm} className="px-5 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Testimonials Table */}
        {loading ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">Loading testimonials…</div>
        ) : testimonials.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <p className="text-muted-foreground text-sm mb-4">No testimonials yet.</p>
            <button onClick={openAdd} className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity">Add First Testimonial</button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Service</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Quote</th>
                    <th className="text-center px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Featured</th>
                    <th className="text-center px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Visible</th>
                    <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {testimonials.map((t, i) => (
                    <tr key={t.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-5 py-3.5">
                        <p className="font-serif text-sm font-semibold text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.role}{t.firm ? `, ${t.firm}` : ''}</p>
                        {t.location && <p className="text-xs text-accent/70 mt-0.5">{t.location}</p>}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <span className="text-xs font-medium text-accent/70 bg-accent/8 px-2.5 py-1 rounded-full border border-accent/15">{t.service || '—'}</span>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell max-w-xs">
                        <p className="text-xs text-muted-foreground italic truncate">{t.quote}</p>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => toggleFeatured(t)}
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors ${t.featured ? 'bg-accent/20 text-accent' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}
                          title={t.featured ? 'Remove from featured' : 'Mark as featured'}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill={t.featured ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => toggleActive(t)}
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors ${t.active ? 'bg-green-100 text-green-600' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}
                          title={t.active ? 'Hide from site' : 'Show on site'}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            {t.active ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
                          </svg>
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(t)}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                          >
                            Edit
                          </button>
                          {deleteConfirmId === t.id ? (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleDelete(t.id)} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors">Confirm</button>
                              <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(t.id)}
                              className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Intake Nurture Dashboard ─────────────────────────────────────────────

  interface IntakeNurtureRow {
    id: string;
    submission_id: string;
    recipient_email: string;
    recipient_name: string;
    case_type: string;
    urgency: string;
    step_number: number;
    step_label: string | null;
    scheduled_at: string;
    sent_at: string | null;
    send_status: 'pending' | 'sent' | 'failed' | 'skipped';
    resend_email_id: string | null;
    error_message: string | null;
    created_at: string;
  }

  function IntakeNurtureDashboard() {
    const [rows, setRows] = useState<IntakeNurtureRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [search, setSearch] = useState('');

    const STEP_LABELS: Record<number, string> = {
      1: 'Intake Confirmation',
      2: 'Case Prep Tips',
      3: 'Social Proof',
      4: 'Consultation Checklist',
      5: 'Post-Consultation',
    };

    const STATUS_STYLE: Record<string, { color: string; dot: string; label: string }> = {
      pending: { color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', label: 'Queued' },
      sent:    { color: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500', label: 'Sent' },
      failed:  { color: 'bg-red-100 text-red-800 border-red-300', dot: 'bg-red-600', label: 'Failed' },
      skipped: { color: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400', label: 'Skipped' },
    };

    const fetchData = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: fetchErr } = await supabase
          .from('intake_nurture_sequences')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        if (fetchErr) throw new Error(fetchErr.message);
        setRows(data ?? []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = rows.filter((r) => {
      const matchStatus = statusFilter === 'all' || r.send_status === statusFilter;
      const matchSearch = !search || r.recipient_name.toLowerCase().includes(search.toLowerCase()) || r.recipient_email.toLowerCase().includes(search.toLowerCase()) || r.case_type.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });

    const stats = {
      total: rows.length,
      pending: rows.filter((r) => r.send_status === 'pending').length,
      sent: rows.filter((r) => r.send_status === 'sent').length,
      failed: rows.filter((r) => r.send_status === 'failed').length,
      prospects: new Set(rows.map((r) => r.recipient_email)).size,
    };

    const stepBreakdown = [1, 2, 3, 4, 5].map((step) => {
      const stepRows = rows.filter((r) => r.step_number === step);
      const sent = stepRows.filter((r) => r.send_status === 'sent').length;
      const total = stepRows.length;
      return { step, label: STEP_LABELS[step], sent, total, rate: total > 0 ? Math.round((sent / total) * 100) : 0 };
    });

    if (loading) {
      return (
        <div className="flex items-center justify-center py-24">
          <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">{error}</div>
      );
    }

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total Emails', value: stats.total, color: 'text-foreground' },
            { label: 'Prospects', value: stats.prospects, color: 'text-blue-600' },
            { label: 'Queued', value: stats.pending, color: 'text-amber-600' },
            { label: 'Sent', value: stats.sent, color: 'text-green-600' },
            { label: 'Failed', value: stats.failed, color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <p className={`text-2xl font-semibold ${color}`}>{value}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Step Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-serif text-base text-foreground mb-4">Sequence Step Performance</h3>
          <div className="space-y-3">
            {stepBreakdown.map(({ step, label, sent, total, rate }) => (
              <div key={step} className="flex items-center gap-4">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white" style={{ background: '#355E3B' }}>{step}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground truncate">{label}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{sent}/{total} sent</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, background: '#355E3B' }} />
                  </div>
                </div>
                <span className="text-xs font-semibold text-foreground w-10 text-right shrink-0">{rate}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by name, email, or case type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-4 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex items-center gap-1.5">
            {(['all', 'pending', 'sent', 'failed', 'skipped'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
              >
                {s === 'all' ? 'All' : STATUS_STYLE[s]?.label ?? s}
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Prospect</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Case Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Step</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Scheduled</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sent</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      {rows.length === 0 ? 'No intake nurture sequences yet. They will appear here after prospects submit the intake form.' : 'No results match your filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const style = STATUS_STYLE[row.send_status] ?? STATUS_STYLE.pending;
                    return (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground text-sm">{row.recipient_name}</p>
                          <p className="text-xs text-muted-foreground">{row.recipient_email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-foreground">{row.case_type}</p>
                          <p className="text-xs text-muted-foreground capitalize">{row.urgency}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: '#355E3B' }}>{row.step_number}</div>
                            <span className="text-xs text-foreground">{row.step_label ?? STEP_LABELS[row.step_number] ?? `Step ${row.step_number}`}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${style.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            {style.label}
                          </span>
                          {row.error_message && (
                            <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={row.error_message}>{row.error_message}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(row.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {row.sent_at ? new Date(row.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground">
              Showing {filtered.length} of {rows.length} sequence steps
            </div>
          )}
        </div>
      </div>
    );
  }

  const TAB_CONFIG = [
    {
      id: 'overview' as const,
      label: 'Overview',
      description: 'Live KPIs, open cases, pending invoices, new leads, messages & task deadlines',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      id: 'realtime_feed' as const,
      label: 'Live Feed',
      description: 'Real-time unified activity feed — incoming cases, appointments, emails, hours logged, and payment updates',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      id: 'operations' as const,
      label: 'Operations',
      description: 'Bookings, revenue, email delivery & reminder performance at a glance',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
    {
      id: 'inquiries' as const,label: 'Leads',description: 'Contact inquiries & lead management',
      badge: newLeadsCount > 0 ? newLeadsCount : null,
      badgeColor: 'bg-blue-500',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: 'bookings' as const,label: 'Bookings',description: 'Calendly bookings & consultation schedule',badge: null,badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
    },
    {
      id: 'payments' as const,label: 'Payments',description: 'Stripe transactions & revenue tracking',badge: null,badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
      ),
    },
    {
      id: 'reminders' as const,label: 'Reminders',description: 'Payment reminder sequences & invoice management',badge: null,badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ),
    },
    {
      id: 'sequences' as const,label: 'Nurture',description: 'Automated email sequences & follow-ups',badge: null,badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
    },
    {
      id: 'analytics' as const,label: 'Analytics',description: 'GA4 traffic, conversions & performance',badge: null,badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
    },
    {
      id: 'analytics_dashboard' as const,
      label: 'Analytics Dashboard',
      description: 'Revenue, bookings, and email performance in one view',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
    {
      id: 'documents' as const,label: 'Documents',description: 'Case document uploads & file management',badge: null,badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      id: 'cases' as const,
      label: 'Cases',
      description: 'Unified case management — status, invoices & communications',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      ),
    },
    {
      id: 'emails' as const,
      label: 'Follow-Ups',
      description: 'Prospect follow-up emails — status, open rates & click tracking',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
      ),
    },
    {
      id: 'consultations' as const,
      label: 'Consultations',
      description: 'Manage all booked consultations — reschedule, update status & notes',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: 'scheduled_consultations' as const,
      label: 'Scheduled Sessions',
      description: 'All booked sessions — date, client, duration, attendance status & follow-up actions',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/>
        </svg>
      ),
    },
    {
      id: 'consultation_availability' as const,
      label: 'Availability',
      description: 'Manage open slots, block time off, and set weekly office hours for consultations',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      id: 'testimonials' as const,
      label: 'Testimonials',
      description: 'Manage client testimonials — add, edit & remove',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      id: 'clients' as const,
      label: 'Clients',
      description: 'Invite clients to the portal & manage portal access',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
      ),
    },
    {
      id: 'client_profiles' as const,
      label: 'Client Profiles',
      description: 'Manage billing contacts — name, firm, email, rate, and retainer status',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: 'integrations' as const,
      label: 'Integrations',
      description: 'Connect third-party services — Google Calendar, and more',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      ),
    },
    {
      id: 'intake_nurture' as const,
      label: 'Intake Nurture',
      description: 'Automated multi-step nurture sequences triggered by intake form submissions',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
    },
    {
      id: 'prospect_scoring' as const,
      label: 'Lead Scores',
      description: 'Auto-scored prospects from intake forms — prioritize high-intent leads for personal outreach',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      ),
    },
    {
      id: 'billing_history' as const,
      label: 'Billing History',
      description: 'All client payment records, receipt downloads, and upcoming service timelines',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
    },
    {
      id: 'retainer_subscriptions' as const,
      label: 'Retainer Subscriptions',
      description: 'Manage recurring retainer billing, renewal status, and subscription lifecycle',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
      ),
    },
    {
      id: 'stripe_reconciliation' as const,
      label: 'Payment Reconciliation',
      description: 'Stripe payment confirmations matched against invoices — sync status, discrepancies, and failed payment retry logs',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M7 15h.01"/><path d="M11 15h2"/>
        </svg>
      ),
    },
    {
      id: 'retainer_invoice_scheduler' as const,
      label: 'Invoice Scheduler',
      description: 'Auto-generate invoices for retainer cases on a weekly, monthly, or custom schedule — with admin approval before sending',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
        </svg>
      ),
    },
    {
      id: 'retainer_balance' as const,
      label: 'Retainer Balances',
      description: 'View remaining retainer hours and funds per client — with depletion alerts and recent time log history',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    },
    {
      id: 'billable_hours' as const,
      label: 'Billable Hours',
      description: 'Log billable hours against active cases, record work type, and track retainer depletion',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      id: 'invoice_generator' as const,
      label: 'Invoice Generator',
      description: 'Manually generate, preview, and send invoices with itemized time logs, retainer charges, and payment terms',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      id: 'invoices' as const,
      label: 'Invoices',
      description: 'Create, send, track, and manage invoices linked to cases — with due dates, payment status, and automatic email reminders',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
      ),
    },
    {
      id: 'invoice_reminders' as const,
      label: 'Invoice Reminders',
      description: 'Schedule and manage automated invoice reminders — 7 days before due and 3 days after due date',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/>
        </svg>
      ),
    },
    {
      id: 'invoice_tracking' as const,
      label: 'Invoice Tracking',
      description: 'Track invoices tied to retainer balances, billable hours, and case work — with payment status and late-payment alerts',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      id: 'email_templates' as const,
      label: 'Email Templates',
      description: 'Edit branded email templates for invoices, reminders, case updates, and notifications — with live preview and Resend test send',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      ),
    },
    {
      id: 'billing_test' as const,
      label: 'Billing Test',
      description: 'Run end-to-end tests on payments, invoices, and retainer subscriptions',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      ),
    },
    {
      id: 'reporting' as const,
      label: 'Reporting',
      description: 'Total revenue, retainer hours consumed vs. available, outstanding invoice aging, and payment status breakdown',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
        </svg>
      ),
    },
    {
      id: 'practice_insights' as const,
      label: 'Practice Insights',
      description: 'Custom reports on cases by stage, revenue by service type, average turnaround time, and client retention metrics',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 20h20M5 20V10l7-7 7 7v10"/><path d="M9 20v-5h6v5"/>
        </svg>
      ),
    },
    {
      id: 'practice_analytics' as const,
      label: 'Practice Analytics',
      description: 'Revenue by matter type, avg matter duration, referral source tracking, realization rate, and utilization rate',
      badge: 'New',
      badgeColor: 'bg-green-100 text-green-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
        </svg>
      ),
    },
    {
      id: 'kanban' as const,
      label: 'Case Pipeline',
      description: 'Kanban board — drag clients across Intake, Active, Billed & Closed stages with per-case deliverable checklists',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="8" rx="1"/>
        </svg>
      ),
    },
    {
      id: 'tasks' as const,
      label: 'Tasks',
      description: 'Assign internal deliverables, set deadlines, and track completion status across all active cases',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
    },
    {
      id: 'notification_emails' as const,
      label: 'Notification Emails',
      description: 'Customize subject, body, and branding of case update, invoice, and task notification emails before they send to clients',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
    },
    {
      id: 'messages' as const,
      label: 'Messages',
      description: 'Direct messages between clients and Maggi May, linked to specific cases with read receipts',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: 'security' as const,
      label: 'Security',
      description: 'Manage two-factor authentication and admin account security settings',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      id: 'doc_templates' as const,
      label: 'Templates',
      description: 'Pre-built contract, retainer, and discovery templates that auto-populate with case and client details for quick Active stage setup',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      ),
    },
    {
      id: 'client_doc_templates' as const,
      label: 'Client Sign Docs',
      description: 'Pre-built retainer agreements, engagement letters, and case summaries — clients auto-fill via form and sign directly',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
        </svg>
      ),
    },
    {
      id: 'contracts_repository' as const,
      label: 'Contract Repository',
      description: 'Upload, manage, and share signed contracts and agreements with clients. Control visibility per document.',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      ),
    },
    {
      id: 'intake_analytics' as const,
      label: 'Intake Analytics',
      description: 'Submission trends by source, conversion rates by service type, and lead stage distribution',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
        </svg>
      ),
    },
    {
      id: 'intake_routing' as const,
      label: 'Intake Routing',
      description: 'Auto-route intake submissions to the right attorney by practice area, send confirmation emails, and pre-populate case records',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
    },
    {
      id: 'audit_trail' as const,
      label: 'Audit Trail',
      description: 'Searchable log of all admin actions — document uploads, invoice sends, case updates, and user logins — for compliance and accountability',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      ),
    },
    {
      id: 'routing_admin' as const,
      label: 'Routing Admin',
      description: 'Configure service-to-paralegal mappings, workload thresholds, skill-based routing priorities, and review suggestion accuracy metrics',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
      ),
    },
    {
      id: 'weekly_digest' as const,
      label: 'Weekly Digest',
      description: 'Send branded weekly email digests to clients summarizing case updates, action items, and invoice status',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
    },
    {
      id: 'scheduling' as const,
      label: 'Scheduling',
      description: 'Create and track deadlines, court dates, meetings, and case milestones — with portal sync and reminder notifications',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/>
        </svg>
      ),
    },
    {
      id: 'availability' as const,
      label: 'Availability',
      description: 'Block unavailable time slots for paralegals to prevent auto-routing from assigning new cases during court dates, meetings, or vacations',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
      ),
    },
    {
      id: 'growth_analytics' as const,
      label: 'Growth Analytics',
      description: 'Track website traffic, conversions, and performance metrics for business growth',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
        </svg>
      ),
    },
    {
      id: 'ga4_conversion' as const,
      label: 'GA4 Conversions',
      description: 'Conversion rates (inquiries → cases, appointments, payments), revenue by service, lead source performance, and pipeline bottleneck alerts',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      id: 'consultation_funnel' as const,
      label: 'Consultation Funnel',
      description: 'Funnel performance, booking conversion rates, traffic source attribution, and service-type lead quality',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
      ),
    },
    {
      id: 'booking_analytics' as const,
      label: 'Booking Analytics',
      description: 'Booking volume, show rates, conversion metrics, type breakdown, and source attribution',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
    },
    {
      id: 'strategic_analytics' as const,
      label: 'Strategic Analytics',
      description: 'Case type distribution, resolution time, revenue by category, team utilization heatmap, and case status trends — inform staffing and pricing strategy',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 8l3 3 2-2 3 3"/>
        </svg>
      ),
    },
    {
      id: 'notifications' as const,
      label: 'Notifications',
      description: 'Unified notification center — case updates, document changes, approval requests, and deadline alerts',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ),
    },
    {
      id: 'roster' as const,
      label: 'Roster',
      description: 'Create paralegal profiles, assign roles, manage permissions, and track utilization and billable hours',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: 'client_invoices_overview' as const,
      label: 'Client Invoices',
      description: 'All client invoices side-by-side — payment status, amounts received vs. due, and overdue alerts across retainer engagements',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      id: 'billing_ops_hub' as const,
      label: 'Billing Ops Hub',
      description: 'Secure entry point — invoice scheduler, payment reconciliation, digest sender, and late-payment alerts in one view',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
    },
    {
      id: 'billing' as const,
      label: 'Billing',
      description: 'Manage hourly rates, generate invoices, track revenue per matter, and view payment history',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M7 15h.01"/><path d="M11 15h2"/>
        </svg>
      ),
    },
    {
      id: 'contact_leads' as const,
      label: 'Contact Leads',
      description: 'Review contact submissions — tag by service interest & retainer tier, mark qualified/unqualified, track follow-up status',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
        </svg>
      ),
    },
    {
      id: 'hours_reporting' as const,
      label: 'Hours Report',
      description: 'Billable hours summary by attorney, client, and case — with date range filter and CSV export for payroll or billing',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
      ),
    },
    {
      id: 'financial_dashboard' as const,
      label: 'Financial Dashboard',
      description: 'Total revenue, payment method breakdown, pending invoices, case pipeline status, and key financial metrics',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    },
    {
      id: 'deliverables' as const,
      label: 'Deliverables',
      description: 'Track and manage case deliverables — intake documents, legal research, drafts, and filings with status and due dates',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      id: 'case_actions' as const,
      label: 'Case Actions',
      description: 'Sequential case actions — client meetings, research tasks, filing deadlines, and admin notes with timeline view and team assignments',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
    },
    {
      id: 'post_case_close' as const,
      label: 'Case Close Flow',
      description: 'Send post-case-close review requests, approve testimonials, and manage referral incentives',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
    },
    {
      id: 'lifecycle_emails' as const,
      label: 'Lifecycle Emails',
      description: 'Automated client emails for deliverable approvals, case stage changes, invoice issuance, and approaching deadlines',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
    },
    {
      id: 'transactional_emails' as const,
      label: 'Transactional Emails',
      description: 'Send branded client emails for case updates, invoice delivery, file shares, and stage changes via Resend',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 3.07 9.81a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 2 .18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
      ),
    },
    {
      id: 'email_nurture_templates' as const,
      label: 'Email Template Library',
      description: 'Reusable branded templates for nurture sequences, monthly case digests, and retainer renewal reminders',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
    },
    {
      id: 'realtime_feed' as const,
      label: 'Realtime Feed',
      description: 'Live updates on case activity, document uploads, and client interactions',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      ),
    },
    {
      id: 'ga4_conversion' as const,
      label: 'GA4 Conversion',
      description: 'GA4 conversion dashboard — traffic sources, booking funnel, service interest, and top pages',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
    },
    {
      id: 'portal_adoption' as const,
      label: 'Portal Adoption',
      description: 'Client portal login patterns, form submissions, document uploads, and invoice downloads — measure portal adoption and user engagement',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: 'iolta_ledger' as const,
      label: 'IOLTA Ledger',
      description: 'IOLTA trust account tracker — dedicated ledger, transaction log, and monthly reconciliation view',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M7 15h.01"/><path d="M11 15h2"/>
        </svg>
      ),
    },
    {
      id: 'lexi_admin_tools' as const,
      label: 'Lexi Tools',
      description: 'Conflict of interest checker and Lexi invoice draft approval queue',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
        </svg>
      ),
    },
    {
      id: 'lexi_assistant' as const,
      label: 'Lexi Assistant',
      description: 'AI-powered task assistant — chat with Lexi to create, manage, and prioritize your practice tasks',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      id: 'doc_extractor' as const,
      label: 'Document Extractor',
      description: 'AI-powered extraction of key dates, parties, clauses, and obligations from legal documents',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="11" cy="15" r="3"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      ),
    },
    {
      id: 'lexi_document_drafts' as const,
      label: 'Document Drafts',
      description: 'Review, edit, approve, and send AI-generated legal document drafts from Lexi',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      id: 'monthly_reports' as const,
      label: 'Monthly Reports',
      description: 'Auto-generated monthly business reports — revenue, hours, cases, and collection rate',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
    },
    {
      id: 'referral_claims' as const,
      label: 'Referral Claims',
      description: 'Manage incentive claims from referred clients — approve, reject, and mark as paid',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: 'legal_doc_templates' as const,
      label: 'Doc Templates',
      description: 'Create and manage legal document templates per practice area for Lexi to use when auto-drafting',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
      ),
    },
    {
      id: 'paralegal_hours' as const,
      label: 'Paralegal Hours',
      description: 'Paralegals log billable hours against cases with task, duration, and hourly rate — Lexi auto-drafts invoices for admin approval',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      id: 'event_notifications' as const,
      label: 'Event Notifications',
      description: 'Configure which events trigger client email notifications — documents sent, cases updated, invoices due, and more',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ),
    },
    {
      id: 'matter_profitability' as const,
      label: 'Profitability',
      description: 'Matter profitability report — revenue, collections, and gross profit by matter and practice area',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    },
    {
      id: 'matter_time_logger' as const,
      label: 'Time Logger',
      description: 'Log billable and write-off hours per matter with date, duration, description, and task category',
      badge: 'New',
      badgeColor: 'bg-blue-100 text-blue-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      id: 'matter_invoice_builder' as const,
      label: 'Invoice Builder',
      description: 'Create invoices from matter time logs, send via email, track payment status, mark paid/partial, and reconcile with Stripe',
      badge: 'New',
      badgeColor: 'bg-amber-100 text-amber-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      id: 'cash_position' as const,
      label: 'Cash Projection',
      description: 'Project monthly cash position by analyzing invoice age, payment velocity, and outstanding AR trends',
      badge: 'New',
      badgeColor: 'bg-blue-100 text-blue-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
        </svg>
      ),
    },
    {
      id: 'court_deadlines' as const,
      label: 'Deadline Calendar',
      description: 'Court deadline calendar — all matter deadlines, SOL dates, and hearing dates in one view',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
    },
    {
      id: 'staff_time' as const,
      label: 'Staff Time',
      description: 'Staff time tracking dashboard — paralegal utilization, billable vs. non-billable hours, and productivity',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      id: 'webhooks' as const,
      label: 'Webhooks',
      description: 'Outbound webhooks — push case, invoice, and booking events to Zapier or any external tool',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      ),
    },
    {
      id: 'nps_surveys' as const,
      label: 'NPS Surveys',
      description: 'Post-matter client satisfaction surveys — NPS tracking, feedback, and referral intent',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
    },
    {
      id: 'retainer_alerts' as const,
      label: 'Retainer Alerts',
      description: 'Retainer balance alerts — auto-notify clients and admin when retainer drops below threshold',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ),
    },
    {
      id: 'secure_sharing' as const,
      label: 'Secure Sharing',
      description: 'Secure document sharing with expiring links — share sensitive files with time-limited access, no login required',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      ),
    },
    {
      id: 'intake_templates' as const,
      label: 'Intake Templates',
      description: 'Pre-built intake templates for family law, litigation, contract review, and more — auto-populate fields, default tasks, and linked court deadlines for faster case creation',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      ),
    },
    {
      id: 'intake_reminders' as const,
      label: 'Intake Reminders',
      description: 'Schedule and send intake reminder emails to leads with pending forms. Auto-generates a new matter with pre-filled case type, client contact, retainer amount, and first time log when intake is marked complete.',
      badge: 'New',
      badgeColor: 'bg-purple-100 text-purple-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ),
    },
    {
      id: 'reporting_exports' as const,
      label: 'Reporting Exports',
      description: 'Export reports to CSV — cases, revenue by matter, invoices, billable hours, court deadlines, tasks, payments, NPS, and audit logs',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      ),
    },
    {
      id: 'billable_allocation' as const,
      label: 'Hours Allocation',
      description: 'Billable hours, utilization %, and rate distribution across active matters — over/under-allocated staff recommendations and rate-mismatch opportunities',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
    },
    {
      id: 'practice_kpi' as const,
      label: 'KPI Dashboard',
      description: 'Centralized KPI tracking — practice revenue trends, client acquisition sources, matter conversion rates, and billing efficiency across all matters',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
        </svg>
      ),
    },
    {
      id: 'email_reminders' as const,
      label: 'Email Reminders',
      description: 'Send automated case updates, invoice reminders, and document request confirmations via Resend to clients and staff',
      badge: 'Resend',
      badgeColor: 'bg-violet-100 text-violet-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
    },
    {
      id: 'submissions_inbox' as const,
      label: 'Submissions Inbox',
      description: 'View all contact form submissions and Lexi conversation history — searchable by date and service type',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        </svg>
      ),
    },
    {
      id: 'assistant_conversations' as const,
      label: 'AI Conversations',
      description: 'View all synced AI paralegal chat sessions, lead metadata, and full interaction history from the legal assistant',
      badge: 'New',
      badgeColor: 'bg-violet-100 text-violet-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      id: 'sms_reminders' as const,
      label: 'SMS Reminders',
      description: 'Send urgent matter deadline and overdue payment reminders via Twilio SMS to clients and staff for real-time visibility',
      badge: 'Twilio',
      badgeColor: 'bg-red-100 text-red-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.42 2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16.92z"/>
        </svg>
      ),
    },
    {
      id: 'client_task_portal' as const,
      label: 'Client Tasks',
      description: 'Assign and track tasks for active clients — manage pending, in-progress, and completed deliverables with Resend email alerts',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
    },
    {
      id: 'consultation_admin' as const,
      label: 'Consultation Admin',
      description: 'Manage all consultations — update status, booking stage, notes, and send client alerts from a single view',
      badge: 'New',
      badgeColor: 'bg-blue-100 text-blue-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: 'case_studies_manager' as const,
      label: 'Case Studies',
      description: 'Create, edit, and publish case studies — manage title, client, service tag, complexity, outcome, and summary',
      badge: 'New',
      badgeColor: 'bg-amber-100 text-amber-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      ),
    },
    {
      id: 'lead_nurture' as const,
      label: 'Lead Nurture',
      description: 'Automated follow-up sequences triggered by form submissions and abandoned bookings — nurture leads until conversion',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      ),
    },
    {
      id: 'calendly_pipeline' as const,
      label: 'Calendly Pipeline',
      description: 'All Calendly bookings for the next 30 days — attendee, service interest, lead score, and prep/reminder actions with auto hot-lead flagging',
      badge: 'New',
      badgeColor: 'bg-red-100 text-red-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/>
        </svg>
      ),
    },
    {
      id: 'conversion_funnel' as const,
      label: 'Conversion Funnel',
      description: 'Full visitor-to-client pipeline — inquiry → booking → payment → active client, with GA4 data, source attribution, and AI-powered insights',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
      ),
    },
    {
      id: 'client_dashboard_view' as const,
      label: 'Client Dashboard',
      description: 'Admin view of all client portal data — cases, invoices, documents, action items, and AI-powered email/SMS drafting per client',
      badge: 'New',
      badgeColor: 'bg-blue-100 text-blue-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: 'retainer_doc_analyzer' as const,
      label: 'Retainer Doc Analyzer',
      description: 'AI-powered analysis of retainer agreements and case summaries — extract scope, deadlines, opposing counsel, estimated hours, and flag urgent action items',
      badge: 'AI',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
    },
    {
      id: 'client_intake_forms' as const,
      label: 'Client Intake Forms',
      description: 'Manage client intake submissions, review new inquiries, track urgency and conversion status',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 12h6M9 16h4"/>
        </svg>
      ),
    },
    {
      id: 'engagement_letters' as const,
      label: 'Engagement Letters',
      description: 'Auto-generated engagement letters after deposit — track digital signatures, copy signing links, and manage client agreements',
      badge: 'New',
      badgeColor: 'bg-amber-100 text-amber-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M17 13l-5 5-2-2"/><line x1="9" y1="9" x2="15" y2="9"/>
        </svg>
      ),
    },
    {
      id: 'gemini_case_analyzer' as const,
      label: 'Gemini Case Analyzer',
      description: 'AI-powered analysis of case files and retainer docs — surface deadlines, action items, retainer milestones, and auto-draft client status emails',
      badge: 'AI',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
      ),
    },
    {
      id: 'email_sms_templates' as const,
      label: 'Email & SMS Templates',
      description: 'Create, edit, and send branded email and SMS communication templates — with variable substitution, preview, and test send',
      badge: 'New',
      badgeColor: 'bg-blue-100 text-blue-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
    },
    {
      id: 'active_cases' as const,
      label: 'Active Cases',
      description: 'Central view of all active cases — status, client, retainer amount, upcoming deadlines, and one-click access to documents, timeline, messages & invoices',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      ),
    },
    {
      id: 'realtime_case_notifications' as const,
      label: 'Case Notifications',
      description: 'Real-time case activity notifications with AI-generated content — compose, send, and track case alerts across all active matters',
      badge: 'AI',
      badgeColor: 'bg-violet-100 text-violet-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><circle cx="12" cy="3" r="1" fill="currentColor"/>
        </svg>
      ),
    },
    {
      id: 'doc_esignature_manager' as const,
      label: 'E-Signature Manager',
      description: 'Document e-signature manager — create, send, and track digital signature requests with full audit trail and signing link management',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      ),
    },
    {
      id: 'retainer_invoice_automation' as const,
      label: 'Invoice Automation',
      description: 'Automated retainer-based invoicing — configure billing rules, manage invoice queue, and auto-generate invoices on schedule',
      badge: 'New',
      badgeColor: 'bg-amber-100 text-amber-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
        </svg>
      ),
    },
    {
      id: 'caseflow_manager' as const,
      label: 'CaseFlow Manager',
      description: 'Visual case pipeline — track every matter from inquiry to close with billing status, deadlines, documents, messages, and one-click access to all case details',
      badge: 'New',
      badgeColor: 'bg-primary/10 text-primary',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      ),
    },
    {
      id: 'client_communication_hub' as const,
      label: 'Communication Hub',
      description: 'Centralized client messaging threads, broadcast emails/SMS, quick reply templates, and full communication logs',
      badge: 'New',
      badgeColor: 'bg-blue-100 text-blue-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
id: 'retainer_renewal_notifications' as const,
      label: 'Renewal Notifications',
      description: 'Automated 30-day retainer renewal alerts via email & SMS, client acceptance flow, and Stripe auto-rebill configuration',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ),
    },
    {
      id: 'notion_integration' as const,
      label: 'Notion',
      description: 'Browse, search, and create Notion pages — sync workspace notes directly to client case files',
      badge: null,
      badgeColor: '',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M6 5h8.5L18 8.5V19H6V5z"/><path d="M14 5v4h4"/>
          <line x1="9" y1="11" x2="15" y2="11" strokeLinecap="round"/><line x1="9" y1="14" x2="15" y2="14" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      id: 'time_entry' as const,
      label: 'Time Entry',
      description: 'Log billable hours per case and auto-roll up into retainer invoices for accurate billing',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      id: 'case_file_repository' as const,
      label: 'File Repository',
      description: 'Secure per-case file repository — upload discovery docs, pleadings, correspondence, and evidence; control client access with audit trail',
      badge: 'New',
      badgeColor: 'bg-indigo-100 text-indigo-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      id: 'case_pipeline' as const,
      label: 'Case Pipeline',
      description: 'Visual drag-and-drop case pipeline — move cases between stages, see deadline alerts, and filter by status',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="8" rx="1"/>
        </svg>
      ),
    },
    {
      id: 'admin_kpi' as const,
      label: 'KPI Dashboard',
      description: 'Comprehensive practice KPIs — revenue trends, case pipeline, collection rates, lead conversion, and operational alerts',
      badge: 'New',
      badgeColor: 'bg-blue-100 text-blue-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
        </svg>
      ),
    },
    {
      id: 'case_calendar' as const,
      label: 'Case Calendar',
      description: 'Monthly calendar view of all case deadlines, consultations, intakes, and retainer renewals',
      badge: 'New',
      badgeColor: 'bg-purple-100 text-purple-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
    },
    {
      id: 'automated_intake' as const,
      label: 'Automated Intake',
      description: 'Configure and monitor automated client intake workflows — email sequences, lead scoring, and intake routing',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/><path d="M22 2 12 12"/><path d="m17 2 5 5-5 5"/>
        </svg>
      ),
    },
    {
      id: 'client_journey_automation' as const,
      label: 'Client Journey',
      description: 'Conditional triggers (service type, intake source, urgency) and multi-step sequences (consultation reminders, retainer reminders, follow-up surveys)',
      badge: 'New',
      badgeColor: 'bg-violet-100 text-violet-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h4l3-9 4 18 3-9h4"/><circle cx="12" cy="12" r="1"/>
        </svg>
      ),
    },
    {
      id: 'document_management' as const,
      label: 'Document Management',
      description: 'Centralized repository for all legal documents, case files, contracts, and reports — upload, categorize, search, and download',
      badge: 'New',
      badgeColor: 'bg-teal-100 text-teal-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      id: 'practice_management_suite' as const,
      label: 'Practice Suite',
      description: 'Full practice management — live billing timer, time tracking, invoice builder, contract templates, and document organization in one place',
      badge: 'Clio-style',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      id: 'ai_legal_secretary' as const,
      label: 'AI Secretary',
      description: 'AI-powered legal secretary integrated throughout billable hours and practice management — admin-only, with employee seat management for future billing',
      badge: 'AI',
      badgeColor: 'bg-emerald-600 text-white',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/><path d="M22 2 12 12"/><path d="m17 2 5 5-5 5"/>
        </svg>
      ),
    },
    {
      id: 'team_admin' as const,
      label: 'Team Admin',
      description: 'Manage team members, assign roles, and control access permissions for paralegals, legal assistants, and staff',
      badge: 'Admin',
      badgeColor: 'bg-[#1B2A4A] text-white',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    // Ops Hub tab rendered via practice_management_suite tab override below
  ];

  const activeTabConfig = TAB_CONFIG.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Admin Top Bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 md:px-10">
          {/* Top row: breadcrumb + actions */}
          <div className="flex items-center justify-between py-3 gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
              <span className="font-semibold text-foreground hidden sm:inline truncate">Maggi May Broussard</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 hidden sm:block shrink-0">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <span className="hidden sm:inline">Admin</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 hidden sm:block shrink-0">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <span className="text-foreground font-medium truncate max-w-[120px] sm:max-w-none">{activeTabConfig?.label}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {newLeadsCount > 0 && (
                <button
                  onClick={() => setActiveTab('inquiries')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="hidden sm:inline">{newLeadsCount} new {newLeadsCount === 1 ? 'lead' : 'leads'}</span>
                  <span className="sm:hidden">{newLeadsCount}</span>
                </button>
              )}
              <a
                href="/"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <span className="hidden sm:inline">View Site</span>
              </a>
              <a
                href="/admin/contact-submissions"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span className="hidden sm:inline">Submissions</span>
              </a>
              <a
                href="/admin/analytics"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                <span className="hidden sm:inline">Analytics</span>
              </a>
              <a
                href="/admin/account"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <span className="hidden sm:inline">Account</span>
              </a>
              <LexiNotificationBell />
            </div>
          </div>

          {/* Tab navigation row */}
          <div className="flex items-center gap-0.5 py-1 overflow-x-auto scrollbar-hide">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); trackAdminTabVisit(tab.id, tab.label); }}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all duration-200 whitespace-nowrap rounded-lg ${
                  activeTab === tab.id
                    ? 'text-foreground bg-secondary/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                }`}
              >
                <span className={activeTab === tab.id ? 'text-primary' : 'opacity-60'}>{tab.icon}</span>
                {tab.label}
                {tab.badge !== null && (
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] font-bold ${tab.badgeColor}`}>
                    {tab.badge}
                  </span>
                )}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full" style={{ background: '#355E3B' }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 pt-8 pb-16">

        {/* KPI Cards */}
        <KPICards />

        {/* Section header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl text-foreground mb-1">{activeTabConfig?.label}</h1>
            <p className="text-sm text-muted-foreground font-light">{activeTabConfig?.description}</p>
          </div>
          {activeTab === 'inquiries' && (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>{counts['new'] ?? 0} New</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>{counts['in_review'] ?? 0} In Review</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>{counts['contacted'] ?? 0} Contacted</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <AdminSummaryWidget onNavigate={(tab) => setActiveTab(tab as typeof activeTab)} />
            <AdminOverviewDashboard onNavigate={(tab) => setActiveTab(tab as typeof activeTab)} />
          </div>
        )}

        {/* ── Operations Tab ── */}
        {activeTab === 'operations' && <OperationsDashboard />}

        {/* ── Bookings Tab ── */}
        {activeTab === 'bookings' && <BookingsDashboard />}

        {/* ── Payments Tab ── */}
        {activeTab === 'payments' && <PaymentsDashboard />}

        {/* ── Reminders Tab ── */}
        {activeTab === 'reminders' && <PaymentRemindersDashboard />}

        {/* ── Analytics Tab ── */}
        {activeTab === 'analytics' && <AnalyticsDashboard />}

        {/* ── Analytics Dashboard Tab ── */}
        {activeTab === 'analytics_dashboard' && <AdminAnalyticsDashboard />}

        {/* ── Sequences Tab ── */}
        {activeTab === 'sequences' && <SequencesDashboard />}

        {/* ── Documents Tab ── */}
        {activeTab === 'documents' && <CaseDocumentsDashboard />}

        {/* ── Cases Tab ── */}
        {activeTab === 'cases' && <CaseManagementDashboard />}

        {/* ── Follow-Up Emails Tab ── */}
        {activeTab === 'emails' && <ProspectEmailsDashboard />}

        {/* ── Intake Nurture Tab ── */}
        {activeTab === 'intake_nurture' && <IntakeNurtureDashboard />}

        {/* ── Prospect Scoring Tab ── */}
        {activeTab === 'prospect_scoring' && <ProspectScoringDashboard />}

        {/* ── Billing History Tab ── */}
        {activeTab === 'billing_history' && <BillingHistoryDashboard />}

        {/* ── Retainer Subscriptions Tab ── */}
        {activeTab === 'retainer_subscriptions' && <RetainerSubscriptionsDashboard />}

        {/* ── Retainer Invoice Scheduler Tab ── */}
        {activeTab === 'retainer_invoice_scheduler' && <RetainerInvoiceScheduler />}

        {/* ── Stripe Payment Reconciliation Tab ── */}
        {activeTab === 'stripe_reconciliation' && <StripePaymentReconciliationDashboard />}

        {/* ── Retainer Balance Tracker Tab ── */}
        {activeTab === 'retainer_balance' && <RetainerBalanceTracker />}

        {/* ── Billable Hours Tab ── */}
        {activeTab === 'billable_hours' && <ParalegalBillableHoursLogger />}

        {/* ── Invoice Generator Tab ── */}
        {activeTab === 'invoice_generator' && <InvoiceGeneratorDashboard />}

        {/* ── Invoices Management Tab ── */}
        {activeTab === 'invoices' && <AdminInvoiceManagement />}

        {/* ── Invoice Reminders Tab ── */}
        {activeTab === 'invoice_reminders' && <InvoiceGeneratorDashboard />}

        {/* ── Invoice Tracking Tab ── */}
        {activeTab === 'invoice_tracking' && <InvoiceTrackingDashboard />}

        {/* ── Client Invoices Overview Tab ── */}
        {activeTab === 'client_invoices_overview' && (
          <div className="space-y-4">
            <div className="px-6 pt-4">
              <a
                href="/admin/client-invoice-portal"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#355E3B' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
                Open Full Invoice Portal
              </a>
            </div>
            <ClientInvoicesDashboard />
          </div>
        )}

        {/* ── Email Templates Tab ── */}
        {activeTab === 'email_templates' && <EmailTemplatesDashboard />}

        {/* ── Billing Test Tab ── */}
        {activeTab === 'billing_test' && <BillingTestDashboard />}

        {/* ── Reporting Tab ── */}
        {activeTab === 'reporting' && <ReportingDashboard />}

        {/* ── Practice Insights Tab ── */}
        {activeTab === 'practice_insights' && <PracticeInsightsDashboard />}

        {/* ── Practice Analytics Tab ── */}
        {activeTab === 'practice_analytics' && <PracticeAnalyticsDashboard />}

        {/* ── Kanban Pipeline Tab ── */}
        {activeTab === 'kanban' && <KanbanBoard />}

        {/* ── Tasks Tab ── */}
        {activeTab === 'tasks' && <TasksDashboard />}

        {/* ── Notification Emails Tab ── */}
        {activeTab === 'notification_emails' && <NotificationEmailComposer />}

        {/* ── Messages Tab ── */}
        {activeTab === 'messages' && <AdminMessagesDashboard />}

        {/* ── Security Tab ── */}
        {activeTab === 'security' && <AdminSecurityDashboard />}

        {/* ── Document Templates Tab ── */}
        {activeTab === 'doc_templates' && <ContractTemplatesDashboard />}

        {/* ── Client Sign Docs Tab ── */}
        {activeTab === 'client_doc_templates' && <ClientDocumentTemplatesDashboard />}

        {/* ── Contracts Repository Tab ── */}
        {activeTab === 'contracts_repository' && <ContractsRepositoryDashboard />}

        {/* ── Intake Analytics Tab ── */}
        {activeTab === 'intake_analytics' && <IntakeAnalyticsDashboard />}

        {/* ── Intake Routing Tab ── */}
        {activeTab === 'intake_routing' && <IntakeRoutingDashboard />}

        {/* ── Audit Trail Tab ── */}
        {activeTab === 'audit_trail' && <AuditTrailDashboard />}

        {/* ── Routing Admin Tab ── */}
        {activeTab === 'routing_admin' && <RoutingAdminPanel />}

        {/* ── Weekly Digest Tab ── */}
        {activeTab === 'weekly_digest' && <WeeklyDigestDashboard />}

        {/* ── Scheduling Tab ── */}
        {activeTab === 'scheduling' && <SchedulingDashboard />}

        {/* ── Availability Tab ── */}
        {activeTab === 'availability' && <ParalegalAvailabilityCalendar />}

        {/* ── Growth Analytics Tab ── */}
        {activeTab === 'growth_analytics' && <GrowthAnalyticsDashboard />}

        {/* ── GA4 Conversion Dashboard Tab ── */}
        {activeTab === 'ga4_conversion' && <GA4ConversionDashboard />}

        {/* ── Portal Adoption Dashboard Tab ── */}
        {activeTab === 'portal_adoption' && <PortalAdoptionDashboard />}

        {/* ── Consultation Funnel Tab ── */}
        {activeTab === 'consultation_funnel' && <ConsultationFunnelAnalyticsDashboard />}

        {/* ── Booking Analytics Tab ── */}
        {activeTab === 'booking_analytics' && (
          <div className="p-6">
            <BookingAnalyticsDashboard />
          </div>
        )}

        {/* ── Strategic Analytics Tab ── */}
        {activeTab === 'strategic_analytics' && <StrategicAnalyticsDashboard />}

        {/* ── Notifications Tab ── */}
        {activeTab === 'notifications' && <NotificationCenter audience="admin" />}

        {/* ── Roster Tab ── */}
        {activeTab === 'roster' && <ParalegalRosterDashboard />}

        {/* ── Billing Ops Hub Tab ── */}
        {activeTab === ('admin_ops_hub' as string) && (
          <div className="p-6">
            <AdminOperationsHub />
          </div>
        )}

        {/* ── Billing Tab ── */}
        {activeTab === 'billing' && (
          <div className="p-6">
            <AdminBillingTab />
          </div>
        )}

        {/* ── Contact Leads Tab ── */}
        {activeTab === 'contact_leads' && <ContactInquiriesAdminDashboard />}

        {/* ── Hours Reporting Tab ── */}
        {activeTab === 'hours_reporting' && <BillableHoursReportingDashboard />}

        {/* ── Financial Dashboard Tab ── */}
        {activeTab === 'financial_dashboard' && <FinancialDashboard />}

        {/* ── Deliverables Tab ── */}
        {activeTab === 'deliverables' && <CaseDeliverablesDashboard />}

        {/* ── Case Actions Tab ── */}
        {activeTab === 'case_actions' && <CaseActionsTimeline />}

        {/* ── Post-Case-Close Flow Tab ── */}
        {activeTab === 'post_case_close' && <PostCaseCloseFlowDashboard />}

        {/* ── Case Lifecycle Emails Tab ── */}
        {activeTab === 'lifecycle_emails' && <CaseLifecycleEmailsDashboard />}

        {/* ── Transactional Email Center Tab ── */}
        {activeTab === 'transactional_emails' && <TransactionalEmailCenter />}

        {/* ── Email Nurture Template Library Tab ── */}
        {activeTab === 'email_nurture_templates' && <EmailNurtureTemplateLibrary />}

        {/* ── Live Realtime Feed Tab ── */}
        {activeTab === 'realtime_feed' && <RealtimeFeedDashboard />}

        {/* ── IOLTA Trust Ledger Tab ── */}
        {activeTab === 'iolta_ledger' && <IOLTATrustLedger />}

        {/* ── Lexi Admin Tools Tab ── */}
        {activeTab === 'lexi_admin_tools' && <LexiAdminTools />}

        {/* ── Legal Document Extractor Tab ── */}
        {activeTab === 'doc_extractor' && <LegalDocumentExtractor />}

        {/* ── Lexi Document Drafts Tab ── */}
        {activeTab === 'lexi_document_drafts' && <LexiDocumentDraftsDashboard />}

        {/* ── Monthly Reports Tab ── */}
        {activeTab === 'monthly_reports' && <MonthlyReportDashboard />}

        {/* ── Referral Claims Tab ── */}
        {activeTab === 'referral_claims' && <ReferralClaimsDashboard />}

        {/* ── Legal Document Templates Tab ── */}
        {activeTab === 'legal_doc_templates' && <LegalDocumentTemplatesDashboard />}

        {/* ── Paralegal Billable Hours Tab ── */}
        {activeTab === 'paralegal_hours' && <ParalegalBillableHoursLogger />}

        {/* ── Event Notification Config Tab ── */}
        {activeTab === 'event_notifications' && <EventNotificationConfigDashboard />}

        {/* ── Matter Profitability Tab ── */}
        {activeTab === 'matter_profitability' && <MatterProfitabilityReport />}

        {/* ── Matter Time Logger Tab ── */}
        {activeTab === 'matter_time_logger' && <MatterTimeLogger />}

        {/* ── Matter Invoice Builder Tab ── */}
        {activeTab === 'matter_invoice_builder' && <MatterInvoiceBuilder />}

        {/* ── Cash Position Projection Tab ── */}
        {activeTab === 'cash_position' && <CashPositionProjectionDashboard />}

        {/* ── Court Deadline Calendar Tab ── */}
        {activeTab === 'court_deadlines' && <CourtDeadlineCalendar />}

        {/* ── Staff Time Tracking Tab ── */}
        {activeTab === 'staff_time' && <StaffTimeTrackingDashboard />}

        {/* ── Outbound Webhooks Tab ── */}
        {activeTab === 'webhooks' && <OutboundWebhooksDashboard />}

        {/* ── NPS Surveys Tab ── */}
        {activeTab === 'nps_surveys' && <NPSSurveyDashboard />}

        {/* ── Retainer Alerts Tab ── */}
        {activeTab === 'retainer_alerts' && <RetainerAlertsDashboard />}

        {/* ── Secure Document Sharing Tab ── */}
        {activeTab === 'secure_sharing' && <SecureDocumentSharing />}

        {/* ── Intake Templates Tab ── */}
        {activeTab === 'intake_templates' && <IntakeTemplatesDashboard />}

        {/* ── Intake Reminders & Auto-Matters Tab ── */}
        {activeTab === 'intake_reminders' && (
          <div className="p-6">
            <IntakeReminderScheduler />
          </div>
        )}

        {/* ── Reporting Exports Tab ── */}
        {activeTab === 'reporting_exports' && <AdminReportingExports />}

        {/* ── Billable Hours Allocation Tab ── */}
        {activeTab === 'billable_allocation' && <BillableHoursAllocationDashboard />}

        {/* ── Practice KPI Dashboard Tab ── */}
        {activeTab === 'practice_kpi' && <PracticeKPIDashboard />}

        {/* ── SMS Reminders Tab ── */}
        {activeTab === 'sms_reminders' && <SMSRemindersDashboard />}

        {/* ── Submissions Inbox Tab ── */}
        {activeTab === 'submissions_inbox' && <SubmissionsInboxDashboard />}

        {/* ── Assistant Conversations Tab ── */}
        {activeTab === 'assistant_conversations' && <AssistantConversationsDashboard />}

        {/* ── Lexi Task Assistant Tab ── */}
        {activeTab === 'lexi_assistant' && <LexiTaskAssistant />}

        {/* ── Client Task Portal Tab ── */}
        {activeTab === 'client_task_portal' && <ClientTaskPortal />}

        {/* ── Consultation Admin Tab ── */}
        {activeTab === 'consultation_admin' && (
          <ConsultationAdminScreen />
        )}

        {/* ── Case Studies Manager Tab ── */}
        {activeTab === 'case_studies_manager' && (
          <CaseStudiesManager />
        )}

        {/* ── Lead Nurture Sequences Tab ── */}
        {activeTab === 'lead_nurture' && <LeadNurtureSequencesDashboard />}

        {/* ── Calendly Pipeline Tab ── */}
        {activeTab === 'calendly_pipeline' && <CalendlyPipelineDashboard />}

        {/* ── Conversion Funnel Tab ── */}
        {activeTab === 'conversion_funnel' && <ConversionFunnelDashboard />}

        {/* ── Client Dashboard View Tab ── */}
        {activeTab === 'client_dashboard_view' && <AdminClientDashboardView />}

        {/* ── Retainer Doc Analyzer Tab ── */}
        {activeTab === 'retainer_doc_analyzer' && <RetainerDocAnalyzerDashboard />}

        {/* ── Client Intake Forms Tab ── */}
        {activeTab === 'client_intake_forms' && <ClientIntakeFormsDashboard />}

        {/* ── Engagement Letters Tab ── */}
        {activeTab === 'engagement_letters' && <EngagementLettersDashboard />}

        {/* ── Gemini Case Analyzer Tab ── */}
        {activeTab === 'gemini_case_analyzer' && <GeminiCaseAnalyzerDashboard />}

        {/* ── Email & SMS Templates Tab ── */}
        {activeTab === 'email_sms_templates' && <EmailSMSTemplateManager />}

        {/* ── Active Cases Tab ── */}
        {activeTab === 'active_cases' && <ActiveCasesDashboard />}

        {/* ── Realtime Case Notifications Tab ── */}
        {activeTab === 'realtime_case_notifications' && <RealtimeCaseNotificationsDashboard />}

        {/* ── Document E-Signature Manager Tab ── */}
        {activeTab === 'doc_esignature_manager' && <DocumentESignatureManager />}

        {/* ── Retainer Invoice Automation Tab ── */}
        {activeTab === 'retainer_invoice_automation' && <RetainerInvoiceAutomationDashboard />}

        {/* ── CaseFlow Manager Tab ── */}
        {activeTab === 'caseflow_manager' && <CaseFlowManager />}

        {/* ── Retainer Renewal Notifications Tab ── */}
        {activeTab === 'retainer_renewal_notifications' && <RetainerRenewalNotificationsDashboard />}

        {/* ── Client Communication Hub Tab ── */}
        {activeTab === 'client_communication_hub' && <ClientCommunicationHub />}

        {/* ── Notion Integration Tab ── */}
        {activeTab === 'notion_integration' && <NotionIntegrationDashboard />}

        {/* ── Time Entry Module Tab ── */}
        {activeTab === 'time_entry' && (
          <div className="p-6">
            <TimeEntryModule />
          </div>
        )}

        {/* ── Case File Repository Tab ── */}
        {activeTab === 'case_file_repository' && <CaseFileRepository />}

        {/* ── Case Pipeline Timeline Tab ── */}
        {activeTab === 'case_pipeline' && (
          <div className="p-6">
            <CasePipelineTimeline />
          </div>
        )}

        {/* ── Admin KPI Dashboard Tab ── */}
        {activeTab === 'admin_kpi' && (
          <div className="p-6">
            <AdminKPIDashboard onNavigate={(tab) => setActiveTab(tab as typeof activeTab)} />
          </div>
        )}

        {/* ── Case Calendar Tab ── */}
        {activeTab === 'case_calendar' && (
          <div className="p-6">
            <CaseCalendar />
          </div>
        )}

        {/* ── Automated Intake Tab ── */}
        {activeTab === 'automated_intake' && (
          <div className="p-6">
            <AutomatedIntakeDashboard />
          </div>
        )}

        {/* ── Client Journey Automation Tab ── */}
        {activeTab === 'client_journey_automation' && (
          <div className="p-6">
            <ClientJourneyAutomationDashboard />
          </div>
        )}

        {/* ── Document Management Tab ── */}
        {activeTab === 'document_management' && (
          <div className="p-6">
            <DocumentManagementDashboard />
          </div>
        )}

        {/* ── Practice Management Suite Tab ── */}
        {activeTab === 'practice_management_suite' && <PracticeManagementSuite />}

        {/* ── AI Legal Secretary Tab ── */}
        {activeTab === 'ai_legal_secretary' && (
          <div className="p-6">
            <AILegalSecretaryDashboard />
          </div>
        )}

        {/* ── Team Admin Tab ── */}
        {activeTab === 'team_admin' && (
          <div className="p-6">
            <TeamPermissionsDashboard />
          </div>
        )}

        {/* ── Admin Ops Hub Tab ── */}
        {activeTab === ('admin_ops_hub' as string) && (
          <div className="p-6">
            <AdminOperationsHub />
          </div>
        )}

        {/* ── Email Reminders Tab ── */}
        {activeTab === 'email_reminders' && <EmailRemindersDashboard />}

        {/* ── Consultations Tab ── */}
        {activeTab === 'consultations' && (
          <div className="space-y-6">
            <div className="p-6">
              <GoogleCalendarBookingPanel />
            </div>
            <ConsultationLeadsBoard />
            <ConsultationsAdminBoard />
          </div>
        )}

        {/* ── Scheduled Consultations Tab ── */}
        {activeTab === 'scheduled_consultations' && (
          <div className="p-6">
            <ScheduledConsultationsDashboard />
          </div>
        )}

        {/* ── Consultation Availability Tab ── */}
        {activeTab === 'consultation_availability' && (
          <div className="p-6">
            <ConsultationAvailabilityManager />
          </div>
        )}

        {/* ── Testimonials Tab ── */}
        {activeTab === 'testimonials' && <TestimonialsDashboard />}

        {/* ── Clients Tab ── */}
        {activeTab === 'clients' && <ClientsTab />}

        {/* ── Client Profiles Tab ── */}
        {activeTab === 'client_profiles' && (
          <div className="p-6">
            <ClientProfilesManager />
          </div>
        )}

        {/* ── Integrations Tab ── */}
        {activeTab === 'integrations' && <IntegrationSettingsHub />}

        {/* ── Inquiries Tab ── */}
        {activeTab === 'inquiries' && (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                  className={`bg-card border rounded-xl p-4 text-left transition-all duration-200 hover:border-accent/50 ${
                    statusFilter === s ? 'border-accent ring-1 ring-accent/30' : 'border-border'
                  }`}
                >
                  <p className="text-2xl font-semibold text-foreground">{counts[s] ?? 0}</p>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{STATUS_LABELS[s]}</p>
                </button>
              ))}
            </div>

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50"
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, email, firm, service…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none cursor-pointer min-w-[140px]"
              >
                <option value="all">All Statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              <button
                onClick={fetchInquiries}
                className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
                Refresh
              </button>
              <button
                onClick={handleExportInquiries}
                disabled={filtered.length === 0}
                className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export CSV
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* Main Content */}
            <div className={`grid gap-6 ${selectedInquiry ? 'lg:grid-cols-5' : 'grid-cols-1'}`}>

              {/* Table */}
              <div className={selectedInquiry ? 'lg:col-span-3' : 'col-span-1'}>
                {loading ? (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="border-b border-border bg-secondary/40 px-5 py-3 flex gap-6">
                      <div className="w-28 h-3 bg-muted/50 rounded animate-pulse" />
                      <div className="w-20 h-3 bg-muted/50 rounded animate-pulse hidden sm:block" />
                      <div className="w-16 h-3 bg-muted/50 rounded animate-pulse hidden md:block" />
                      <div className="w-16 h-3 bg-muted/50 rounded animate-pulse" />
                    </div>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="w-36 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                          <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
                        </div>
                        <div className="w-24 h-3 bg-muted/40 rounded animate-pulse hidden sm:block" />
                        <div className="w-20 h-3 bg-muted/40 rounded animate-pulse hidden md:block" />
                        <div className="w-16 h-6 bg-muted/50 rounded-full animate-pulse" />
                        <div className="w-8 h-8 bg-muted/40 rounded-lg animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="bg-card border border-border rounded-2xl p-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      </svg>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {search || statusFilter !== 'all' ? 'No inquiries match your search.' : 'No inquiries yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-secondary/40">
                            <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Name / Firm</th>
                            <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Service</th>
                            <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Date</th>
                            <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                            <th className="px-5 py-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((inq, i) => (
                            <tr
                              key={inq.id}
                              className={`border-b border-border last:border-0 transition-colors cursor-pointer ${
                                selectedInquiry?.id === inq.id
                                  ? 'bg-accent/8'
                                  : i % 2 === 0 ? 'hover:bg-secondary/30' : 'bg-secondary/10 hover:bg-secondary/30'
                              }`}
                              onClick={() => setSelectedInquiry(selectedInquiry?.id === inq.id ? null : inq)}
                            >
                              <td className="px-5 py-3.5">
                                <p className="font-medium text-foreground">{inq.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{inq.email}</p>
                                <p className="text-xs text-muted-foreground/70 mt-0.5 sm:hidden">{inq.firm}</p>
                              </td>
                              <td className="px-5 py-3.5 hidden sm:table-cell">
                                <span className="text-foreground/80">{inq.service}</span>
                              </td>
                              <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">
                                {formatDate(inq.created_at)}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[inq.status] || STATUS_COLORS['new']}`}>
                                  {STATUS_LABELS[inq.status] || inq.status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(inq.id); }}
                                  disabled={deletingId === inq.id}
                                  className="text-muted-foreground/40 hover:text-red-500 transition-colors disabled:opacity-40"
                                  aria-label="Delete inquiry"
                                >
                                  {deletingId === inq.id ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                    </svg>
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                    </svg>
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground">
                      Showing {filtered.length} of {inquiries.length} {inquiries.length === 1 ? 'inquiry' : 'inquiries'}
                    </div>
                  </div>
                )}
              </div>

              {/* Detail Panel */}
              {selectedInquiry && (
                <div className="lg:col-span-2">
                  <div className="bg-card border border-border rounded-2xl p-6 sticky top-28">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <h2 className="font-serif text-xl text-foreground">{selectedInquiry.name}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{selectedInquiry.firm}</p>
                      </div>
                      <button
                        onClick={() => setSelectedInquiry(null)}
                        className="text-muted-foreground/50 hover:text-foreground transition-colors p-1"
                        aria-label="Close detail panel"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>

                    {/* Contact Info */}
                    <div className="flex flex-col gap-2.5">
                      <a
                        href={`mailto:${selectedInquiry.email}`}
                        className="flex items-center gap-2.5 text-sm text-accent hover:underline"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                        </svg>
                        {selectedInquiry.email}
                      </a>
                      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="20" height="16" x="2" y="4" rx="2"/>
                        </svg>
                        {selectedInquiry.service}
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground/70">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        Submitted {formatDate(selectedInquiry.created_at)}
                      </div>
                    </div>

                    {/* Message */}
                    <div className="mb-5">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Message</p>
                      <p className="text-sm text-foreground/80 leading-relaxed bg-secondary/40 rounded-xl p-4 border border-border">
                        {selectedInquiry.message}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="mb-5">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Status</p>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(selectedInquiry.id, s)}
                            disabled={updatingId === selectedInquiry.id}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-60 ${
                              selectedInquiry.status === s
                                ? STATUS_COLORS[s]
                                : 'bg-transparent border-border text-muted-foreground hover:border-accent/50'
                            }`}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="mb-5 flex gap-2">
                      <a
                        href="https://calendly.com/maggimaybroussard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        Book
                      </a>
                      <a
                        href={`mailto:${selectedInquiry.email}?subject=Re: Your Inquiry — Maggi May Broussard`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                        style={{ background: '#355E3B', color: '#fff' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                        Reply
                      </a>
                    </div>

                    {/* Notes */}
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Internal Notes</p>
                      <textarea
                        rows={3}
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        placeholder="Add internal notes…"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
                      />
                      <button
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        className="mt-2 w-full py-2 bg-primary text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {savingNotes ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                            Saving…
                          </>
                        ) : 'Save Notes & Notify Client'}
                      </button>
                    </div>

                    {/* Upload Document */}
                    <div className="mt-5 pt-5 border-t border-border">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Upload Document</p>
                      <input
                        ref={docFileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); }}
                      />
                      <button
                        onClick={() => !uploadingDoc && docFileInputRef.current?.click()}
                        disabled={uploadingDoc}
                        className="w-full py-2.5 rounded-xl border-2 border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-accent/50 hover:text-foreground transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {uploadingDoc ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                            Uploading…
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                            Choose File to Upload
                          </>
                        )}
                      </button>
                      {uploadDocError && (
                        <p className="mt-2 text-xs text-red-600">{uploadDocError}</p>
                      )}
                      {uploadDocSuccess && (
                        <p className="mt-2 text-xs text-green-700">{uploadDocSuccess}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}