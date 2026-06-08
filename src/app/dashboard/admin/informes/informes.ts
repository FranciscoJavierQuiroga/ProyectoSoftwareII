import { TestBed } from '@angular/core/testing';
import { Informes } from './informes';

describe('Informes', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Informes]
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Informes);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });
});
