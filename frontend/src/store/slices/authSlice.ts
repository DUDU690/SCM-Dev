import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/lib/api';

export type UserRole = 'ADMIN' | 'FACULTY' | 'STUDENT';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  student?: { id: string; firstName: string; lastName: string; admissionNumber: string; photoUrl?: string };
  faculty?: { id: string; firstName: string; lastName: string; employeeId: string; photoUrl?: string; designation?: string };
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  initialized: false,
};

export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/login', credentials);
      return res.data.data.user as AuthUser;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string }; status?: number } };
      const msg = error.response?.data?.error;
      if (msg && msg !== 'No refresh token') return rejectWithValue(msg);
      return rejectWithValue('Invalid email or password');
    }
  },
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/auth/me');
      return res.data.data as AuthUser;
    } catch {
      // Not authenticated — silent failure, just mark initialized
      return rejectWithValue(null);
    }
  },
);

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await api.post('/auth/logout');
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.initialized = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchCurrentUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.initialized = true;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.initialized = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.initialized = true;
      });
  },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;
