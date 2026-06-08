import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('HTTP Error:', error);
      
      if (error.status === 401) {
        console.warn('No autorizado - redirigiendo a login');
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        router.navigate(['/login']);
      }
      
      if (error.status === 403) {
        console.warn('Sin permisos');
        alert('No tienes permisos para acceder a este recurso');
      }
      
      return throwError(() => error);
    })
  );
};