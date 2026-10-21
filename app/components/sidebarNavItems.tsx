import React from 'react';
import type { Sidebar } from './Sidebar';
import type { AppTab } from './MobileNavBar';
import type { Translations } from '../utils/i18n';

/** Sidebar navigation entries for the app shell (tabs plus the dependency diagnostics shortcut). */
export function buildSidebarItems(
  t: Translations,
  activeTab: AppTab,
  handleSelectTab: (nextTab: AppTab) => void,
  setIsDepModalOpen: (open: boolean) => void,
): React.ComponentProps<typeof Sidebar>['items'] {
  return [
      {
        label: t.sidebarEditor,
        href: '#editor',
        active: activeTab === 'editor',
        onClick: () => handleSelectTab('editor'),
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6v14h12v-5m-1.414-9.414L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
      },
      {
        label: t.sidebarLibrary,
        href: '#library',
        active: activeTab === 'library',
        onClick: () => handleSelectTab('library'),
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.75c-1.5-1.5-3.75-2.25-7.5-2.25v13.5c3.75 0 6 .75 7.5 2.25 1.5-1.5 3.75-2.25 7.5-2.25V4.5c-3.75 0-6 .75-7.5 2.25zM12 6.75v13.5" />
          </svg>
        ),
      },
      {
        label: t.sidebarReader,
        href: '#reader',
        active: activeTab === 'reader',
        onClick: () => handleSelectTab('reader'),
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5.25A2.25 2.25 0 016.25 3h5.25v16.5H6.25A2.25 2.25 0 004 21.75V5.25zm16 0A2.25 2.25 0 0017.75 3h-5.25v16.5h5.25A2.25 2.25 0 0120 21.75V5.25z" />
          </svg>
        ),
      },
      {
        label: t.sidebarBatch,
        href: '#batch',
        active: activeTab === 'batch_files',
        onClick: () => handleSelectTab('batch_files'),
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1h16v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        ),
      },
      {
        label: t.sidebarDeps,
        href: '#deps',
        active: false,
        onClick: () => setIsDepModalOpen(true),
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        ),
      },
  ];
}
