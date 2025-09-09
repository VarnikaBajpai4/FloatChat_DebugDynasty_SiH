import React, { Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import ProtectedRoute from "./ProtectedRoute";

const Chat = React.lazy(() => import("./pages/Chat.jsx").catch(() => ({
  default: () => <div style={{ padding: 24 }}>Chat page</div>,
})));

const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  {
    path: "/chat",
    element: (
      <ProtectedRoute>
        <Outlet />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<div>Loading chat...</div>}>
            <Chat />
          </Suspense>
        ),
      },
    ],
  },
  { path: "*", element: <div style={{ padding: 24 }}>404 - Not Found</div> },
]);

export default router;