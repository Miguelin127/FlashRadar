// flashradar/context/NotificationsContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

type NotificationsContextType = {
  unreadCount: number;
};

const NotificationsContext = createContext<NotificationsContextType>({ unreadCount: 0 });

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("uid", "==", user.uid),
      where("read", "==", false)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsub();
  }, [user]);

  return (
    <NotificationsContext.Provider value={{ unreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);
