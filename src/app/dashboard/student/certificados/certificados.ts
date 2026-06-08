import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { HttpResponse } from '@angular/common/http';

interface Certificado {
  id: string;
  nombre: string;
  descripcion: string;
  icon: string;
  disponible: boolean;
}

@Component({
  selector: 'app-certificados',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './certificados.html',
  styleUrls: ['./certificados.css']
})
export default class CertificadosComponent implements OnInit {
  certificados: Certificado[] = [];
  loading = false;
  loadingCertificado: string | null = null;
  error: string | null = null;
  successMessage: string | null = null;
  profile: any = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.cargarDatos();
    this.inicializarCertificados();
  }

  cargarDatos() {
    this.api.getStudentProfile().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.profile = res.profile;
        }
      },
      error: (err: any) => {
        console.error('Error cargando perfil:', err);
      }
    });
  }

  inicializarCertificados() {
    this.certificados = [
      {
        id: 'estudio',
        nombre: 'Certificado de Estudio',
        descripcion: 'Certifica que el estudiante está matriculado actualmente en la institución',
        icon: '📄',
        disponible: true
      },
      {
        id: 'notas',
        nombre: 'Certificado de Notas',
        descripcion: 'Documento oficial con el historial académico completo del estudiante',
        icon: '📊',
        disponible: true
      },
      {
        id: 'conducta',
        nombre: 'Certificado de Conducta',
        descripcion: 'Certifica el comportamiento y disciplina del estudiante',
        icon: '⭐',
        disponible: true
      },
      {
        id: 'asistencia',
        nombre: 'Certificado de Asistencia',
        descripcion: 'Documento que certifica el porcentaje de asistencia a clases',
        icon: '✅',
        disponible: true
      }
    ];
  }

  descargarCertificado(tipo: string) {
    this.loadingCertificado = tipo;
    this.error = null;
    this.successMessage = null;

    console.log(`📥 Descargando certificado tipo: ${tipo}...`);

    this.api.downloadCertificado(tipo).subscribe({
      next: (response: HttpResponse<Blob>) => {
        this.loadingCertificado = null;
        const blob = response.body;
        
        if (blob) {
          // Crear URL temporal del blob
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `certificado_${tipo}_${new Date().getTime()}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          this.successMessage = `✅ Certificado de ${this.getNombreCertificado(tipo)} descargado exitosamente`;
          setTimeout(() => this.successMessage = null, 3000);
        }
      },
      error: (err: any) => {
        this.loadingCertificado = null;
        console.error('❌ Error al descargar certificado:', err);
        this.error = err.error?.error || 'Error al generar el certificado. Intenta nuevamente.';
      }
    });
  }

  getNombreCertificado(tipo: string): string {
    const cert = this.certificados.find(c => c.id === tipo);
    return cert ? cert.nombre : tipo;
  }

  isLoading(tipo: string): boolean {
    return this.loadingCertificado === tipo;
  }
}