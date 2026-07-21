import { Outlet } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";
import { AdminProvider } from "../../context/AdminContext";

const AdminLayout = () => {
  return (
    <AdminProvider>
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <div className="flex min-h-screen">
          <AdminSidebar />
          <main className="flex-1 p-6 lg:p-8 bg-slate-950">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminProvider>
  );
};

export default AdminLayout;


