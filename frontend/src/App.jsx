import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/Layout';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Home';
import Profile from './components/Profile';
import Wallet from './components/Wallet';
import Referral from './components/Referral';
import Friends from './components/Friends';
import SettingsLayout from './components/SettingsLayout';
import Settings from './components/Settings';
import SettingsProfile from './components/SettingsProfile';
import SettingsPrivacy from './components/SettingsPrivacy';
import SettingsNotifications from './components/SettingsNotifications';
import SettingsVerification from './components/SettingsVerification';
import SettingsSecurity from './components/SettingsSecurity';
import SettingsAccount from './components/SettingsAccount';
import PublicProfile from './components/PublicProfile';
import Subscriptions from './components/Subscriptions';
import Events from './components/Events';
import Notifications from './components/Notifications';
import EventForm from './components/EventForm';
import Order from './components/Order';
import TransactionHistory from './components/TransactionHistory';
import Support from './components/Support';
import MerchantLayout from './components/MerchantLayout';
import MerchantDashboard from './components/MerchantDashboard';
import MerchantCompanies from './components/MerchantCompanies';
import MerchantOffers from './components/MerchantOffers';
import MerchantStatistics from './components/MerchantStatistics';
import MerchantEvents from './components/MerchantEvents';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './components/AdminDashboard';
import AdminUsers from './components/AdminUsers';
import AdminCompanies from './components/AdminCompanies';
import AdminOffers from './components/AdminOffers';
import AdminVerifications from './components/AdminVerifications';
import AdminSupport from './components/AdminSupport';
import AdminAudit from './components/AdminAudit';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="profile" element={<Profile />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="referral" element={<Referral />} />
            <Route path="friends" element={<Friends />} />
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<Settings />} />
              <Route path="profile" element={<SettingsProfile />} />
              <Route path="privacy" element={<SettingsPrivacy />} />
              <Route path="notifications" element={<SettingsNotifications />} />
              <Route path="verification" element={<SettingsVerification />} />
              <Route path="security" element={<SettingsSecurity />} />
              <Route path="account" element={<SettingsAccount />} />
            </Route>
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="events" element={<Events />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="events/new" element={<EventForm />} />
            <Route path=":handle" element={<PublicProfile />} />
            <Route path="order" element={<Order />} />
            <Route path="history" element={<TransactionHistory />} />
            <Route path="support" element={<Support />} />
          </Route>
          <Route path="/merchant" element={<MerchantLayout />}>
            <Route index element={<MerchantDashboard />} />
            <Route path="companies" element={<MerchantCompanies />} />
            <Route path="offers" element={<MerchantOffers />} />
            <Route path="statistics" element={<MerchantStatistics />} />
            <Route path="events" element={<MerchantEvents />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="companies" element={<AdminCompanies />} />
            <Route path="offers" element={<AdminOffers />} />
            <Route path="verifications" element={<AdminVerifications />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
