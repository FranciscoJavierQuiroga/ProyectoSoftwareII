import { TestBed } from '@angular/core/testing';
import { Usuarios } from './usuarios';

describe('Usuarios', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Usuarios]
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Usuarios);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });
});
