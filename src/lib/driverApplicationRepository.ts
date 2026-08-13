import { createDriverDocumentSignedUrl } from './driverMarketplaceRepository';
import { requireSupabase } from './supabase';

export interface DriverDocumentRecord {
  id: string;
  documentType: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  verified: boolean;
}

export interface DriverVehicleProposal {
  id: string;
  applicationId: string;
  applicantName: string;
  applicationStatus: string;
  driverId: string | null;
  licensePlate: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  capacity: number;
  registrationCountryCode: string;
  technicalInspectionExpiry: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  documents: DriverDocumentRecord[];
}

export interface DriverApplicationRecord {
  id: string;
  userId: string;
  companyId: string;
  applicantName: string;
  phone: string;
  nationalIdNumber: string;
  licenseNumber: string;
  licenseCountryCode: string;
  notes: string;
  applicationMode: 'documented' | 'existing_member';
  claimedUnitNumber: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  rejectionReason: string | null;
  createdAt: string;
  documents: DriverDocumentRecord[];
  vehicleProposal: DriverVehicleProposal | null;
}

const mapDocument = (row: any): DriverDocumentRecord => ({
  id: row.id,
  documentType: row.document_type,
  originalName: row.original_name,
  storagePath: row.storage_path,
  mimeType: row.mime_type,
  verified: Boolean(row.verified),
});

export const loadPendingDriverApplications = async (companyId: string): Promise<DriverApplicationRecord[]> => {
  const { data, error } = await requireSupabase()
    .from('driver_applications')
    .select(`
      id,user_id,company_id,applicant_name,phone,national_id_number,license_number,
      license_country_code,notes,application_mode,claimed_unit_number,status,rejection_reason,created_at,
      driver_application_documents(id,document_type,original_name,storage_path,mime_type,verified),
      driver_vehicle_submissions(id,application_id,license_plate,brand,model,year,color,capacity,registration_country_code,technical_inspection_expiry,status)
    `)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const documents = (row.driver_application_documents ?? []).map(mapDocument);
    const vehicle = Array.isArray(row.driver_vehicle_submissions) ? row.driver_vehicle_submissions[0] : row.driver_vehicle_submissions;
    return {
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      applicantName: row.applicant_name,
      phone: row.phone ?? '',
      nationalIdNumber: row.national_id_number ?? '',
      licenseNumber: row.license_number,
      licenseCountryCode: row.license_country_code ?? '',
      notes: row.notes ?? '',
      applicationMode: row.application_mode === 'existing_member' ? 'existing_member' : 'documented',
      claimedUnitNumber: row.claimed_unit_number ?? '',
      status: row.status,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      documents,
      vehicleProposal: vehicle ? {
        id: vehicle.id,
        applicationId: vehicle.application_id,
        applicantName: row.applicant_name,
        applicationStatus: row.status,
        driverId: null,
        licensePlate: vehicle.license_plate,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color ?? '',
        capacity: vehicle.capacity,
        registrationCountryCode: vehicle.registration_country_code,
        technicalInspectionExpiry: vehicle.technical_inspection_expiry,
        status: vehicle.status,
        documents: documents.filter((document: DriverDocumentRecord) => ['vehicle_registration', 'vehicle_insurance', 'technical_inspection'].includes(document.documentType)),
      } : null,
    };
  });
};

export const loadPendingVehicleSubmissions = async (companyId: string): Promise<DriverVehicleProposal[]> => {
  const { data, error } = await requireSupabase()
    .from('driver_vehicle_submissions')
    .select(`
      id,application_id,license_plate,brand,model,year,color,capacity,registration_country_code,
      technical_inspection_expiry,status,
      driver_applications!inner(applicant_name,status,driver_id),
      driver_application_documents(id,document_type,original_name,storage_path,mime_type,verified)
    `)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const application = Array.isArray(row.driver_applications) ? row.driver_applications[0] : row.driver_applications;
    return {
      id: row.id,
      applicationId: row.application_id,
      applicantName: application?.applicant_name ?? 'Conductor',
      applicationStatus: application?.status ?? 'pending',
      driverId: application?.driver_id ?? null,
      licensePlate: row.license_plate,
      brand: row.brand,
      model: row.model,
      year: row.year,
      color: row.color ?? '',
      capacity: row.capacity,
      registrationCountryCode: row.registration_country_code,
      technicalInspectionExpiry: row.technical_inspection_expiry,
      status: row.status,
      documents: (row.driver_application_documents ?? []).map(mapDocument),
    };
  });
};

export const reviewDriverApplication = async (input: {
  applicationId: string;
  approve: boolean;
  unitNumber?: string;
  vehicleId?: string;
  rejectionReason?: string;
}) => {
  const { data, error } = await requireSupabase().rpc('centralgo_review_driver_application', {
    p_application_id: input.applicationId,
    p_approve: input.approve,
    p_unit_number: input.unitNumber || null,
    p_vehicle_id: input.vehicleId || null,
    p_rejection_reason: input.rejectionReason || null,
  });
  if (error) throw error;
  return data;
};

export const reviewDriverVehicle = async (input: {
  submissionId: string;
  approve: boolean;
  unitNumber?: string;
  rejectionReason?: string;
}) => {
  const { data, error } = await requireSupabase().rpc('centralgo_review_driver_vehicle', {
    p_submission_id: input.submissionId,
    p_approve: input.approve,
    p_unit_number: input.unitNumber || null,
    p_rejection_reason: input.rejectionReason || null,
  });
  if (error) throw error;
  return data;
};

export const openDriverDocument = async (document: DriverDocumentRecord) => {
  const url = await createDriverDocumentSignedUrl(document.storagePath);
  window.open(url, '_blank', 'noopener,noreferrer');
};
