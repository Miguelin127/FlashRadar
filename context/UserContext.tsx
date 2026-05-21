// flashradar/context/UserContext.tsx

import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { useAuth } from "./AuthContext";

type UserContextType = {
  isPremium: boolean;
  subscriptionStatus: string;
  loading: boolean;
};

const UserContext = createContext<UserContextType>({
  isPremium: false,
  subscriptionStatus: "none",
  loading: true,
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState("none");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsPremium(false);
      setSubscriptionStatus("none");
      setLoading(false);
      return;
    }

    const unsub = db
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (snap) => {
          const data = snap.data();

          const status: string = data?.subscriptionStatus ?? "none";
          const premiumActive =
            status === "active" ||
            data?.premium === true ||
            data?.isPremium === true;

          setSubscriptionStatus(status);
          setIsPremium(premiumActive);
          setLoading(false);
        },
        (error) => {
          console.error("[UserContext] Firestore listener error:", error);
          setIsPremium(false);
          setSubscriptionStatus("error");
          setLoading(false);
        }
      );

    return () => unsub();
  }, [user]);

  return (
    <UserContext.Provider value={{ isPremium, subscriptionStatus, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);