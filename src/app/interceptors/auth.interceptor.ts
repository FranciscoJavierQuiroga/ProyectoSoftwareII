import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('access_token');
  
  console.log('🔐 AuthInterceptor ejecutándose');
  console.log('🎫 Token:', token ? 'EXISTE' : 'NO EXISTE');
  console.log('📡 URL:', req.url);
  
  if (token) {
    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('✅ Token agregado a los headers');
    return next(clonedRequest);
  }
  
  console.log('⚠️ No se agregó token (no existe en localStorage)');
  return next(req);
};