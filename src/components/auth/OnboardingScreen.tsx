import React from 'react';
import { readDriverInviteTokenFromUrl, readRememberedDriverInviteToken } from '../../lib/driverInvite';
import { DriverInviteAcceptGate } from './DriverInviteAcceptGate';
import { OnboardingScreen as StandardOnboardingScreen } from './OnboardingScreenBase';

export const OnboardingScreen: React.FC = () => {
  const token = readDriverInviteTokenFromUrl() || readRememberedDriverInviteToken();
  return token ? <DriverInviteAcceptGate token={token} /> : <StandardOnboardingScreen />;
};
