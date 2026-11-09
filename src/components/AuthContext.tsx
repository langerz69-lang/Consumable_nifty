import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile, Role, Area } from '../types';
import { api } from '../lib/api';

interface AuthContextType {
  profile: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setMockRole: (role: Role) => void;
  setActiveArea: (areaId: string) => Promise<void>;
  availableAreas: Area[];
  allUsers: UserProfile[];
  activeUserId: string | null;
  setActiveUserId: (userId: string) => void;
  refreshData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  profile: null,
  isAuthenticated: false,
  loading: true,
  login: async () => ({ success: false, error: 'Not implemented' }),
  logout: () => {},
  setMockRole: () => {},
  setActiveArea: async () => {},
  availableAreas: [],
  allUsers: [],
  activeUserId: null,
  setActiveUserId: () => {},
  refreshData: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('isLoggedIn') === 'true' && !!localStorage.getItem('activeUserId');
  });
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [availableAreas, setAvailableAreas] = useState<Area[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [activeUserId, setActiveUserIdState] = useState<string | null>(localStorage.getItem('activeUserId'));
  const [loading, setLoading] = useState(true);

  const setActiveUserId = (userId: string) => {
    localStorage.setItem('activeUserId', userId);
    setActiveUserIdState(userId);
  };

  const logout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('activeUserId');
    setActiveUserIdState(null);
    setIsAuthenticated(false);
    setProfile(null);
  };

  const setActiveArea = async (areaId: string) => {
    setActiveAreaId(areaId);
    if (profile?.id) {
      try {
        await api.updateUser(profile.id, { areaId });
        setProfile(prev => prev ? { ...prev, areaId } : null);
      } catch (err) {
        console.error("Failed to update user areaId:", err);
      }
    }
  };

  const login = async (emailInput: string, passwordInput: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await api.login(emailInput, passwordInput);
      if (!res.success || !res.user) {
        return { success: false, error: res.error || 'Authentication failed' };
      }

      const user = res.user;
      const targetAreaId = user.role === 'PRODUCTION' ? (user.areaId || activeAreaId || availableAreas[0]?.id || 'area_1') : null;
      if (targetAreaId) {
        setActiveAreaId(targetAreaId);
      }

      localStorage.setItem('activeUserId', user.id);
      localStorage.setItem('isLoggedIn', 'true');
      setActiveUserIdState(user.id);
      setIsAuthenticated(true);
      setProfile({
        ...user,
        areaId: targetAreaId
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const setMockRole = (role: Role) => {
    const targetUser = allUsers.find(u => u.role === role);
    if (targetUser) {
      setActiveUserId(targetUser.id);
    }
  };

  const refreshData = useCallback(async () => {
    try {
      const [users, areas] = await Promise.all([
        api.getUsers(),
        api.getAreas()
      ]);

      setAllUsers(users);
      setAvailableAreas(areas);

      const loggedInFlag = localStorage.getItem('isLoggedIn') === 'true';
      const storedUserId = localStorage.getItem('activeUserId');

      if (loggedInFlag && storedUserId) {
        const foundUser = users.find(u => u.id === storedUserId);
        if (foundUser && foundUser.accessAllowed !== false) {
          setIsAuthenticated(true);
          const resolvedAreaId = foundUser.role === 'PRODUCTION'
            ? (foundUser.areaId || activeAreaId || (areas[0]?.id || 'area_1'))
            : null;

          if (foundUser.role === 'PRODUCTION' && foundUser.areaId && foundUser.areaId !== activeAreaId) {
            setActiveAreaId(foundUser.areaId);
          }

          setProfile({
            ...foundUser,
            areaId: resolvedAreaId
          });
        } else {
          setIsAuthenticated(false);
          setProfile(null);
        }
      } else {
        setIsAuthenticated(false);
        setProfile(null);
      }
    } catch (err) {
      console.error("Failed to sync users and areas:", err);
    } finally {
      setLoading(false);
    }
  }, [activeAreaId]);

  useEffect(() => {
    refreshData();
    // Refresh background state every 8 seconds
    const interval = setInterval(refreshData, 8000);
    return () => clearInterval(interval);
  }, [refreshData]);

  return (
    <AuthContext.Provider value={{
      profile,
      isAuthenticated,
      loading,
      login,
      logout,
      setMockRole,
      setActiveArea,
      availableAreas,
      allUsers,
      activeUserId,
      setActiveUserId,
      refreshData
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
