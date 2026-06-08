import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';

interface Student {
  enrollment_id: string;
  student_id: string;
  student_name: string;
  student_code: string;
  average: number;
  estado: string;
  grades: any[];
}

interface GroupDetail {
  _id: string;
  nombre_curso: string;
  codigo_curso: string;
  grado: string;
  periodo: string;
  capacidad_max: number;
  docente_info: {
    nombres: string;
    apellidos: string;
    especialidad: string;
  };
}

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './group-detail.html',
  styleUrls: ['./group-detail.css']
})
export default class GroupDetailComponent implements OnInit {
  groupId: string | null = null;
  group: GroupDetail | null = null;
  students: Student[] = [];
  loading = false;
  error: string | null = null;

  // Estadísticas calculadas
  stats = {
    total_students: 0,
    aprobados: 0,
    reprobados: 0,
    sin_notas: 0,
    promedio_general: 0
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService
  ) {}

  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id');
    if (this.groupId) {
      this.loadGroupDetails();
      this.loadStudents();
    }
  }

  loadGroupDetails() {
    if (!this.groupId) return;

    this.loading = true;
    this.api.getGroupById(this.groupId).subscribe({
      next: (res: any) => {
        if (res.success && res.group) {
          this.group = res.group;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading group:', err);
        this.error = 'Error al cargar detalles del grupo';
        this.loading = false;
      }
    });
  }

  loadStudents() {
    if (!this.groupId) return;

    this.loading = true;
    this.api.getCourseGrades(this.groupId).subscribe({
      next: (res: any) => {
        if (res.success && res.students) {
          this.students = res.students;
          this.calculateStats();
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading students:', err);
        this.error = 'Error al cargar estudiantes';
        this.loading = false;
      }
    });
  }

  calculateStats() {
    this.stats.total_students = this.students.length;
    this.stats.aprobados = this.students.filter(s => s.average >= 3.0).length;
    this.stats.reprobados = this.students.filter(s => s.average < 3.0 && s.average > 0).length;
    this.stats.sin_notas = this.students.filter(s => !s.average || s.grades.length === 0).length;

    const sumaPromedios = this.students.reduce((sum, s) => sum + (s.average || 0), 0);
    this.stats.promedio_general = this.students.length > 0 
      ? Math.round((sumaPromedios / this.students.length) * 100) / 100 
      : 0;
  }

  goToGrades() {
    this.router.navigate(['/dashboard/teacher/grades']);
  }

  goToAttendance() {
    this.router.navigate(['/dashboard/teacher/attendance']);
  }

  goBack() {
    this.router.navigate(['/dashboard/teacher']);
  }

  viewStudentDetail(student: Student) {
    // Implementar vista detallada del estudiante
    alert(`Vista detallada del estudiante: ${student.student_name}\nEsta funcionalidad se implementará próximamente.`);
  }
}