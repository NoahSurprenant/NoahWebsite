import { provideZoneChangeDetection, importProvidersFrom } from "@angular/core";
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';


import { BrowserModule, bootstrapApplication } from "@angular/platform-browser";
import { AppRoutingModule } from "./app/app-routing.module";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { NgxThreeModule } from "@noahsurprenant/ngx-three";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { AppComponent } from "./app/app.component";


bootstrapApplication(AppComponent, {
    providers: [importProvidersFrom(BrowserModule, AppRoutingModule, BrowserAnimationsModule, NgxThreeModule, FontAwesomeModule)]
})
  .catch(err => console.error(err));
