import React from 'react';
import { Building2, Loader2, Navigation } from 'lucide-react';

export const DriverCentralFinder: React.FC<{
  locationBusy: boolean;
  loading: boolean;
  hint: string;
  onNearby: () => void;
  onAllCities: () => void;
}> = ({ locationBusy, loading, hint, onNearby, onAllCities }) => (
  <div className="cg-central-search-tools">
    <button type="button" disabled={locationBusy || loading} onClick={onNearby} className="cg-nearby-button">
      {locationBusy ? <Loader2 className="animate-spin" /> : <Navigation />}
      {locationBusy ? 'Buscando ubicación…' : 'Centrales cerca de mí'}
    </button>
    <button type="button" disabled={loading} onClick={onAllCities} className="cg-nearby-button cg-nearby-button-secondary">
      <Building2 />Ver todas las ciudades
    </button>
    <span>{hint || 'Solo aparecen centrales con servicio activo. Puedes cambiar país o ciudad en cualquier momento.'}</span>
  </div>
);
