import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Authentication', () => {
    it('should send POST request to login endpoint', () => {
      const mockCredentials = {
        username: 'testuser',
        password: 'testpass'
      };
      const mockResponse = {
        access_token: 'mock-token',
        role: 'estudiante'
      };

      service.login(mockCredentials).subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${environment.api.login}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockCredentials);
      req.flush(mockResponse);
    });
  });

  describe('Dashboard', () => {
    it('should get dashboard data', () => {
      const mockData = { message: 'Dashboard data' };

      service.getDashboard().subscribe(response => {
        expect(response).toEqual(mockData);
      });

      const req = httpMock.expectOne(`${environment.api.admin}/dashboard-general`);
      expect(req.request.method).toBe('GET');
      req.flush(mockData);
    });
  });

  describe('Students', () => {
    it('should get students list', () => {
      const mockStudents = {
        success: true,
        data: [
          { _id: '1', nombres: 'Juan', apellidos: 'Pérez' },
          { _id: '2', nombres: 'María', apellidos: 'García' }
        ],
        count: 2
      };

      service.getStudentsList().subscribe(response => {
        expect(response).toEqual(mockStudents);
      });

      const req = httpMock.expectOne(`${environment.api.students}/students`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStudents);
    });

    it('should get student grades', () => {
      const mockGrades = {
        success: true,
        data: [
          { curso: 'Matemáticas', nota: 4.5 }
        ]
      };

      service.getStudentGrades().subscribe(response => {
        expect(response).toEqual(mockGrades);
      });

      const req = httpMock.expectOne(`${environment.api.students}/student/grades`);
      expect(req.request.method).toBe('GET');
      req.flush(mockGrades);
    });

    it('should get student notifications', () => {
      const mockNotifications = {
        notifications: [
          { id: 1, message: 'Nueva tarea' }
        ]
      };

      service.getStudentNotifications().subscribe(response => {
        expect(response).toEqual(mockNotifications);
      });

      const req = httpMock.expectOne(`${environment.api.students}/student/notifications`);
      expect(req.request.method).toBe('GET');
      req.flush(mockNotifications);
    });

    it('should get student schedule', () => {
      const mockSchedule = {
        schedule: [
          { time: '08:00', subject: 'Matemáticas' }
        ]
      };

      service.getStudentSchedule().subscribe(response => {
        expect(response).toEqual(mockSchedule);
      });

      const req = httpMock.expectOne(`${environment.api.students}/student/schedule-today`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSchedule);
    });
  });

  describe('Teachers', () => {
    it('should get teachers list', () => {
      const mockTeachers = {
        success: true,
        data: [
          { _id: '1', nombres: 'Carlos', apellidos: 'López', especialidad: 'Matemáticas' }
        ],
        count: 1
      };

      service.getTeachersList().subscribe(response => {
        expect(response).toEqual(mockTeachers);
      });

      const req = httpMock.expectOne(`${environment.api.teachers}/teachers`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTeachers);
    });

    it('should get teacher groups', () => {
      const mockGroups = {
        success: true,
        groups: [
          { _id: '1', nombre_curso: 'Matemáticas 10A' }
        ]
      };

      service.getTeacherGroups().subscribe(response => {
        expect(response).toEqual(mockGroups);
      });

      const req = httpMock.expectOne(`${environment.api.teachers}/teacher/groups`);
      expect(req.request.method).toBe('GET');
      req.flush(mockGroups);
    });

    it('should get teacher pending grades', () => {
      const mockPendingGrades = [
        { course: 'Matemáticas 10A', pending: 5 }
      ];

      service.getTeacherPendingGrades().subscribe(response => {
        expect(response).toEqual(mockPendingGrades);
      });

      const req = httpMock.expectOne(`${environment.api.teachers}/teacher/pending-grades`);
      expect(req.request.method).toBe('GET');
      req.flush(mockPendingGrades);
    });

    it('should get teacher overview', () => {
      const mockOverview = {
        groups_count: 3,
        pending_grades: 15
      };

      service.getTeacherOverview().subscribe(response => {
        expect(response).toEqual(mockOverview);
      });

      const req = httpMock.expectOne(`${environment.api.teachers}/teacher/overview`);
      expect(req.request.method).toBe('GET');
      req.flush(mockOverview);
    });
  });

  describe('Admin', () => {
    it('should get admin overview', () => {
      const mockOverview = { message: 'Admin overview' };

      service.getAdminOverview().subscribe(response => {
        expect(response).toEqual(mockOverview);
      });

      const req = httpMock.expectOne(`${environment.api.admin}/dashboard-general`);
      expect(req.request.method).toBe('GET');
      req.flush(mockOverview);
    });

    it('should get admin stats', () => {
      const mockStats = {
        total_students: 500,
        active_teachers: 30,
        active_campuses: 3
      };

      service.getAdminStats().subscribe(response => {
        expect(response).toEqual(mockStats);
      });

      const req = httpMock.expectOne(`${environment.api.admin}/admin/stats`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStats);
    });

    it('should get pending tasks', () => {
      const mockTasks = {
        tasks: [
          { id: 't1', title: 'Revisión de matrículas', count: 10 }
        ]
      };

      service.getPendingTasks().subscribe(response => {
        expect(response).toEqual(mockTasks);
      });

      const req = httpMock.expectOne(`${environment.api.admin}/admin/pending-tasks`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTasks);
    });

    it('should get campuses', () => {
      const mockCampuses = {
        campuses: [
          { name: 'Sede Principal', students: 200 }
        ]
      };

      service.getCampuses().subscribe(response => {
        expect(response).toEqual(mockCampuses);
      });

      const req = httpMock.expectOne(`${environment.api.admin}/admin/campuses`);
      expect(req.request.method).toBe('GET');
      req.flush(mockCampuses);
    });

    it('should get recent stats', () => {
      const mockRecentStats = {
        recent: [
          { month: 'Nov 2025', enrollments: 45 }
        ]
      };

      service.getRecentStats().subscribe(response => {
        expect(response).toEqual(mockRecentStats);
      });

      const req = httpMock.expectOne(`${environment.api.admin}/admin/recent-stats`);
      expect(req.request.method).toBe('GET');
      req.flush(mockRecentStats);
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP errors on login', () => {
      const mockCredentials = {
        username: 'testuser',
        password: 'testpass'
      };

      service.login(mockCredentials).subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.status).toBe(401);
        }
      });

      const req = httpMock.expectOne(`${environment.api.login}/login`);
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    });

    it('should handle network errors', () => {
      service.getStudentsList().subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.error.type).toBe('error');
        }
      });

      const req = httpMock.expectOne(`${environment.api.students}/students`);
      req.error(new ProgressEvent('error'));
    });
  });
});
