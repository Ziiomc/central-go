import React from 'react';
import { OperatorConsole } from './OperatorConsole';
import { ScheduledTripsStrip } from './ScheduledTripsStrip';

export const OperatorWorkspace: React.FC = () => (
  <div className="space-y-3">
    <ScheduledTripsStrip />
    <OperatorConsole />
  </div>
);
