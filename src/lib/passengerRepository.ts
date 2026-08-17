import { requireSupabase } from './supabase';

export type PassengerTripStatus = 'pending'|'assigned'|'en_route'|'in_progress'|'completed'|'cancelled';

export interface PassengerTripSnapshot {
  tripId:string;
  code:string;
  status:PassengerTripStatus;
  centralName:string;
  driverUnitNumber?:string;
  driverName?:string;
  estimatedFare?:number;
  originAddress:string;
  destinationAddress:string;
}

interface RequestRideInput {
  centralCode:string;
  passengerName:string;
  phone:string;
  pickupAddress:string;
  pickupLat?:number;
  pickupLng?:number;
  destinationAddress?:string;
  destinationLat?:number;
  destinationLng?:number;
  notes?:string;
}

async function invoke<T>(body:Record<string,unknown>):Promise<T>{
  const {data,error}=await requireSupabase().functions.invoke('passenger-request-trip',{body});
  if(error)throw error;
  if(!data||data.error)throw new Error(data?.error||'No fue posible contactar a la central.');
  return data as T;
}

export async function requestPassengerRide(input:RequestRideInput):Promise<PassengerTripSnapshot>{
  return invoke<PassengerTripSnapshot>({action:'request',...input});
}

export async function getPassengerRideStatus(tripId:string,phone:string):Promise<PassengerTripSnapshot>{
  return invoke<PassengerTripSnapshot>({action:'status',tripId,phone});
}
