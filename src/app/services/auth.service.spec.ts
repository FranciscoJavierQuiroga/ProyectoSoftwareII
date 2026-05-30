import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService]
    });
    service = TestBed.inject(AuthService);
    
    // Limpiar localStorage antes de cada prueba
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('setToken', () => {
    it('should store token in localStorage when token is provided', () => {
      const token = 'test-token-123';
      
      service.setToken(token);
      
      expect(localStorage.getItem('access_token')).toBe(token);
    });

    it('should remove token from localStorage when token is null', () => {
      // Primero guardar un token
      localStorage.setItem('access_token', 'existing-token');
      
      service.setToken(null);
      
      expect(localStorage.getItem('access_token')).toBeNull();
    });

    it('should remove token from localStorage when token is undefined', () => {
      localStorage.setItem('access_token', 'existing-token');
      
      service.setToken(undefined as any);
      
      expect(localStorage.getItem('access_token')).toBeNull();
    });

    it('should overwrite existing token', () => {
      localStorage.setItem('access_token', 'old-token');
      
      const newToken = 'new-token-456';
      service.setToken(newToken);
      
      expect(localStorage.getItem('access_token')).toBe(newToken);
    });
  });

  describe('getToken', () => {
    it('should return token from localStorage when it exists', () => {
      const token = 'stored-token-789';
      localStorage.setItem('access_token', token);
      
      const result = service.getToken();
      
      expect(result).toBe(token);
    });

    it('should return null when no token is stored', () => {
      const result = service.getToken();
      
      expect(result).toBeNull();
    });

    it('should return the most recent token', () => {
      service.setToken('first-token');
      service.setToken('second-token');
      
      const result = service.getToken();
      
      expect(result).toBe('second-token');
    });
  });

  describe('clear', () => {
    it('should remove token from localStorage', () => {
      localStorage.setItem('access_token', 'token-to-clear');
      
      service.clear();
      
      expect(localStorage.getItem('access_token')).toBeNull();
    });

    it('should not throw error when clearing non-existent token', () => {
      expect(() => service.clear()).not.toThrow();
    });

    it('should clear token multiple times without error', () => {
      service.setToken('token');
      service.clear();
      service.clear();
      service.clear();
      
      expect(localStorage.getItem('access_token')).toBeNull();
    });
  });

  describe('Integration tests', () => {
    it('should handle complete authentication flow', () => {
      // Login flow
      const token = 'auth-token-flow';
      service.setToken(token);
      expect(service.getToken()).toBe(token);
      
      // Logout flow
      service.clear();
      expect(service.getToken()).toBeNull();
    });

    it('should handle token refresh', () => {
      service.setToken('old-token');
      expect(service.getToken()).toBe('old-token');
      
      // Refresh token
      service.setToken('refreshed-token');
      expect(service.getToken()).toBe('refreshed-token');
    });
  });
});
