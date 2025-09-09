import { Outlet } from "react-router-dom";
import ProtectedRoute from "../ProtectedRoute";

export default function UserLayout() {
  return (
    <ProtectedRoute>
      <>
        {/* Add a navbar here later if needed */}
        <Outlet />
      </>
    </ProtectedRoute>
  );
}