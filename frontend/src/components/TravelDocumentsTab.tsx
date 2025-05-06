'use client';

import React from 'react';
import { UserRole } from '../types';
import { DocumentsTab } from './DocumentsTab';
import { Plane } from 'lucide-react';

type TravelDocumentsTabProps = {
  tripId: string;
  currentUserId: string;
  userRole: UserRole | null;
};

export function TravelDocumentsTab({ tripId, currentUserId, userRole }: TravelDocumentsTabProps) {
  return (
    <DocumentsTab
      tripId={tripId}
      currentUserId={currentUserId}
      userRole={userRole}
      documentType="travel"
      title="Travel Documents"
      description="Upload and manage your travel documents"
      icon={<Plane className="h-5 w-5" />}
    />
  );
}