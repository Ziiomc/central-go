import React from 'react';
import { readDriverInviteTokenFromUrl, readRememberedDriverInviteToken } from '../../lib/driverInvite';
import { DriverInviteAcceptGate } from './DriverInviteAcceptGate';
import { OnboardingScreen as StandardOnboardingScreen } from './OnboardingScreenBase';
import { OperatorInviteAcceptGate } from './OperatorInviteAcceptGate';
import { useAuth } from '../../context/AuthContext';

export const OnboardingScreen: React.FC = () => {
  const { authUser } = useAuth();
  const token = readDriverInviteTokenFromUrl() || readRememberedDriverInviteToken();
  const operatorInvite = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('operator_invite') === '1'
    || authUser?.user_metadata?.operator_invite === true
  );
  if (token) return <DriverInviteAcceptGate token={token} />;
  return operatorInvite ? <OperatorInviteAcceptGate /> : <StandardOnboardingScreen />;
};
