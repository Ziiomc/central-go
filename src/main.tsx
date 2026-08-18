import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {PassengerRequestApp} from './components/passenger/PassengerRequestApp';
import {CollectionViewModeControls} from './components/system/CollectionViewModeControls';
import 'leaflet/dist/leaflet.css';
import './index.css';
import './driverReadability.css';
import './driverActionLayout.css';
import './fontSize.css';
import './lightModePremium.css';
import './premiumThemeModes.css';
import './themeInteractionFixes.css';
import './operatorQueueUsability.css';
import './operatorPriorityLight.css';
import './operatorPriorityPremium.css';
import './designSystem.css';
import './operatorPriorityStatusColors.css';
import './fireModePremium.css';
import './operatorPriorityHarmony.css';
import './collectionListViews.css';
import {registerServiceWorker} from './lib/pwa';
import {registerRegionalPartnerReferralBootstrap} from './lib/regionalPartnerReferralBootstrap';
import {registerGoogleOnboardingRoleBootstrap} from './lib/googleOnboardingRoleBootstrap';
import {registerDriverWakeLock} from './lib/driverWakeLock';
import {registerDriverStorageReliability} from './lib/driverStorageReliability';
import {initializeFontSizePreference} from './lib/fontSizePreference';
import {registerOperatorQueueUsability} from './lib/operatorQueueUsability';
import {registerOperatorSearchShortcut} from './lib/operatorSearchShortcut';
import {registerOperationalSnapshotSafety} from './lib/operationalSnapshotSafety';

// Aplicar accesibilidad visual antes de montar React evita que el texto cambie de tamaño después de cargar.
initializeFontSizePreference();
registerOperatorQueueUsability();
registerOperatorSearchShortcut();
registerOperationalSnapshotSafety();

// Registrar PWA, atribuciones y protecciones de operación antes de montar React.
registerServiceWorker();
registerRegionalPartnerReferralBootstrap();
registerGoogleOnboardingRoleBootstrap();
registerDriverWakeLock();
registerDriverStorageReliability();

const isPassengerRoute=window.location.pathname==='/pedir'||window.location.pathname.startsWith('/passenger');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPassengerRoute?<PassengerRequestApp/>:<><App/><CollectionViewModeControls/></>}
  </StrictMode>,
);
