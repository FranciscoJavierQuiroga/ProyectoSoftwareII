import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

export const RoleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const router = inject(Router);
  
  console.log('🛡️ RoleGuard ejecutándose');
  console.log('📍 Ruta intentada:', state.url);
  console.log('🎯 Ruta completa:', route);
  
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    console.warn('⚠️ RoleGuard: No token found, redirecting to login');
    router.navigate(['/login']);
    return false;
  }

  try {
    const payload = decodeToken(token);
    
    // 🔧 Buscar el rol en múltiples ubicaciones
    let userRole: string | undefined;
    
    // 1. Buscar en el campo directo 'role' (para tokens mock)
    userRole = payload.role;
    
    // 2. Si no existe, buscar en realm_access.roles
    if (!userRole && payload.realm_access?.roles) {
      const realmRoles = payload.realm_access.roles;
      userRole = realmRoles.find((r: string) => 
        ['administrador', 'docente', 'estudiante'].includes(r)
      );
    }
    
    // 3. Si no existe, buscar en resource_access[client_id].roles
    if (!userRole && payload.resource_access) {
      for (const clientId in payload.resource_access) {
        const clientRoles = payload.resource_access[clientId]?.roles || [];
        userRole = clientRoles.find((r: string) => 
          ['administrador', 'docente', 'estudiante'].includes(r)
        );
        if (userRole) break;
      }
    }
    
    console.log('👤 RoleGuard: User role detected:', userRole);
    console.log('🎭 RoleGuard: Expected role:', route.data['role']);
    
    const expectedRole = route.data['role'];
    
    // Si no se requiere rol específico, permitir acceso
    if (!expectedRole) {
      console.log('✅ No se requiere rol específico - acceso permitido');
      return true;
    }

    // Verificar coincidencia de roles
    if (matchRole(userRole || '', expectedRole)) {
      console.log('✅ Rol coincide - acceso permitido');
      return true;
    } else {
      console.warn(`⚠️ RoleGuard: Access denied. Expected: ${expectedRole}, Got: ${userRole}`);
      router.navigate(['/unauthorized']);
      return false;
    }
    
  } catch (error) {
    console.error('❌ RoleGuard: Error decoding token', error);
    router.navigate(['/login']);
    return false;
  }
};

/**
 * Decodifica un token JWT sin validar la firma (solo para leer el payload)
 */
function decodeToken(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    throw new Error('Invalid token format');
  }
}

/**
 * Compara el rol del usuario con el rol esperado
 */
function matchRole(userRole: string, expectedRole: string): boolean {
  // Normalizar roles
  const roleMap: { [key: string]: string[] } = {
    'student': ['estudiante', 'student'],
    'teacher': ['docente', 'teacher', 'profesor'],
    'admin': ['administrador', 'admin', 'administrator']
  };

  const normalizedUser = userRole?.toLowerCase();
  const normalizedExpected = expectedRole?.toLowerCase();

  // Comparación directa
  if (normalizedUser === normalizedExpected) {
    return true;
  }

  // Comparación usando el mapa de roles
  for (const [key, aliases] of Object.entries(roleMap)) {
    if (aliases.includes(normalizedExpected) && aliases.includes(normalizedUser)) {
      return true;
    }
  }

  return false;
}