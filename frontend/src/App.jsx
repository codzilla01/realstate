import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import PublicLayout from "./components/PublicLayout";
import Home from "./pages/Home";
import Properties from "./pages/Properties";
import PropertyDetails from "./pages/PropertyDetails";
import Contact from "./pages/Contact";
import AdminLogin from "./pages/AdminLogin";

import AdminLayout from "./components/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import AdminProperties from "./pages/admin/AdminProperties";
import AdminClients from "./pages/admin/AdminClients";
import AdminContracts from "./pages/admin/AdminContracts";
import AdminRequests from "./pages/admin/AdminRequests";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminReports from "./pages/admin/AdminReports";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/:id" element={<PropertyDetails />} />
          <Route path="/contact" element={<Contact />} />
        </Route>

        <Route path="/admin/login" element={<AdminLogin />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="properties" element={<AdminProperties />} />
          <Route path="clients" element={<AdminClients />} />
          <Route path="contracts" element={<AdminContracts />} />
          <Route path="requests" element={<AdminRequests />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
