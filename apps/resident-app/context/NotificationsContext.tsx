import React, { createContext, useContext, useState, useCallback } from "react";

type NotificationsContextValue = {
  visible: boolean;
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  open: () => void;
  close: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue>({
  visible: false,
  unreadCount: 0,
  setUnreadCount: () => {},
  open: () => {},
  close: () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  return (
    <NotificationsContext.Provider
      value={{ visible, unreadCount, setUnreadCount, open, close }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);