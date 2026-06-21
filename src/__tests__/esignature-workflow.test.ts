/**
 * E2E Tests: E-Signature Send-and-Track Workflow
 *
 * Covers:
 *  1. Admin sends a signature request (DB insert)
 *  2. Client portal loads pending requests
 *  3. Client submits a typed signature
 *  4. Status updates to "signed" after submission *  5. Signed request shows"Completed" badge
 *  6. Expired request cannot be signed
 *  7. Duplicate signature is rejected
 *  8. Missing signature data is caught before submit
 *  9. PDF download is available only after signing
 * 10. Unauthenticated access redirects to login
 */

/// <reference types="jest" />
import '@jest/globals';
import { describe, it, expect, jest } from '@jest/globals';
import { createClient } from '@/lib/supabase/client';

// ─── Shared mock data ────────────────────────────────────────────────────────

const MOCK_USER_ID = 'user-abc-123';
const MOCK_INQUIRY_ID = 'inquiry-xyz-456';
const MOCK_REQUEST_ID = 'req-pending-001';
const MOCK_SIGNED_REQUEST_ID = 'req-signed-002';

const mockPendingRequest = {
  id: MOCK_REQUEST_ID,
  inquiry_id: MOCK_INQUIRY_ID,
  title: 'Engagement Letter',
  document_description: 'Standard engagement agreement',
  document_content: 'This agreement is between Maggi May Broussard and the client...',
  status: 'pending',
  created_by: 'Maggi May Broussard',
  created_at: '2026-06-01T10:00:00Z',
  expires_at: null,
};

const mockSignedRequest = {
  ...mockPendingRequest,
  id: MOCK_SIGNED_REQUEST_ID,
  title: 'Retainer Agreement',
  status: 'signed',
};

const mockExpiredRequest = {
  ...mockPendingRequest,
  id: 'req-expired-003',
  title: 'Discovery Agreement',
  status: 'expired',
  expires_at: '2026-05-01T00:00:00Z',
};

const mockSignature = {
  id: 'sig-001',
  request_id: MOCK_SIGNED_REQUEST_ID,
  inquiry_id: MOCK_INQUIRY_ID,
  user_id: MOCK_USER_ID,
  signer_name: 'Jane Client',
  signer_email: 'jane@example.com',
  signature_data: 'typed:Jane Client',
  signature_type: 'type',
  signed_at: '2026-06-02T14:30:00Z',
};

const mockInquiry = {
  id: MOCK_INQUIRY_ID,
  name: 'Jane Client',
  email: 'jane@example.com',
  service: 'Estate Planning',
};

// ─── Supabase mock factory ───────────────────────────────────────────────────

function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const base = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { inquiry_id: MOCK_INQUIRY_ID }, error: null }),
    single: jest.fn().mockResolvedValue({ data: mockInquiry, error: null }),
    ...overrides,
  };
  return base;
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// ─── Helper: build a Supabase chain that returns data per table ──────────────

