import { Outlet } from "react-router-dom";
import DistributorSidebar from "../../components/DistributorSidebar";
import { DistributorProvider } from "../../context/DistributorContext";

const DistributorLayout = () => {
  return (
    <DistributorProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen">
          <DistributorSidebar />
          <main className="flex-1 p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </DistributorProvider>
  );
};

export default DistributorLayout;


