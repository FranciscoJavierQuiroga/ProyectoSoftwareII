import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GradeForm } from './grade-form';

describe('GradeForm', () => {
  let component: GradeForm;
  let fixture: ComponentFixture<GradeForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GradeForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GradeForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
