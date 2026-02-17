import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useAuth } from "./AuthContext";

type UserContextType = {
  isPremium: boolean;
  loading: boolean;
};

const UserContext = createContext<UserContextType>({
  isPremium: false,
  loading: true,
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsPremium(false);
      setLoading(false);
      return;
    }

    const ref = doc(db, "users", user.uid);

    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();

      setIsPremium(
        data?.premium === true ||
        data?.isPremium === true ||
        data?.subscriptionStatus === "active"
      );

      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  return (
    <UserContext.Provider value={{ isPremium, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
//
//  UserContext.tsx
//  
//
//  Created by Miguel Cz on 12/20/25.
//

