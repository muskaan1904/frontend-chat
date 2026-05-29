import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Chat from "./pages/Chat.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

function App() {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <Login />,
    },
    {
      path: "/signup",
      element: <Signup />,
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          path: "/chat",
          element: <Chat />,
        },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}

export default App;