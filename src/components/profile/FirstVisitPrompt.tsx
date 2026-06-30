'use client';

import { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import ProfileModal from './ProfileModal';

export default function FirstVisitPrompt() {
  const { profile } = useProfile();
  const [modalOpen, setModalOpen] = useState(false);

  if (profile) return null;

  return (
    <>
      <p className="text-sm text-gray-500 dark:text-slate-400">
        Save your league IDs — set up a profile to jump straight to your leagues
        next time.{' '}
        <button
          onClick={() => setModalOpen(true)}
          className="font-medium text-green-600 underline hover:text-green-500 dark:text-green-400"
        >
          Set up →
        </button>
      </p>
      {modalOpen && <ProfileModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
