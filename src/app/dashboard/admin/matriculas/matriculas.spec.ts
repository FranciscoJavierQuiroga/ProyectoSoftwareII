import { TestBed } from '@angular/core/testing';
import { Matriculas } from './matriculas';

describe('Matriculas', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Matriculas]
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Matriculas);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });
});
