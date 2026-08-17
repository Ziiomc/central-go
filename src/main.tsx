import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
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
import {registerServiceWorker} from './lib/pwa';
import {registerRegionalPartnerReferralBootstrap} from './lib/regionalPartnerReferralBootstrap';
import {registerGoogleOnboardingRoleBootstrap} from './lib/googleOnboardingRoleBootstrap';
import {registerDriverWakeLock} from './lib/driverWakeLock';
import {registerDriverStorageReliability} from './lib/driverStorageReliability';
import {initializeFontSizePreference} from './lib/fontSizePreference';
import {registerOperatorQueueUsability} from './lib/operatorQueueUsability';

// Aplicar accesibilidad visual antes de montar React evita que el texto cambie de tamaño después de cargar.
initializeFontSizePreference();
registerOperatorQueueUsability();

// Registrar PWA, atribuciones y protecciones de operación antes de montar React.
registerServiceWorker();
registerRegionalPartnerReferralBootstrap();
registerGoogleOnboardingRoleBootstrap();
registerDriverWakeLock();
registerDriverStorageReliability();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
