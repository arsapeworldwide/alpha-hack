import { createContext, useContext } from 'react';
import type { SessionUser } from '../../api/sessionApi';

interface AuthValue { user: SessionUser; logout: () => Promise<void> }
export const mockUser: SessionUser = { login: 'mock', full_name: 'Автономное демо', role: 'client_owner', company_inns: [], can_manage_demo: false };
export const AuthContext = createContext<AuthValue>({ user: mockUser, logout: async () => {} });
export const useAuth = () => useContext(AuthContext);
