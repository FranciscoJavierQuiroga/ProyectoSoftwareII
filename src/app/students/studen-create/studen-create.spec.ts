import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudenCreate } from './studen-create';

describe('StudenCreate', () => {
  let component: StudenCreate;
  let fixture: ComponentFixture<StudenCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudenCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudenCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
