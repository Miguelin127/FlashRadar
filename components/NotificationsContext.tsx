// flashradar/context/NotificationsContext.tsx

import React, { createContext, useContext, useEffect, useState } from "react";
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

    const unsub = db
      .collection("notifications")
      .where("uid", "==", user.uid)
      .where("read", "==", false)
      .onSnapshot(
        (snapshot) => setUnreadCount(snapshot.docs.length),
        (err) => console.error("[NotificationsContext] listener error:", err)
      );

    return () => unsub();
  }, [user?.uid]);

  return (
    <NotificationsContext.Provider value={{ unreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);