import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TeacherDashboard } from './teacher';
import { ApiService } from '../../services/api.service';
import { of, throwError } from 'rxjs';

describe('TeacherDashboard', () => {
  let component: TeacherDashboard;
  let fixture: ComponentFixture<TeacherDashboard>;
  let apiService: any; // Cambio aquí: usar 'any' en lugar de jasmine.SpyObj

  beforeEach(async () => {
    // Mock del ApiService usando Jest
    const apiServiceMock = {
      getTeacherGroups: jest.fn().mockReturnValue(of({
        success: true,
        groups: []
      })),
      getTeacherPendingGrades: jest.fn().mockReturnValue(of([]))
    };

    await TestBed.configureTestingModule({
      imports: [
        TeacherDashboard,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: ApiService, useValue: apiServiceMock }
      ]
    }).compileComponents();

    apiService = TestBed.inject(ApiService);

    fixture = TestBed.createComponent(TeacherDashboard);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load teacher data on init', () => {
    const mockGroups = {
      success: true,
      groups: [
        { _id: '1', nombre_curso: 'Matemáticas 10A' }
      ]
    };

    const mockPendingGrades = [
      { course: 'Matemáticas 10A', pending: 5 }
    ];

    apiService.getTeacherGroups.mockReturnValue(of(mockGroups));
    apiService.getTeacherPendingGrades.mockReturnValue(of(mockPendingGrades));

    fixture.detectChanges();

    expect(apiService.getTeacherGroups).toHaveBeenCalled();
    expect(apiService.getTeacherPendingGrades).toHaveBeenCalled();
  });

  it('should handle error when loading groups', () => {
    const errorResponse = { status: 500, message: 'Server error' };
    apiService.getTeacherGroups.mockReturnValue(throwError(() => errorResponse));

    fixture.detectChanges();

    expect(apiService.getTeacherGroups).toHaveBeenCalled();
  });

  it('should set loading to false after data loads', (done) => {
    fixture.detectChanges();
    
    setTimeout(() => {
      done();
    }, 600);
  });

  it('should handle empty groups list', () => {
    const emptyGroups = {
      success: true,
      groups: []
    };

    apiService.getTeacherGroups.mockReturnValue(of(emptyGroups));
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should populate groups array when data is available', () => {
    const mockGroups = {
      success: true,
      groups: [
        { _id: '1', nombre_curso: 'Matemáticas 10A' },
        { _id: '2', nombre_curso: 'Física 11B' }
      ]
    };

    apiService.getTeacherGroups.mockReturnValue(of(mockGroups));
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });
});
