import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      '서버와 통신 중 오류가 발생했습니다.';
    return Promise.reject(new Error(message));
  },
);

export default axiosInstance;
