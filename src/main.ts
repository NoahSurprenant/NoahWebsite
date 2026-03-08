import { importProvidersFrom, provideZonelessChangeDetection } from "@angular/core";
import { BrowserModule, bootstrapApplication } from "@angular/platform-browser";
import { AppRoutingModule } from "./app/app-routing.module";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { NgxThreeModule } from "@noahsurprenant/ngx-three";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { AppComponent } from "./app/app.component";


bootstrapApplication(AppComponent, {
    providers: [
        importProvidersFrom(BrowserModule,
            AppRoutingModule,
            BrowserAnimationsModule,
            NgxThreeModule,
            FontAwesomeModule),
        provideZonelessChangeDetection()
    ]
})
  .catch(err => console.error(err));
