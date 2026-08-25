import React, { useMemo, useState } from 'react';
import { readDriverInviteCodeFromUrl } from '../../lib/driverInvite';
import { readOperatorTerminal } from '../../lib/operatorTerminal';
import { DriverInviteAuthScreen } from './DriverInviteAuthScreen';
import { OperatorTerminalLogin } from './OperatorTerminalLogin';
import { LoginScreen as StandardLoginScreen } from './LoginScreenBase';

export const LoginScreen: React.FC = () => {
  const inviteCode = readDriverInviteCodeFromUrl();
  const terminal = useMemo(() => readOperatorTerminal(), []);
  const [adminAccess, setAdminAccess] = useState(false);

  if (inviteCode) return <DriverInviteAuthScreen inviteCode={inviteCode} />;
  if (terminal && !adminAccess) return <OperatorTerminalLogin terminal={terminal} onAdminAccess={() => setAdminAccess(true)} />;
  return <StandardLoginScreen />;
};
