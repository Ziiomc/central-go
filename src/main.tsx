import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {PassengerRequestApp} from './components/passenger/PassengerRequestApp';
import {CollectionViewModeControls} from './components/system/CollectionViewModeControls';
import {DriverVehicleSelectionGate} from './components/driver/DriverVehicleSelectionGate';
import 'leaflet/dist/leaflet.css';
import './index.css';
import './driverReadability.css';
import './driverActionLayout.css';
import './fontSize.css';
import './lightModePremium.css';
import './premiumThemeModes.css';
import './themeInteractionFixes.css';
import './operatorLightReadability.css';
import './designSystem.css';
import './fireModePremium.css';
import './collectionListViews.css';
import './matureProductTheme.css';
import './theme2026.css';
import './operatorTheme2026Fix.css';
import './operatorTripDensity2026.css';
import './visualPolish2026.css';
import {registerServiceWorker} from './lib/pwa';
import {registerRegionalPartnerReferralBootstrap} from './lib/regionalPartnerReferralBootstrap';
import {registerGoogleOnboardingRoleBootstrap} from './lib/googleOnboardingRoleBootstrap';
import {registerDriverWakeLock} from './lib/driverWakeLock';
import {registerDriverStorageReliability} from './lib/driverStorageReliability';
import {initializeFontSizePreference} from './lib/fontSizePreference';
import {registerOperationalSnapshotSafety} from './lib/operationalSnapshotSafety';
import {registerDriverFormOptionalFields} from './lib/driverFormOptionalFields';

// Aplicar accesibilidad visual antes de montar React evita que el texto cambie de tamaño después de cargar.
initializeFontSizePreference();
registerOperationalSnapshotSafety();
registerDriverFormOptionalFields();

// Registrar PWA, atribuciones y protecciones de operación antes de montar React.
registerServiceWorker();
registerRegionalPartnerReferralBootstrap();
registerGoogleOnboardingRoleBootstrap();
registerDriverWakeLock();
registerDriverStorageReliability();

const isPassengerRoute=window.location.pathname==='/pedir'||window.location.pathname.startsWith('/passenger');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPassengerRoute?<PassengerRequestApp/>:<><DriverVehicleSelectionGate><App/></DriverVehicleSelectionGate><CollectionViewModeControls/></>}
  </StrictMode>,
);
