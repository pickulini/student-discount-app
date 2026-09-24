import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';

// Короткая реферальная ссылка /r/КОД → регистрация с подставленным кодом.
const ReferralRedirect = () => {
  const { code } = useParams();
  return <Navigate to={`/register?ref=${encodeURIComponent(code || '')}`} replace />;
};
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/Layout';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Home';
import OfferDetail from './components/OfferDetail';
import Checkout from './components/Checkout';
import OrderReceipt from './components/OrderReceipt';
import Profile from './components/Profile';
import Wallet from './components/Wallet';
import Referral from './components/Referral';
import Friends from './components/Friends';
import SettingsLayout, { SettingsIndex } from './components/SettingsLayout';
import SettingsProfile from './components/SettingsProfile';
import SettingsPrivacy from './components/SettingsPrivacy';
import SettingsNotifications from './components/SettingsNotifications';
import SettingsSecurity from './components/SettingsSecurity';
import SettingsAccount from './components/SettingsAccount';
import SettingsAppearance from './components/SettingsAppearance';
import PublicProfile from './components/PublicProfile';
import Subscriptions from './components/Subscriptions';
import Events from './components/Events';
import Notifications from './components/Notifications';
import EventForm from './components/EventForm';
import Order from './components/Order';
import Savings from './components/Savings';
import Verification from './components/Verification';
import EventDetail from './components/EventDetail';
import TransactionHistory from './components/TransactionHistory';
import Support from './components/Support';
import MerchantLayout from './components/MerchantLayout';
import MerchantDashboard from './components/MerchantDashboard';
import MerchantCompanies from './components/MerchantCompanies';
import MerchantOffers from './components/MerchantOffers';
import MerchantStatistics from './components/MerchantStatistics';
import MerchantEvents from './components/MerchantEvents';
import MerchantCashier from './components/MerchantCashier';
import MerchantOfferEditor from './components/MerchantOfferEditor';
import MerchantOfferEdits from './components/MerchantOfferEdits';
import MerchantTransactions from './components/MerchantTransactions';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './components/AdminDashboard';
import AdminUsers from './components/AdminUsers';
import AdminUserCard from './components/AdminUserCard';
import AdminCompanies from './components/AdminCompanies';
import AdminModeration from './components/AdminModeration';
import AdminModerationReview from './components/AdminModerationReview';
import AdminVerifications from './components/AdminVerifications';
import AdminVerificationReview from './components/AdminVerificationReview';
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
            <Route path="r/:code" element={<ReferralRedirect />} />
            <Route path="profile" element={<Profile />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="referral" element={<Referral />} />
            <Route path="friends" element={<Friends />} />
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<SettingsIndex />} />
              <Route path="profile" element={<SettingsProfile />} />
              <Route path="privacy" element={<SettingsPrivacy />} />
              <Route path="notifications" element={<SettingsNotifications />} />
              <Route path="verification" element={<Navigate to="/verification" replace />} />
              <Route path="security" element={<SettingsSecurity />} />
              <Route path="account" element={<SettingsAccount />} />
              <Route path="appearance" element={<SettingsAppearance />} />
            </Route>
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="offers/:id" element={<OfferDetail />} />
            <Route path="offers/:id/checkout" element={<Checkout />} />
            <Route path="orders/:id" element={<OrderReceipt />} />
            <Route path="events" element={<Events />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="events/new" element={<EventForm />} />
            <Route path="events/:id" element={<EventDetail />} />
            <Route path=":handle" element={<PublicProfile />} />
            <Route path="order" element={<Order />} />
            <Route path="orders" element={<Order />} />
            <Route path="savings" element={<Savings />} />
            <Route path="verification" element={<Verification />} />
            <Route path="history" element={<TransactionHistory />} />
            <Route path="support" element={<Support />} />
          </Route>
          <Route path="/merchant" element={<MerchantLayout />}>
            <Route index element={<MerchantDashboard />} />
            <Route path="companies" element={<MerchantCompanies />} />
            <Route path="offers" element={<MerchantOffers />} />
            <Route path="statistics" element={<MerchantStatistics />} />
            <Route path="events" element={<MerchantEvents />} />
            <Route path="events/new" element={<EventForm backTo="/merchant/events" />} />
            <Route path="cashier" element={<MerchantCashier />} />
            <Route path="offers/new" element={<MerchantOfferEditor />} />
            <Route path="offers/:id/edit" element={<MerchantOfferEditor />} />
            <Route path="offers/:id/edits" element={<MerchantOfferEdits />} />
            <Route path="transactions" element={<MerchantTransactions />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="moderation" element={<AdminModeration />} />
            <Route path="moderation/:id" element={<AdminModerationReview />} />
            <Route path="offers" element={<Navigate to="/admin/moderation" replace />} />
            <Route path="verifications" element={<AdminVerifications />} />
            <Route path="verifications/:id" element={<AdminVerificationReview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserCard />} />
            <Route path="companies" element={<AdminCompanies />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="journal" element={<AdminAudit />} />
            <Route path="audit" element={<Navigate to="/admin/journal" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
