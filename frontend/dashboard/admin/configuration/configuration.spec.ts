import { TestBed } from '@angular/core/testing';
import { Configuracion } from './configuracion';

describe('Configuracion', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Configuracion]
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Configuracion);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });
});
