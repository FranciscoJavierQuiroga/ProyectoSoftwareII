import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';

interface HorarioClase {
  hora: string;
  lunes: string;
  martes: string;
  miercoles: string;
  jueves: string;
  viernes: string;
}

@Component({
  selector: 'app-horario',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './horario.html',
  styleUrls: ['./horario.css']
})
export default class HorarioComponent implements OnInit {
  horario: HorarioClase[] = [];
  loading = false;
  error: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.cargarHorario();
  }

  cargarHorario() {
    this.loading = true;
    
    // Por ahora usar datos mock
    // TODO: Implementar endpoint de horario completo en el backend
    this.horario = [
      {
        hora: '7:00 - 8:00',
        lunes: 'Matemáticas',
        martes: 'Español',
        miercoles: 'Ciencias',
        jueves: 'Inglés',
        viernes: 'Educación Física'
      },
      {
        hora: '8:00 - 9:00',
        lunes: 'Español',
        martes: 'Matemáticas',
        miercoles: 'Sociales',
        jueves: 'Ciencias',
        viernes: 'Artes'
      },
      {
        hora: '9:00 - 10:00',
        lunes: 'Ciencias',
        martes: 'Inglés',
        miercoles: 'Matemáticas',
        jueves: 'Español',
        viernes: 'Música'
      },
      {
        hora: '10:00 - 10:30',
        lunes: 'DESCANSO',
        martes: 'DESCANSO',
        miercoles: 'DESCANSO',
        jueves: 'DESCANSO',
        viernes: 'DESCANSO'
      },
      {
        hora: '10:30 - 11:30',
        lunes: 'Inglés',
        martes: 'Sociales',
        miercoles: 'Educación Física',
        jueves: 'Matemáticas',
        viernes: 'Ciencias'
      },
      {
        hora: '11:30 - 12:30',
        lunes: 'Sociales',
        martes: 'Educación Física',
        miercoles: 'Inglés',
        jueves: 'Artes',
        viernes: 'Español'
      }
    ];

    this.loading = false;
  }

  getDiaActual(): string {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[new Date().getDay()];
  }

  esDescanso(materia: string): boolean {
    return materia === 'DESCANSO';
  }
}