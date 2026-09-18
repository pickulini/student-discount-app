import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Home';
import Profile from './components/Profile';
import Wallet from './components/Wallet';
import Referral from './components/Referral';
import Friends from './components/Friends';
import PublicProfile from './components/PublicProfile';
import Order from './components/Order';
import TransactionHistory from './components/TransactionHistory';
import Support from './components/Support';
import MerchantLayout from './components/MerchantLayout';
import MerchantDashboard from './components/MerchantDashboard';
import MerchantCompanies from './components/MerchantCompanies';
import MerchantOffers from './components/MerchantOffers';
import MerchantStatistics from './components/MerchantStatistics';
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
    </AuthProvider>
  );
}

export default App;
