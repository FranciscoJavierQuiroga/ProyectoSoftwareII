import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeacherCreate } from './teacher-create';

describe('TeacherCreate', () => {
  let component: TeacherCreate;
  let fixture: ComponentFixture<TeacherCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeacherCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeacherCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
