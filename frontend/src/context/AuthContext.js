// src/context/AuthContext.js
import { createContext, useContext, useEffect, useMemo, useCallback, useState } from "react";
import { jwtDecode } from "jwt-decode";
import authApi from "../api/authApi";
import axiosClient from "../api/axiosClient";

const AuthContext = createContext(null);

// Helper: safe pick access token
const getAccessToken = () => localStorage.getItem("access_token");
const setAccessToken = (t) => localStorage.setItem("access_token", t);
const getRefreshToken = () => localStorage.getItem("refresh_token");
const setRefreshToken = (t) => localStorage.setItem("refresh_token", t);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    window.location.href = "/login";
  }, []);

  // Merge patch vào user hiện tại
  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, ...patch };
    });
  }, []);

  // Normalize decoded token -> user object
  const normalizeFromToken = useCallback((decoded) => {
    const roles = Array.isArray(decoded?.roles)
      ? decoded.roles.map((r) => String(r).toUpperCase())
      : [];

    return {
      ...decoded,
      id: decoded?.id ?? decoded?.user_id ?? decoded?.sub,
      full_name: decoded?.full_name ?? decoded?.name ?? decoded?.email,
      email: decoded?.email,
      roles,
    };
  }, []);

  // Đặt user từ access token hợp lệ
  const handleToken = useCallback(
    (token) => {
      if (!token) {
        setUser(null);
        return false;
      }

      try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;

        if (decoded?.exp && decoded.exp < currentTime) {
          // Token expired -> để logic refresh xử lý, không logout ở đây
          return false;
        }

        const normalizedUser = normalizeFromToken(decoded);
        setUser(normalizedUser);
        setAccessToken(token);
        return true;
      } catch (e) {
        console.error("Lỗi xử lý token:", e);
        return false;
      }
    },
    [normalizeFromToken]
  );

  // --- Refresh access token ---
  // Bạn cần authApi.refresh() hoặc endpoint tương đương.
  // Nếu authApi của bạn chưa có refresh, bạn có thể sửa hàm này để gọi axiosClient.post("/identity/api/auth/refresh", ...)
  const refreshAccessToken = useCallback(async () => {
    const rt = getRefreshToken();
    if (!rt) return null;

    try {
      // Ưu tiên nếu bạn đã có hàm refresh trong authApi:
      // const res = await authApi.refresh({ refresh_token: rt });
      // Fallback nếu authApi không có: gọi thẳng endpoint (sửa URL cho đúng backend)
      const res =
        authApi?.refresh
          ? await authApi.refresh({ refresh_token: rt })
          : await axiosClient.post("/identity/api/auth/refresh", { refresh_token: rt });

      const data = res?.data ?? res;
      const newAccess = data?.access_token ?? data?.accessToken ?? data?.token;
      const newRefresh = data?.refresh_token ?? data?.refreshToken;

      if (newAccess) setAccessToken(newAccess);
      if (newRefresh) setRefreshToken(newRefresh);

      // Set user từ token mới
      const ok = handleToken(newAccess);
      return ok ? newAccess : null;
    } catch (e) {
      console.error("refreshAccessToken failed:", e);
      return null;
    }
  }, [handleToken]);

  // --- Refresh user profile from identity-service ---
  const refreshUser = useCallback(async () => {
    try {
      const res = await axiosClient.get("/identity/api/users/me");
      const u = res?.data ?? res;

      updateUser({
        full_name: u?.full_name ?? u?.name ?? u?.email,
        email: u?.email,
        phone: u?.phone,
        organization: u?.organization,
        department: u?.department,
        research_interests: u?.research_interests ?? [],
      });

      return u;
    } catch (e) {
      console.error("refreshUser failed:", e);
      return null;
    }
  }, [updateUser]);

  // Init auth on mount:
  // 1) nếu có access_token hợp lệ -> set user
  // 2) nếu access_token hết hạn -> thử refresh_token
  // 3) sau đó refreshUser() để lấy profile DB (phone/org/department/interests...)
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = getAccessToken();

        const ok = token ? handleToken(token) : false;
        if (!ok) {
          // thử refresh nếu có refresh_token
          const newToken = await refreshAccessToken();
          if (!newToken) {
            setUser(null);
          }
        }

        // nếu vẫn có user -> kéo profile DB
        const finalToken = getAccessToken();
        if (finalToken) {
          await refreshUser();
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [handleToken, refreshAccessToken, refreshUser]);

  // Login
  const login = useCallback(
    async (email, password) => {
      try {
        const res = await authApi.login({ email, password });
        const data = res?.data ?? res;

        const access_token = data?.access_token ?? data?.accessToken ?? data?.token;
        const refresh_token = data?.refresh_token ?? data?.refreshToken;

        if (!access_token) {
          throw new Error("Không nhận được access_token từ server");
        }

        setAccessToken(access_token);
        if (refresh_token) setRefreshToken(refresh_token);

        const ok = handleToken(access_token);
        if (ok) await refreshUser();

        return true;
      } catch (error) {
        console.error("Login failed:", error);
        throw error;
      }
    },
    [handleToken, refreshUser]
  );

  // --- Axios interceptor: auto refresh when 401 ---
  useEffect(() => {
    let isRefreshing = false;
    let queue = [];

    const resolveQueue = (err, token = null) => {
      queue.forEach((p) => {
        if (err) p.reject(err);
        else p.resolve(token);
      });
      queue = [];
    };

    const reqId = axiosClient.interceptors.request.use(
      (config) => {
        const token = getAccessToken();
        if (token && config?.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const resId = axiosClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error?.config;

        if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;

          if (isRefreshing) {
            // đợi refresh xong rồi retry
            return new Promise((resolve, reject) => {
              queue.push({
                resolve: (token) => {
                  if (token) originalRequest.headers.Authorization = `Bearer ${token}`;
                  resolve(axiosClient(originalRequest));
                },
                reject,
              });
            });
          }

          isRefreshing = true;

          try {
            const newToken = await refreshAccessToken();
            if (!newToken) {
              resolveQueue(new Error("No token"), null);
              logout();
              return Promise.reject(error);
            }

            resolveQueue(null, newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axiosClient(originalRequest);
          } catch (err) {
            resolveQueue(err, null);
            logout();
            return Promise.reject(err);
          } finally {
            isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axiosClient.interceptors.request.eject(reqId);
      axiosClient.interceptors.response.eject(resId);
    };
  }, [logout, refreshAccessToken]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      updateUser,
      refreshUser,
    }),
    [user, loading, login, logout, updateUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
