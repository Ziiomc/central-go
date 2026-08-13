import React from 'react';
import { readDriverInviteCodeFromUrl, readRememberedDriverInviteCode } from '../../lib/driverInvite';
import { DriverInviteOnboardingScreen } from './DriverInviteOnboardingScreen';
import { OnboardingScreen as StandardOnboardingScreen } from './OnboardingScreenBase';

export const OnboardingScreen: React.FC = () => {
  const inviteCode = readDriverInviteCodeFromUrl() || readRememberedDriverInviteCode();
  return inviteCode ? <DriverInviteOnboardingScreen inviteCode={inviteCode} /> : <StandardOnboardingScreen />;
};
