import { requireSupabase } from './supabase';

export type PassengerTripStatus='pending'|'assigned'|'en_route'|'in_progress'|'completed'|'cancelled';
export interface NearbyCentral{id:string;name:string;city:string;distanceKm:number;}
export interface PassengerTripSnapshot{
  tripId:string;
  code:string;
  status:PassengerTripStatus;
  centralName:string;
  centralPhone?:string;
  driverUnitNumber?:string;
  driverName?:string;
  driverRating?:number;
  driverPhotoUrl?:string;
  driverTripsCompleted?:number;
  driverLat?:number;
  driverLng?:number;
  driverHeading?:number;
  driverSpeedKmh?:number;
  vehicleUnitNumber?:string;
  vehiclePlate?:string;
  vehicleBrand?:string;
  vehicleModel?:string;
  vehicleColor?:string;
  estimatedFare?:number;
  originAddress:string;
  originLat?:number;
  originLng?:number;
  destinationAddress:string;
  destinationLat?:number;
  destinationLng?:number;
  rating?:number;
}
interface RequestRideInput{companyId?:string;passengerName:string;phone:string;pickupAddress:string;pickupLat:number;pickupLng:number;destinationAddress?:string;destinationLat?:number;destinationLng?:number;notes?:string;}

async function invoke<T>(body:Record<string,unknown>):Promise<T>{const{data,error}=await requireSupabase().functions.invoke('passenger-request-trip',{body});if(error)throw error;if(!data||data.error)throw new Error(data?.error||'No fue posible contactar a la central.');return data as T;}
export async function findNearbyCentrals(lat:number,lng:number):Promise<NearbyCentral[]>{const result=await invoke<{radiusKm:number;centrals:NearbyCentral[]}>({action:'nearby',lat,lng});return result.centrals;}
export async function requestPassengerRide(input:RequestRideInput):Promise<PassengerTripSnapshot>{return invoke<PassengerTripSnapshot>({action:'request',...input});}
export async function getPassengerRideStatus(tripId:string,phone:string):Promise<PassengerTripSnapshot>{return invoke<PassengerTripSnapshot>({action:'status',tripId,phone});}
export async function cancelPassengerRide(tripId:string,phone:string):Promise<PassengerTripSnapshot>{return invoke<PassengerTripSnapshot>({action:'cancel',tripId,phone});}
export async function ratePassengerRide(tripId:string,phone:string,rating:number):Promise<PassengerTripSnapshot>{return invoke<PassengerTripSnapshot>({action:'rate',tripId,phone,rating});}
