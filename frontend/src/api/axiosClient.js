import axios from 'axios';

const axiosClient = axios.create({
    baseURL: 'http://127.0.0.1:8000/api',
    headers: {
        
    },
});

axiosClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    
    console.log("🚀 Request to:", config.url); 
    console.log("🔑 Token attached:", token ? "YES" : "NO");
    
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});


axiosClient.interceptors.response.use((response) => {
    return response;
}, (error) => {
    if (error.response && error.response.status === 401) {
        console.error("⛔ Lỗi 401: Token hết hạn hoặc không hợp lệ.");

    }
    throw error;
});

export default axiosClient;