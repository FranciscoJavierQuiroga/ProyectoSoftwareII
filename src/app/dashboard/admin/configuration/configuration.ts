import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './configuracion.html',
  styleUrls: ['./configuracion.css']
})
export class Configuracion {
  activeTab: 'institucion' | 'periodos' | 'evaluacion' | 'notificaciones' | 'seguridad' | 'personalizacion' | 'backup' = 'institucion';

  constructor(private router: Router) {}

  setTab(t: any) {
    this.activeTab = t;
  }

  goBack() {
    this.router.navigate(['/dashboard/admin']);
  }

  save() {
    // placeholder para guardar configuración
    console.log('Guardar cambios de configuración');
  }
}
