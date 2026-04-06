import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, apiClient } from '@/lib/api';
import logger from '@/lib/logger';
import { toast } from 'sonner';

export interface User {
  id: string;
  email: string;
  plan: 'free' | 'premium';
  subscription_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

/**
 * Hook for authentication
 */
export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get current user
  const token = apiClient.getToken();
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await api.auth.me();
      if (response.success && response.data) {
        // Token is automatically updated by apiClient when response includes a new token
        // This happens every time /api/auth/me is called, refreshing the token
        return response.data as User;
      }
      // Only clear token if it's a 401 (unauthorized) - don't clear on network errors
      if (response.error?.statusCode === 401) {
        apiClient.setToken(null);
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      // For other errors (network, 500, etc.), don't clear token - just throw error
      const message = response.error?.message || 'Failed to get user';
      logger.error('Auth status request failed', {
        statusCode: response.error?.statusCode,
        message,
      });
      throw new Error(message);
    },
    retry: (failureCount, error: any) => {
      // Retry up to 3 times, but not for 401 errors
      if (error?.message?.includes('Session expirée') || error?.message?.includes('401')) {
        return false; // Don't retry on 401
      }
      return failureCount < 3; // Retry up to 3 times for other errors
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
    enabled: !!token,
    // Refetch every 60 seconds to detect premium status changes (reduced from 30s to avoid rate limiting)
    refetchInterval: 60 * 1000, // 60 seconds
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to the page (important for PWA)
    refetchOnMount: true, // Always refetch on mount to get latest status
    refetchOnReconnect: true, // Refetch when network reconnects
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await api.auth.register(email, password);
      if (response.success && response.data) {
        const authData = response.data as AuthResponse;
        apiClient.setToken(authData.token);
        return authData;
      }
      throw new Error(response.error?.message || 'Registration failed');
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data.user);
      toast.success('Compte créé avec succès ! Bienvenue 🎉');
      navigate('/dashboard');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de l\'inscription');
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await api.auth.login(email, password);
      if (response.success && response.data) {
        const authData = response.data as AuthResponse;
        apiClient.setToken(authData.token);
        return authData;
      }
      throw new Error(response.error?.message || 'Login failed');
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data.user);
      toast.success('Connexion réussie !');
      navigate('/dashboard');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la connexion');
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await api.auth.logout();
      if (!response.success) {
        throw new Error(response.error?.message || 'Logout failed');
      }
    },
    onSuccess: () => {
      apiClient.setToken(null);
      queryClient.clear();
      toast.success('Déconnexion réussie');
      navigate('/auth');
    },
    onError: (error: Error) => {
      // Even if logout fails, clear local state
      apiClient.setToken(null);
      queryClient.clear();
      toast.error(error.message || 'Erreur lors de la déconnexion');
      navigate('/auth');
    },
  });

  const isAuthenticated = !!apiClient.getToken() && !!user;
  const isPremium = true; // Forcé en true (Option Premium retirée)

  return {
    user,
    isLoading,
    error,
    isAuthenticated,
    isPremium,
    register: registerMutation.mutate,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isRegistering: registerMutation.isPending,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}

