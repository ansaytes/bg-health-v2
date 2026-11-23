'use client';

import React from 'react';
import QuestionnaireTokenGate from './QuestionnaireTokenGate';

/**
 * Route Guard kuesioner mandiri.
 * Mewajibkan One-Time Token (maks 30 menit) untuk seluruh perangkat
 * (baik tablet bersama maupun ponsel pribadi karyawan).
 */
export default function QuestionnaireRouteGuard({ children }: { children: React.ReactNode }) {
  return <QuestionnaireTokenGate>{children}</QuestionnaireTokenGate>;
}