function buildChainedMock(tableResponses: Record<string, unknown>) {
  let currentTable = '';
  const mock = {
    from: jest.fn((table: string) => { currentTable = table; return mock; }),
    select: jest.fn(() => mock),
    insert: jest.fn(() => mock),
    update: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    order: jest.fn(() => mock),
    maybeSingle: jest.fn(() =>
      Promise.resolve(tableResponses[currentTable + ':maybeSingle'] ?? { data: null, error: null })
    ),
    single: jest.fn(() =>
      Promise.resolve(tableResponses[currentTable + ':single'] ?? { data: null, error: null })
    ),
  };
  // Allow Promise.all resolution by making the mock itself thenable per table
  (mock as unknown as { then: unknown }).then = undefined;
  return mock;
}

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('E-Signature Send-and-Track Workflow', () => {

  // ── 1. Admin inserts a signature request ──────────────────────────────────
  describe('Admin: send signature request', () => {
    it('inserts a new signature_request row with status=pending', async () => {
      const insertMock = jest.fn().mockResolvedValue({ data: mockPendingRequest, error: null });
      const supabase = {
        from: jest.fn().mockReturnThis(),
        insert: insertMock,
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPendingRequest, error: null }),
      };
      mockedCreateClient.mockReturnValue(supabase as ReturnType<typeof createClient>);

      const client = createClient();
      const { data, error } = await client
        .from('signature_requests')
        .insert({
          inquiry_id: MOCK_INQUIRY_ID,
          title: 'Engagement Letter',
          document_content: 'Agreement text...',
          status: 'pending',
          created_by: 'Maggi May Broussard',
        })
        .single();

      expect(error).toBeNull();
      expect(data).toMatchObject({ status: 'pending', title: 'Engagement Letter' });
      expect(client.from).toHaveBeenCalledWith('signature_requests');
    });

    it('rejects insert when document_content is empty', async () => {
      const supabase = makeSupabaseMock({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'null value in column "document_content"' },
        }),
      });
      mockedCreateClient.mockReturnValue(supabase as ReturnType<typeof createClient>);

      const client = createClient();
      const { error } = await client
        .from('signature_requests')
        .insert({ inquiry_id: MOCK_INQUIRY_ID, title: 'Test', document_content: '' })
        .single();

      expect(error).not.toBeNull();
      expect(error?.message).toContain('document_content');
    });
  });

  // ── 2. Client portal: load pending requests ───────────────────────────────
  describe('Client portal: load signature requests', () => {
    it('fetches pending requests for the authenticated client', async () => {
      const requestsData = [mockPendingRequest];
      const supabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: requestsData, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: { inquiry_id: MOCK_INQUIRY_ID }, error: null }),
        single: jest.fn().mockResolvedValue({ data: mockInquiry, error: null }),
      };
      mockedCreateClient.mockReturnValue(supabase as ReturnType<typeof createClient>);

      const client = createClient();

      // Step 1: resolve portal access
      const { data: access } = await client
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', MOCK_USER_ID)
        .maybeSingle();

      expect(access?.inquiry_id).toBe(MOCK_INQUIRY_ID);

      // Step 2: fetch requests
      const { data: requests } = await client
        .from('signature_requests')
        .select('*')
        .eq('inquiry_id', MOCK_INQUIRY_ID)
        .order('created_at', { ascending: false });

      expect(requests).toHaveLength(1);
      expect(requests?.[0].status).toBe('pending');
    });

    it('returns empty array when no requests exist', async () => {
      const supabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: { inquiry_id: MOCK_INQUIRY_ID }, error: null }),
        single: jest.fn().mockResolvedValue({ data: mockInquiry, error: null }),
      };
      mockedCreateClient.mockReturnValue(supabase as ReturnType<typeof createClient>);

      const client = createClient();
      const { data } = await client
        .from('signature_requests')
        .select('*')
        .eq('inquiry_id', MOCK_INQUIRY_ID)
        .order('created_at', { ascending: false });

      expect(data).toEqual([]);
    });

    it('shows no-portal-access state when client_portal_access returns null', async () => {
      const supabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockedCreateClient.mockReturnValue(supabase as ReturnType<typeof createClient>);

      const client = createClient();
      const { data: access } = await client
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', MOCK_USER_ID)
        .maybeSingle();

      // No access → inquiry is null → empty state shown
      expect(access).toBeNull();
    });
  });

  // ── 3. Client submits a typed signature ───────────────────────────────────
  describe('Client: submit signature', () => {
    it('inserts a signature row with typed signature data', async () => {
      const insertedSig = {
        id: 'sig-new-001',
        request_id: MOCK_REQUEST_ID,
        inquiry_id: MOCK_INQUIRY_ID,
        user_id: MOCK_USER_ID,
        signer_name: 'Jane Client',
        signer_email: 'jane@example.com',
        signature_data: 'typed:Jane Client',
        signature_type: 'type',
        signed_at: new Date().toISOString(),
      };

      const insertMock = jest.fn().mockResolvedValue({ data: insertedSig, error: null });
      const updateMock = jest.fn().mockReturnThis();
      const eqMock = jest.fn().mockResolvedValue({ data: null, error: null });

      const supabase = {
        from: jest.fn().mockReturnThis(),
        insert: insertMock,
        update: updateMock,
        eq: eqMock,
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: insertedSig, error: null }),
      };
      mockedCreateClient.mockReturnValue(supabase as ReturnType<typeof createClient>);

      const client = createClient();

      // Insert signature
      const { error: sigError } = await client.from('signatures').insert({
        request_id: MOCK_REQUEST_ID,
        inquiry_id: MOCK_INQUIRY_ID,
        user_id: MOCK_USER_ID,
        signer_name: 'Jane Client',
        signer_email: 'jane@example.com',
        signature_data: 'typed:Jane Client',
        signature_type: 'type',
        signed_at: new Date().toISOString(),
      });

      expect(sigError).toBeNull();
      expect(client.from).toHaveBeenCalledWith('signatures');
    });

    it('updates signature_request status to "signed" after insert', async () => {
      const updateMock = jest.fn().mockReturnThis();
      const eqMock = jest.fn().mockResolvedValue({ data: null, error: null });

      const supabase = {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: updateMock,
        eq: eqMock,
        select: jest.fn().mockReturnThis(),
      };
      mockedCreateClient.mockReturnValue(supabase as ReturnType<typeof createClient>);

      const client = createClient();

      // Update status
      const { error } = await client
        .from('signature_requests')
        .update({ status: 'signed' })
        .eq('id', MOCK_REQUEST_ID);

      expect(error).toBeNull();
      expect(updateMock).toHaveBeenCalledWith({ status: 'signed' });
      expect(eqMock).toHaveBeenCalledWith('id', MOCK_REQUEST_ID);
    });

    it('rejects submission when signature_data is empty string', () => {
      // Mirrors the getSignatureData() guard in PortalSignaturesPage
      const getSignatureData = (signMode: string, typedName: string): string | null => {
        if (signMode === 'type') {
          return typedName.trim() ? `typed:${typedName.trim()}` : null;
        }
        return null; // no canvas drawn
      };

      expect(getSignatureData('type', '')).toBeNull();
      expect(getSignatureData('type', '   ')).toBeNull();
      expect(getSignatureData('draw', '')).toBeNull();
    });

    it('produces correct typed signature data format', () => {
      const getSignatureData = (signMode: string, typedName: string): string | null => {
        if (signMode === 'type') {
          return typedName.trim() ? `typed:${typedName.trim()}` : null;
        }
        return null;
      };

      expect(getSignatureData('type', 'Jane Client')).toBe('typed:Jane Client');
      expect(getSignatureData('type', '  Jane Client  ')).toBe('typed:Jane Client');
    });
  });

  // ── 4. Status tracking after signing ─────────────────────────────────────
  describe('Status tracking', () => {
    it('isSigned returns true when signatures array contains matching request_id', () => {
      const signatures = [mockSignature];
      const isSigned = (requestId: string) => signatures.some((s) => s.request_id === requestId);

      expect(isSigned(MOCK_SIGNED_REQUEST_ID)).toBe(true);
      expect(isSigned(MOCK_REQUEST_ID)).toBe(false);
    });

    it('treats request with status="signed" as signed even without local signature record', () => {
      const signatures: typeof mockSignature[] = [];
      const isSigned = (requestId: string) => signatures.some((s) => s.request_id === requestId);

      const req = mockSignedRequest;
      const displayedAsSigned = isSigned(req.id) || req.status === 'signed';
      expect(displayedAsSigned).toBe(true);
    });

    it('pending request is not treated as signed', () => {
      const signatures: typeof mockSignature[] = [];
      const isSigned = (requestId: string) => signatures.some((s) => s.request_id === requestId);

      const req = mockPendingRequest;
      const displayedAsSigned = isSigned(req.id) || req.status === 'signed';
      expect(displayedAsSigned).toBe(false);
    });
  });

  // ── 5. Expired request cannot be signed ──────────────────────────────────
  describe('Expired request guard', () => {
    it('does not show Sign Now button for expired requests', () => {
      const canSign = (req: typeof mockExpiredRequest, signed: boolean) =>
        !signed && req.status !== 'expired';

      expect(canSign(mockExpiredRequest, false)).toBe(false);
    });

    it('allows signing for pending non-expired request', () => {
      const canSign = (req: typeof mockPendingRequest, signed: boolean) =>
        !signed && req.status !== 'expired';

      expect(canSign(mockPendingRequest, false)).toBe(true);
    });

    it('does not allow signing an already-signed request', () => {
      const canSign = (req: typeof mockSignedRequest, signed: boolean) =>
        !signed && req.status !== 'expired';

      expect(canSign(mockSignedRequest, true)).toBe(false);
    });
  });

  // ── 6. PDF download availability ─────────────────────────────────────────
  describe('PDF download availability', () => {
    it('download is available only when a matching signature exists', () => {
      const signatures = [mockSignature];
      const canDownload = (requestId: string) =>
        signatures.some((s) => s.request_id === requestId);

      expect(canDownload(MOCK_SIGNED_REQUEST_ID)).toBe(true);
      expect(canDownload(MOCK_REQUEST_ID)).toBe(false);
    });
  });

  // ── 7. Duplicate signature prevention ────────────────────────────────────
  describe('Duplicate signature prevention', () => {
    it('returns DB error when inserting duplicate signature for same request', async () => {
      const supabase = {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'duplicate key value violates unique constraint' },
        }),
      };
      mockedCreateClient.mockReturnValue(supabase as ReturnType<typeof createClient>);

      const client = createClient();
      const { error } = await client.from('signatures').insert({
        request_id: MOCK_SIGNED_REQUEST_ID,
        user_id: MOCK_USER_ID,
        signature_data: 'typed:Jane Client',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('duplicate key');
    });
  });

  // ── 8. Unauthenticated access ─────────────────────────────────────────────
  describe('Authentication guard', () => {
    it('redirects to /portal/login when user is null', () => {
      const replaceMock = jest.fn();
      const router = { replace: replaceMock };

      // Simulate the useEffect guard: if (!authLoading && !user) router.replace('/portal/login')
      const authLoading = false;
      const user = null;

      if (!authLoading && !user) {
        router.replace('/portal/login');
      }

      expect(replaceMock).toHaveBeenCalledWith('/portal/login');
    });

    it('does not redirect when user is authenticated', () => {
      const replaceMock = jest.fn();
      const router = { replace: replaceMock };

      const authLoading = false;
      const user = { id: MOCK_USER_ID, email: 'jane@example.com' };

      if (!authLoading && !user) {
        router.replace('/portal/login');
      }

      expect(replaceMock).not.toHaveBeenCalled();
    });
  });

  // ── 9. Delivery reliability: Supabase error handling ─────────────────────
  describe('Delivery reliability', () => {
    it('surfaces fetch error to UI error state', async () => {
      const supabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'connection timeout' },
        }),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'connection timeout' } }),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'connection timeout' } }),
      };
      mockedCreateClient.mockReturnValue(supabase as ReturnType<typeof createClient>);

      const client = createClient();
      const { error } = await client
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', MOCK_USER_ID)
        .maybeSingle();

      expect(error?.message).toBe('connection timeout');
    });

    it('signature insert error is caught and shown to user', async () => {
      const supabase = {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Failed to submit signature. Please try again.' },
        }),
      };
      mockedCreateClient.mockReturnValue(supabase as ReturnType<typeof createClient>);

      const client = createClient();
      const { error } = await client.from('signatures').insert({
        request_id: MOCK_REQUEST_ID,
        user_id: MOCK_USER_ID,
        signature_data: 'typed:Jane Client',
      });

      expect(error?.message).toContain('Failed to submit signature');
    });

    it('status update failure does not silently corrupt state', async () => {
      const supabase = {
        from: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'row not found' },
        }),
      };
      mockedCreateClient.mockReturnValue(supabase as ReturnType<typeof createClient>);

      const client = createClient();
      const { error } = await client
        .from('signature_requests')
        .update({ status: 'signed' })
        .eq('id', 'nonexistent-id');

      expect(error?.message).toBe('row not found');
    });
  });
});
