import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ToastNotification {
  id: string;
  title: string;
  description?: string;
  variant: 'default' | 'destructive' | 'success';
}

interface NotificationState {
  toasts: ToastNotification[];
  unreadCount: number;
}

const initialState: NotificationState = {
  toasts: [],
  unreadCount: 0,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addToast(state, action: PayloadAction<Omit<ToastNotification, 'id'>>) {
      state.toasts.push({ ...action.payload, id: Date.now().toString() });
    },
    removeToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    },
  },
});

export const { addToast, removeToast, setUnreadCount } = notificationSlice.actions;
export default notificationSlice.reducer;
