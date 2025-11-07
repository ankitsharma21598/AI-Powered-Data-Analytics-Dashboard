import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { User } from "@/types/api"; // optional but recommended
import { getProfile } from "@/store/slices/authSlice";
import { AppDispatch } from "@/store/store";
import { useDispatch } from "react-redux";

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log("Token ==>", token);

    // If there's no token, stop loading immediately
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await dispatch(getProfile()).unwrap();
        console.log("Profile fetched successfully:", response);
        setUser(response); // ✅ update local user state
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        localStorage.removeItem("token");
      } finally {
        setLoading(false); // ✅ stop loading in all cases
      }
    };

    fetchProfile();
  }, [dispatch]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
