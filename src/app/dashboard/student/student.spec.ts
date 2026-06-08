import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { StudentDashboard } from './student';
import { ApiService } from '../../services/api.service';
import { of, throwError } from 'rxjs';

describe('StudentDashboard', () => {
  let component: StudentDashboard;
  let fixture: ComponentFixture<StudentDashboard>;
  let apiService: any;

  beforeEach(async () => {
    // Mock del ApiService usando Jest - INCLUYE TODOS LOS MÉTODOS
    const apiServiceMock = {
      getStudentGrades: jest.fn().mockReturnValue(of([
        { subject: 'Matemáticas', score: 4.5, period: 1 },
        { subject: 'Español', score: 4.2, period: 1 }
      ])),
      getStudentNotifications: jest.fn().mockReturnValue(of([
        { id: 1, message: 'Nueva tarea', date: '2024-11-19', read: false }
      ])),
      getStudentSchedule: jest.fn().mockReturnValue(of([
        { day: 'Lunes', subject: 'Matemáticas', time: '08:00 - 09:00' }
      ]))
    };

    await TestBed.configureTestingModule({
      imports: [
        StudentDashboard,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: ApiService, useValue: apiServiceMock }
      ]
    }).compileComponents();

    apiService = TestBed.inject(ApiService);

    fixture = TestBed.createComponent(StudentDashboard);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call loadAll on init', () => {
    const loadAllSpy = jest.spyOn(component, 'loadAll');
    component.ngOnInit();
    expect(loadAllSpy).toHaveBeenCalled();
  });

  it('should load grades on init', () => {
    fixture.detectChanges();
    expect(apiService.getStudentGrades).toHaveBeenCalled();
  });

  it('should load notifications on init', () => {
    fixture.detectChanges();
    expect(apiService.getStudentNotifications).toHaveBeenCalled();
  });

  it('should load schedule on init', () => {
    fixture.detectChanges();
    expect(apiService.getStudentSchedule).toHaveBeenCalled();
  });

  it('should set loading to true when loadAll is called', () => {
    component.loadAll();
    expect(component.loading).toBe(true);
  });

  it('should set loading to false after timeout', (done) => {
    component.loadAll();
    setTimeout(() => {
      expect(component.loading).toBe(false);
      done();
    }, 600);
  });

  it('should populate grades when API returns data', () => {
    fixture.detectChanges();
    expect(component.grades).toBeTruthy();
    expect(component.grades.length).toBeGreaterThan(0);
  });

  it('should populate notifications when API returns data', () => {
    fixture.detectChanges();
    expect(component.notifications).toBeTruthy();
  });

  it('should populate schedule when API returns data', () => {
    fixture.detectChanges();
    expect(component.schedule).toBeTruthy();
  });

  it('should handle grades API error', () => {
    apiService.getStudentGrades.mockReturnValue(throwError(() => new Error('Error')));
    fixture.detectChanges();
    expect(component.error).toBe('Error al cargar calificaciones');
  });

  it('should handle notifications API error', () => {
    apiService.getStudentNotifications.mockReturnValue(throwError(() => new Error('Error')));
    fixture.detectChanges();
    expect(component.error).toContain('Error al cargar');
  });

  it('should handle schedule API error', () => {
    apiService.getStudentSchedule.mockReturnValue(throwError(() => new Error('Error')));
    fixture.detectChanges();
    expect(component.error).toContain('Error al cargar');
  });

  it('should reset error when loadAll is called', () => {
    component.error = 'Previous error';
    component.loadAll();
    expect(component.error).toBeNull();
  });

  it('should handle empty grades array', () => {
    apiService.getStudentGrades.mockReturnValue(of([]));
    fixture.detectChanges();
    expect(component.grades).toEqual([]);
  });

  it('should handle empty notifications array', () => {
    apiService.getStudentNotifications.mockReturnValue(of([]));
    fixture.detectChanges();
    expect(component.notifications).toEqual([]);
  });

  it('should handle empty schedule array', () => {
    apiService.getStudentSchedule.mockReturnValue(of([]));
    fixture.detectChanges();
    expect(component.schedule).toEqual([]);
  });

  it('should call all API methods when loadAll is invoked', () => {
    component.loadAll();
    expect(apiService.getStudentGrades).toHaveBeenCalled();
    expect(apiService.getStudentNotifications).toHaveBeenCalled();
    expect(apiService.getStudentSchedule).toHaveBeenCalled();
  });
});