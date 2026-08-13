import React from 'react';
import { readDriverInviteTokenFromUrl, readRememberedDriverInviteToken } from '../../lib/driverInvite';
import { DriverInviteAcceptGate } from '../auth/DriverInviteAcceptGate';
import { DriverOnboardingPortal as MarketplacePortal } from './DriverOnboardingPortalEnhanced';

export const DriverOnboardingPortal: React.FC = () => {
  const token = readDriverInviteTokenFromUrl() || readRememberedDriverInviteToken();
  return token ? <DriverInviteAcceptGate token={token} /> : <MarketplacePortal />;
};
