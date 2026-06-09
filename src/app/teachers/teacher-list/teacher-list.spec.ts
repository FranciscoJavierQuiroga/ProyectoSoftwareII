import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeacherList } from './teacher-list';

describe('TeacherList', () => {
  let component: TeacherList;
  let fixture: ComponentFixture<TeacherList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeacherList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeacherList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
