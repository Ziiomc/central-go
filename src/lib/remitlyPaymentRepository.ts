import { requireSupabase } from './supabase';

export interface RemitlyPaymentConfig {
  enabled: boolean;
  displayName: string;
  recipientName: string;
  payTag: string;
  destinationLabel: string;
  paymentUrl: string | null;
  websiteUrl: string | null;
  instructions: string;
}

export interface RemitlyPaymentRequest {
  requestId: string;
  invoiceCode: string;
  status: 'pending' | 'payment_sent' | 'approved' | 'rejected' | 'cancelled';
  companyId: string;
  planCode: string;
  planName?: string;
  billingCycle: 'monthly' | 'annual';
  amountClp: number;
  currency: 'CLP';
  senderReference?: string | null;
  proofPath?: string | null;
  createdAt?: string | null;
  submittedAt?: string | null;
  config: RemitlyPaymentConfig;
}

export interface RemitlyAdminRequest {
  id: string;
  invoiceCode: string;
  status: 'pending' | 'payment_sent' | 'approved' | 'rejected' | 'cancelled';
  companyId: string;
  companyName: string;
  companyCode: string;
  userId: string;
  userName: string;
  userEmail: string;
  planCode: string;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  amountClp: number;
  currency: 'CLP';
  senderReference: string | null;
  proofPath: string | null;
  customerNotes: string | null;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

const normalizeConfig = (raw: any): RemitlyPaymentConfig => ({
  enabled: Boolean(raw?.enabled),
  displayName: String(raw?.displayName || 'Remitly'),
  recipientName: String(raw?.recipientName || ''),
  payTag: String(raw?.payTag || ''),
  destinationLabel: String(raw?.destinationLabel || ''),
  paymentUrl: typeof raw?.paymentUrl === 'string' && raw.paymentUrl ? raw.paymentUrl : null,
  websiteUrl: typeof raw?.websiteUrl === 'string' && raw.websiteUrl ? raw.websiteUrl : null,
  instructions: String(raw?.instructions || ''),
});

export async function loadRemitlyPaymentConfig(): Promise<RemitlyPaymentConfig> {
  const { data, error } = await requireSupabase().rpc('centralgo_remitly_payment_config');
  if (error) throw error;
  return normalizeConfig(data);
}

export async function saveRemitlyPaymentConfig(input: {
  enabled: boolean;
  recipientName: string;
  payTag: string;
  destinationLabel: string;
  paymentUrl?: string;
  instructions?: string;
}): Promise<RemitlyPaymentConfig> {
  const { data, error } = await requireSupabase().rpc('centralgo_superadmin_set_remitly_payment_config', {
    p_enabled: input.enabled,
    p_recipient_name: input.recipientName,
    p_pay_tag: input.payTag,
    p_destination_label: input.destinationLabel,
    p_payment_url: input.paymentUrl || null,
    p_instructions: input.instructions || null,
  });
  if (error) throw error;
  return normalizeConfig(data);
}

export async function createRemitlyPaymentRequest(input: {
  companyId: string;
  planCode: string;
  billingCycle: 'monthly' | 'annual';
}): Promise<RemitlyPaymentRequest> {
  const { data, error } = await requireSupabase().rpc('centralgo_create_remitly_payment_request', {
    p_company_id: input.companyId,
    p_plan_code: input.planCode,
    p_billing_cycle: input.billingCycle,
  });
  if (error) throw error;
  return {
    requestId: String(data?.requestId || ''),
    invoiceCode: String(data?.invoiceCode || ''),
    status: data?.status || 'pending',
    companyId: String(data?.companyId || input.companyId),
    planCode: String(data?.planCode || input.planCode),
    planName: data?.planName || undefined,
    billingCycle: data?.billingCycle || input.billingCycle,
    amountClp: Number(data?.amountClp || 0),
    currency: 'CLP',
    senderReference: data?.senderReference ?? null,
    proofPath: data?.proofPath ?? null,
    createdAt: data?.createdAt ?? null,
    submittedAt: data?.submittedAt ?? null,
    config: normalizeConfig(data?.config),
  };
}

export async function submitRemitlyPaymentRequest(input: {
  requestId: string;
  senderReference: string;
  proof: File;
  customerNotes?: string;
}) {
  const db = requireSupabase();
  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) throw new Error('Debes iniciar sesión nuevamente para adjuntar el comprobante.');

  const rawExt = input.proof.name.split('.').pop()?.toLowerCase() || 'bin';
  const ext = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(rawExt) ? rawExt : 'bin';
  const proofPath = `${userId}/${input.requestId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await db.storage
    .from('remitly-payment-proofs')
    .upload(proofPath, input.proof, { cacheControl: '3600', upsert: false, contentType: input.proof.type || undefined });
  if (uploadError) throw uploadError;

  const { data, error } = await db.rpc('centralgo_submit_remitly_payment_request', {
    p_request_id: input.requestId,
    p_sender_reference: input.senderReference,
    p_proof_path: proofPath,
    p_customer_notes: input.customerNotes || null,
  });
  if (error) throw error;
  return data as { requestId: string; invoiceCode: string; status: string; submittedAt: string };
}

export async function loadRemitlyAdminRequests(): Promise<RemitlyAdminRequest[]> {
  const { data, error } = await requireSupabase().rpc('centralgo_visible_remitly_payment_requests');
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row: any) => ({
    id: String(row.id),
    invoiceCode: String(row.invoiceCode || ''),
    status: row.status,
    companyId: String(row.companyId || ''),
    companyName: String(row.companyName || 'Central'),
    companyCode: String(row.companyCode || ''),
    userId: String(row.userId || ''),
    userName: String(row.userName || 'Usuario'),
    userEmail: String(row.userEmail || ''),
    planCode: String(row.planCode || ''),
    planName: String(row.planName || row.planCode || ''),
    billingCycle: row.billingCycle || 'monthly',
    amountClp: Number(row.amountClp || 0),
    currency: 'CLP',
    senderReference: row.senderReference ?? null,
    proofPath: row.proofPath ?? null,
    customerNotes: row.customerNotes ?? null,
    createdAt: String(row.createdAt || ''),
    submittedAt: row.submittedAt ?? null,
    reviewedAt: row.reviewedAt ?? null,
    reviewNotes: row.reviewNotes ?? null,
  }));
}

export async function createRemitlyProofUrl(path: string): Promise<string> {
  const { data, error } = await requireSupabase().storage.from('remitly-payment-proofs').createSignedUrl(path, 600);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('No pudimos abrir el comprobante.');
  return data.signedUrl;
}

export async function reviewRemitlyPayment(input: { requestId: string; approve: boolean; notes?: string }) {
  const { data, error } = await requireSupabase().rpc('centralgo_superadmin_review_remitly_payment', {
    p_request_id: input.requestId,
    p_approve: input.approve,
    p_review_notes: input.notes || null,
  });
  if (error) throw error;
  return data;
}
