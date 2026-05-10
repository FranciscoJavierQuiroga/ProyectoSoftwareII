import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Login } from './login';
import { ApiService } from '../../services/api.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

describe('LoginComponent', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let mockRouter: jest.Mocked<Router>;
  let mockApiService: jest.Mocked<ApiService>;

  beforeEach(async () => {
    // Crear mocks
    mockRouter = {
      navigate: jest.fn()
    } as any;

    mockApiService = {
      login: jest.fn()
    } as any;

    await TestBed.configureTestingModule({
      imports: [Login, FormsModule, CommonModule],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: ApiService, useValue: mockApiService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    
    // Limpiar localStorage antes de cada prueba
    localStorage.clear();
    
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty username and password', () => {
    expect(component.username).toBe('');
    expect(component.password).toBe('');
    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
    expect(component.success).toBeNull();
  });

  it('should show error when username is empty', async () => {
    component.username = '';
    component.password = 'password123';
    
    await component.login();
    
    expect(component.error).toBe('Usuario y contraseña son requeridos');
    expect(mockApiService.login).not.toHaveBeenCalled();
  });

  it('should show error when password is empty', async () => {
    component.username = 'testuser';
    component.password = '';
    
    await component.login();
    
    expect(component.error).toBe('Usuario y contraseña son requeridos');
    expect(mockApiService.login).not.toHaveBeenCalled();
  });

  it('should call login API with correct credentials', async () => {
    const mockResponse = {
      access_token: 'mock-token-123',
      role: 'estudiante'
    };
    
    mockApiService.login.mockReturnValue(of(mockResponse));
    
    component.username = 'testuser';
    component.password = 'password123';
    
    await component.login();
    
    expect(mockApiService.login).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'password123'
    });
  });

  it('should store token in localStorage on successful login', async () => {
    const mockResponse = {
      access_token: 'mock-token-123',
      role: 'estudiante'
    };
    
    mockApiService.login.mockReturnValue(of(mockResponse));
    
    component.username = 'testuser';
    component.password = 'password123';
    
    await component.login();
    
    expect(localStorage.getItem('access_token')).toBe('mock-token-123');
  });

  it('should navigate to student dashboard for estudiante role', async () => {
    const mockResponse = {
      access_token: 'mock-token-123',
      role: 'estudiante'
    };
    
    mockApiService.login.mockReturnValue(of(mockResponse));
    
    component.username = 'student@test.com';
    component.password = 'password123';
    
    await component.login();
    
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/student']);
  });

  it('should navigate to teacher dashboard for docente role', async () => {
    const mockResponse = {
      access_token: 'mock-token-456',
      role: 'docente'
    };
    
    mockApiService.login.mockReturnValue(of(mockResponse));
    
    component.username = 'teacher@test.com';
    component.password = 'password123';
    
    await component.login();
    
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/teacher']);
  });

  it('should navigate to admin dashboard for administrador role', async () => {
    const mockResponse = {
      access_token: 'mock-token-789',
      role: 'administrador'
    };
    
    mockApiService.login.mockReturnValue(of(mockResponse));
    
    component.username = 'admin@test.com';
    component.password = 'password123';
    
    await component.login();
    
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/admin']);
  });

  it('should show error when user has no role', async () => {
    const mockResponse = {
      access_token: 'mock-token-123',
      role: null
    };
    
    mockApiService.login.mockReturnValue(of(mockResponse));
    
    component.username = 'noroleuser';
    component.password = 'password123';
    
    await component.login();
    
    expect(component.error).toBe('Inicio de sesión correcto pero el usuario no tiene rol asignado.');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should not navigate for unauthorized role', async () => {
    const mockResponse = {
      access_token: 'mock-token-123',
      role: 'unauthorized_role'
    };
    
    mockApiService.login.mockReturnValue(of(mockResponse));
    
    // Mock window.alert
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    
    component.username = 'baduser';
    component.password = 'password123';
    
    await component.login();
    
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('Acceso denegado')
    );
    
    alertSpy.mockRestore();
  });

  it('should handle API error', async () => {
    const errorMessage = 'Error de conexión';
    mockApiService.login.mockReturnValue(
      throwError(() => ({ message: errorMessage }))
    );
    
    component.username = 'testuser';
    component.password = 'password123';
    
    await component.login();
    
    expect(component.error).toBe(errorMessage);
    expect(component.loading).toBe(false);
  });

  it('should set loading to true during login', () => {
    mockApiService.login.mockReturnValue(of({
      access_token: 'token',
      role: 'estudiante'
    }));
    
    component.username = 'testuser';
    component.password = 'password123';
    
    component.login();
    
    expect(component.loading).toBe(true);
  });

  it('should set loading to false after login completes', async () => {
    mockApiService.login.mockReturnValue(of({
      access_token: 'token',
      role: 'estudiante'
    }));
    
    component.username = 'testuser';
    component.password = 'password123';
    
    await component.login();
    
    expect(component.loading).toBe(false);
  });

  it('should clear error on new login attempt', async () => {
    component.error = 'Previous error';
    
    mockApiService.login.mockReturnValue(of({
      access_token: 'token',
      role: 'estudiante'
    }));
    
    component.username = 'testuser';
    component.password = 'password123';
    
    await component.login();
    
    expect(component.error).toBeNull();
  });

  it('should prevent default form submission', async () => {
    const mockEvent = {
      preventDefault: jest.fn()
    } as any;
    
    mockApiService.login.mockReturnValue(of({
      access_token: 'token',
      role: 'estudiante'
    }));
    
    component.username = 'testuser';
    component.password = 'password123';
    
    await component.login(mockEvent);
    
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });
});
