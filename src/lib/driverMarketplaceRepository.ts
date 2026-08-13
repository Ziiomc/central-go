import { requireSupabase } from './supabase';

export type DriverApplicationStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type DriverDocumentType =
  | 'identity_document'
  | 'driver_license'
  | 'profile_photo'
  | 'vehicle_registration'
  | 'vehicle_insurance'
  | 'technical_inspection'
  | 'other';

export interface CentralDirectoryItem {
  id: string;
  name: string;
  code: string;
  city: string;
  countryCode: string;
}

export interface MyDriverApplication {
  id: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  companyCity: string;
  companyCountryCode: string;
  applicantName: string;
  phone: string;
  nationalIdNumber: string;
  licenseNumber: string;
  licenseCountryCode: string;
  status: DriverApplicationStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface VehicleSubmissionInput {
  applicationId: string;
  userId: string;
  companyId: string;
  licensePlate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  capacity: number;
  registrationCountryCode: string;
  technicalInspectionExpiry?: string;
}

const BUCKET = 'driver-documents';
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 12 * 1024 * 1024;

export const searchCentrals = async (filters: { countryCode?: string; city?: string; query?: string } = {}): Promise<CentralDirectoryItem[]> => {
  const { data, error } = await requireSupabase().rpc('centralgo_search_centrals', {
    p_country_code: filters.countryCode || null,
    p_city: filters.city || null,
    p_query: filters.query || null,
  });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    city: row.city ?? '',
    countryCode: row.country_code ?? '',
  }));
};

export const loadMyDriverApplications = async (): Promise<MyDriverApplication[]> => {
  const { data, error } = await requireSupabase().rpc('centralgo_my_driver_applications');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name,
    companyCode: row.company_code,
    companyCity: row.company_city ?? '',
    companyCountryCode: row.company_country_code ?? '',
    applicantName: row.applicant_name,
    phone: row.phone ?? '',
    nationalIdNumber: row.national_id_number ?? '',
    licenseNumber: row.license_number,
    licenseCountryCode: row.license_country_code ?? '',
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  }));
};

export const prepareDriverApplication = async (input: {
  companyId: string;
  applicantName: string;
  phone: string;
  nationalIdNumber: string;
  licenseNumber: string;
  licenseCountryCode: string;
  notes?: string;
}) => {
  const { data, error } = await requireSupabase().rpc('centralgo_prepare_driver_application', {
    p_company_id: input.companyId,
    p_applicant_name: input.applicantName,
    p_phone: input.phone || null,
    p_national_id_number: input.nationalIdNumber,
    p_license_number: input.licenseNumber,
    p_license_country_code: input.licenseCountryCode,
    p_notes: input.notes || null,
  });
  if (error) throw error;
  return data as { applicationId: string; status: 'draft' };
};

export const saveVehicleSubmission = async (input: VehicleSubmissionInput): Promise<string> => {
  const payload = {
    application_id: input.applicationId,
    user_id: input.userId,
    company_id: input.companyId,
    license_plate: input.licensePlate.trim().toUpperCase(),
    brand: input.brand.trim(),
    model: input.model.trim(),
    year: input.year,
    color: input.color?.trim() || null,
    capacity: input.capacity,
    registration_country_code: input.registrationCountryCode,
    technical_inspection_expiry: input.technicalInspectionExpiry || null,
    status: 'draft',
  };
  const { data, error } = await requireSupabase()
    .from('driver_vehicle_submissions')
    .upsert(payload, { onConflict: 'application_id' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

const safeFileName = (name: string) => {
  const extension = name.split('.').pop()?.toLowerCase() || 'bin';
  const base = name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'documento';
  return `${base}.${extension}`;
};

export const uploadDriverDocument = async (input: {
  applicationId: string;
  vehicleSubmissionId?: string;
  userId: string;
  documentType: DriverDocumentType;
  countryCode: string;
  file: File;
}) => {
  if (!ALLOWED_MIME_TYPES.has(input.file.type)) throw new Error('Usa PDF, JPG, PNG o WEBP.');
  if (input.file.size <= 0 || input.file.size > MAX_FILE_SIZE) throw new Error('Cada archivo debe pesar menos de 12 MB.');
  const unique = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${input.userId}/${input.applicationId}/${unique}-${safeFileName(input.file.name)}`;
  const db = requireSupabase();
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, input.file, {
    contentType: input.file.type,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { error: metadataError } = await db.from('driver_application_documents').insert({
    application_id: input.applicationId,
    vehicle_submission_id: input.vehicleSubmissionId || null,
    user_id: input.userId,
    document_type: input.documentType,
    storage_path: path,
    original_name: input.file.name,
    mime_type: input.file.type,
    size_bytes: input.file.size,
    country_code: input.countryCode,
  });
  if (metadataError) {
    await db.storage.from(BUCKET).remove([path]);
    throw metadataError;
  }
  return path;
};

export const submitDriverApplication = async (applicationId: string) => {
  const { data, error } = await requireSupabase().rpc('centralgo_submit_driver_application', {
    p_application_id: applicationId,
  });
  if (error) throw error;
  return data as { applicationId: string; status: 'pending' };
};

export const createDriverDocumentSignedUrl = async (path: string, expiresIn = 600) => {
  const { data, error } = await requireSupabase().storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
};

