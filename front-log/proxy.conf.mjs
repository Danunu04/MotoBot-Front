export default {
  '/api': {
    target: 'http://localhost:8000',
    secure: false,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
};
