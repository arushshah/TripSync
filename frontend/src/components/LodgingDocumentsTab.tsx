'use client';

import React from 'react';
import { UserRole } from '../types';
import { DocumentsTab } from './DocumentsTab';
import { Building } from 'lucide-react';

type LodgingDocumentsTabProps = {
  tripId: string;
  currentUserId: string;
  userRole: UserRole | null;
};

export function LodgingDocumentsTab({ tripId, currentUserId, userRole }: LodgingDocumentsTabProps) {
  return (
    <DocumentsTab
      tripId={tripId}
      currentUserId={currentUserId}
      userRole={userRole}
      documentType="accommodation"
      title="Lodging Documents"
      description="Upload and manage your accommodation documents"
      icon={<Building className="h-5 w-5" />}
    />
  );
}