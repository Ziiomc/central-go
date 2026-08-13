import React from 'react';
import { readDriverInviteCodeFromUrl } from '../../lib/driverInvite';
import { DriverInviteAuthScreen } from './DriverInviteAuthScreen';
import { LoginScreen as StandardLoginScreen } from './LoginScreenBase';

export const LoginScreen: React.FC = () => {
  const inviteCode = readDriverInviteCodeFromUrl();
  return inviteCode ? <DriverInviteAuthScreen inviteCode={inviteCode} /> : <StandardLoginScreen />;
};
