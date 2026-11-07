import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import PublicLayout from "./components/PublicLayout";
import RequireRole from "./components/RequireRole";
import Home from "./pages/Home";
import Properties from "./pages/Properties";
import PropertyDetails from "./pages/PropertyDetails";
import Contact from "./pages/Contact";
import AdminLogin from "./pages/AdminLogin";
import NotFound from "./pages/NotFound";

import AdminLayout from "./components/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import AdminProperties from "./pages/admin/AdminProperties";
import AdminClients from "./pages/admin/AdminClients";
import AdminContracts from "./pages/admin/AdminContracts";
import AdminRequests from "./pages/admin/AdminRequests";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminReports from "./pages/admin/AdminReports";

const STAFF = ["ADMIN", "MANAGER", "AGENT", "VIEWER"];
const WRITERS = ["ADMIN", "MANAGER", "AGENT"];

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/:id" element={<PropertyDetails />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="/admin/login" element={<AdminLogin />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route
            index
            element={
              <RequireRole allow={["ADMIN", "MANAGER"]}>
                <Dashboard />
              </RequireRole>
            }
          />
          <Route
            path="properties"
            element={
              <RequireRole allow={WRITERS}>
                <AdminProperties />
              </RequireRole>
            }
          />
          <Route
            path="clients"
            element={
              <RequireRole allow={STAFF}>
                <AdminClients />
              </RequireRole>
            }
          />
          <Route
            path="contracts"
            element={
              <RequireRole allow={STAFF}>
                <AdminContracts />
              </RequireRole>
            }
          />
          <Route
            path="requests"
            element={
              <RequireRole allow={STAFF}>
                <AdminRequests />
              </RequireRole>
            }
          />
          <Route
            path="reports"
            element={
              <RequireRole allow={["ADMIN", "MANAGER"]}>
                <AdminReports />
              </RequireRole>
            }
          />
          <Route
            path="users"
            element={
              <RequireRole allow={["ADMIN"]}>
                <AdminUsers />
              </RequireRole>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
