import {
  ChangeDetectorRef,
  DestroyRef,
  Directive,
  EmbeddedViewRef,
  Input,
  OnInit,
  TemplateRef,
  ViewContainerRef,
  inject,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FeatureFlagService } from "./FeatureFlagService";

/**
 * Plain Boolean(value) truthiness for any flag shape (boolean/variant/value
 * alike) — no valueType-specific branching. For variant-specific behavior,
 * use `flag$(key) | async` + *ngSwitch directly instead of this directive.
 */
@Directive({
  selector: "[ifFeature]",
  standalone: true,
})
export class IfFeatureDirective implements OnInit {
  @Input({ required: true }) ifFeature!: string;

  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly featureFlagService = inject(FeatureFlagService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private viewRef: EmbeddedViewRef<unknown> | null = null;

  ngOnInit(): void {
    this.featureFlagService
      .flag$(this.ifFeature)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((flag) => {
        const show = Boolean(flag.value);
        if (show && !this.viewRef) {
          this.viewRef = this.viewContainerRef.createEmbeddedView(this.templateRef);
        } else if (!show && this.viewRef) {
          this.viewContainerRef.clear();
          this.viewRef = null;
        }
        this.changeDetectorRef.markForCheck();
      });
  }
}
