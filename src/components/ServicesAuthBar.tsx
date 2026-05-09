'use client';

import type { User } from '@supabase/supabase-js';
import { AccountButton } from './AccountButton';

interface ServicesAuthBarProps {
  onSignIn?: (user: User) => void;
  inline?: boolean;
}

export function ServicesAuthBar({ onSignIn, inline }: ServicesAuthBarProps) {
  return <AccountButton onSignIn={onSignIn} inline={inline} />;
}
