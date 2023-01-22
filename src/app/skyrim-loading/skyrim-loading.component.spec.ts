import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkyrimLoadingComponent } from './skyrim-loading.component';

describe('SkyrimLoadingComponent', () => {
  let component: SkyrimLoadingComponent;
  let fixture: ComponentFixture<SkyrimLoadingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SkyrimLoadingComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SkyrimLoadingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
