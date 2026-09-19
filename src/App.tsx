import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CrmProvider } from './context/CrmContext';
import { Navbar, ActiveTab } from './components/Navbar';
import { KanbanBoard } from './components/KanbanBoard';
import { ContactListView } from './components/ContactListView';
import { DashboardView } from './components/DashboardView';
import { CsvImportExport } from './components/CsvImportExport';
import { UserManagement } from './components/UserManagement';
import { ContactModal } from './components/ContactModal';
import { LoginView } from './components/LoginView';
import { Contacto } from './types/crm';
import { testFirestoreConnection } from './firebase';
import { RefreshCw } from 'lucide-react';

const MainApp: React.FC = () => {
  const { userProfile, loading, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('kanban');
  const [selectedContact, setSelectedContact] = useState<Contacto | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isNewContact, setIsNewContact] = useState(false);

  // Fix: Reset page scroll position to top whenever changing sections (from mobile bottom nav or desktop nav)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [activeTab]);

  // Test Firestore connection on startup conforming to skill
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[#FF8407]" />
        <p className="text-sm font-semibold">Cargando QuickCRM Quicksurfaces...</p>
      </div>
    );
  }

  // Not logged in -> Show Login View
  if (!userProfile) {
    return <LoginView />;
  }

  const handleOpenContact = (contact: Contacto) => {
    setSelectedContact(contact);
    setIsNewContact(false);
    setIsContactModalOpen(true);
  };

  const handleNewContact = () => {
    setSelectedContact(null);
    setIsNewContact(true);
    setIsContactModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col text-slate-900 selection:bg-[#FF8407]/20 selection:text-[#FF8407]">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewContact={handleNewContact}
        onOpenContact={handleOpenContact}
      />

      {/* Main View Router */}
      <main className="flex-1 pb-20 md:pb-6">
        {activeTab === 'kanban' && (
          <KanbanBoard
            onOpenContact={handleOpenContact}
            onNewContact={handleNewContact}
          />
        )}

        {activeTab === 'list' && (
          <ContactListView
            onOpenContact={handleOpenContact}
            onNewContact={handleNewContact}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            onOpenContact={handleOpenContact}
            onGoToKanban={() => setActiveTab('kanban')}
          />
        )}

        {activeTab === 'csv' && isAdmin && (
          <CsvImportExport
            onGoToKanban={() => setActiveTab('kanban')}
            onGoToUsers={() => setActiveTab('users')}
          />
        )}

        {activeTab === 'users' && isAdmin && <UserManagement />}
      </main>

      {/* Contact Sheet / Modal */}
      <ContactModal
        contact={selectedContact}
        isOpen={isContactModalOpen}
        onClose={() => {
          setIsContactModalOpen(false);
          setSelectedContact(null);
          setIsNewContact(false);
        }}
        isNew={isNewContact}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CrmProvider>
        <MainApp />
      </CrmProvider>
    </AuthProvider>
  );
}
