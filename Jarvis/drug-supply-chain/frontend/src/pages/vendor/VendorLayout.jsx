import { Outlet } from "react-router-dom";
import VendorSidebar from "../../components/VendorSidebar";
import { VendorProvider } from "../../context/VendorContext";

const VendorLayout = () => {
  return (
    <VendorProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen">
          <VendorSidebar />
          <main className="flex-1 p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </VendorProvider>
  );
};

export default VendorLayout;


