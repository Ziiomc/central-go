import React from'react';
import{DriverInviteLinkPanel}from'./DriverInviteLinkPanel';
import{DriverApplicationsPanel as Base}from'./DriverApplicationsPanelBase';
import{DriverDailyServicePanel}from'./DriverDailyServicePanel';

export const DriverApplicationsPanel:React.FC<{companyId:string}>=({companyId})=><div className="space-y-4"><DriverDailyServicePanel companyId={companyId}/><DriverInviteLinkPanel companyId={companyId}/><Base companyId={companyId}/></div>;
