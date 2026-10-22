import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
}

const initialState: UiState = {
  sidebarOpen: true,
  theme: (localStorage.getItem('theme') as UiState['theme']) || 'system',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    setTheme(state, action: PayloadAction<UiState['theme']>) {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
    },
  },
});

export const { toggleSidebar, setSidebarOpen, setTheme } = uiSlice.actions;
export default uiSlice.reducer;
