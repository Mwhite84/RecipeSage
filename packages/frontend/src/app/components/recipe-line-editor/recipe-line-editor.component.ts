import {
  Component,
  ElementRef,
  Input,
  computed,
  effect,
  forwardRef,
  inject,
  signal,
  viewChildren,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import { IonIcon } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import {
  addOutline,
  bookmarkOutline,
  removeCircleOutline,
} from "ionicons/icons";

/**
 * One editable row. `text` is the *display* text - for a header row the
 * surrounding square brackets are stripped and re-added on serialize.
 */
export interface RecipeLine {
  id: string;
  text: string;
  isHeader: boolean;
}

let nextId = 0;

// Mirrors packages/util/shared/src/parsers.ts. A line ending in a backslash is
// a *continuation*: the newline after it does not start a new ingredient/step,
// so the row model must not split there either. The feature detection matches
// the canonical parser's (older Safari lacks lookbehind).
let supportsNegativeLookahead = true;
try {
  new RegExp("(?<!\\\\)\\n");
} catch (_e) {
  supportsNegativeLookahead = false;
}
const LINE_SPLIT_REGEXP = supportsNegativeLookahead ? /(?<!\\)\r?\n/ : /\r?\n/;

/** Same shape the canonical parser and the format toolbar both agree on. */
const HEADER_REGEXP = /^\[.*\]$/;

/** A markdown table row, as emitted by recipe-format-toolbar's `table` action. */
const TABLE_ROW_REGEXP = /^\s*\|.*\|\s*$/;

/**
 * Row-per-line editor for a recipe's ingredients or instructions.
 *
 * It is a *sibling* of upstream's `<text-area>` + `<recipe-format-toolbar>`,
 * not a replacement: both read and write the exact same newline-delimited
 * string, so switching between them round-trips losslessly and neither has to
 * know the other exists.
 */
@Component({
  standalone: true,
  selector: "recipe-line-editor",
  templateUrl: "recipe-line-editor.component.html",
  styleUrls: ["recipe-line-editor.component.scss"],
  imports: [TranslatePipe, IonIcon],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RecipeLineEditorComponent),
      multi: true,
    },
  ],
})
export class RecipeLineEditorComponent implements ControlValueAccessor {
  private translate = inject(TranslateService);

  /** Drives placeholders, empty-state copy, and step numbering. */
  @Input() variant: "ingredients" | "instructions" = "ingredients";
  @Input() ariaLabel?: string;
  @Input() disabled = false;

  readonly lines = signal<RecipeLine[]>([]);

  private readonly lineInputs =
    viewChildren<ElementRef<HTMLTextAreaElement>>("lineInput");
  private readonly pendingFocusId = signal<string | null>(null);

  /**
   * Step number per non-header row, resetting at every section header - which
   * is what `parseInstructions` in @recipesage/util/shared does, so the numbers
   * shown here match the numbers the recipe page renders.
   */
  readonly stepNumbers = computed(() => {
    const map = new Map<string, number>();
    let count = 0;
    for (const line of this.lines()) {
      if (line.isHeader) {
        count = 0;
        continue;
      }
      map.set(line.id, ++count);
    }
    return map;
  });

  readonly hasTable = computed(() =>
    this.lines().some((line) => TABLE_ROW_REGEXP.test(line.text)),
  );

  /**
   * True while the bound value serializes to "". Drives the helper copy, which
   * sits *above* the seeded blank row rather than replacing it. Kept as its own
   * signal because row text is mutated in place and would not invalidate a
   * computed over `lines()`.
   */
  readonly isEmpty = signal(true);

  /** The last string this component pushed out, used to ignore its own echo. */
  private lastEmitted = "";

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    addIcons({ addOutline, bookmarkOutline, removeCircleOutline });

    effect(() => {
      const els = this.lineInputs();
      const lines = this.lines();

      for (const ref of els) this.autoGrow(ref.nativeElement);

      const focusId = this.pendingFocusId();
      if (!focusId) return;

      const idx = lines.findIndex((line) => line.id === focusId);
      const el = els[idx]?.nativeElement;
      if (!el) return;

      this.pendingFocusId.set(null);
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
  }

  // ─── ControlValueAccessor ──────────────────────────────────────────────────

  writeValue(value: string | null) {
    const raw = value ?? "";
    // Our own emission coming back around - re-parsing would throw away row
    // identity and therefore focus mid-keystroke. The length check lets the
    // very first write of "" through so the blank row gets seeded.
    if (raw === this.lastEmitted && this.lines().length) return;
    this.lastEmitted = raw;
    this.isEmpty.set(raw === "");
    // Seeding happens here, NOT through emit() - an untouched editor must not
    // call onChange and therefore must not mark the recipe dirty.
    this.lines.set(this.withAtLeastOneRow(this.parseLines(raw)));
  }

  registerOnChange(fn: (value: string) => void) {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void) {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean) {
    this.disabled = isDisabled;
  }

  // ─── Translation keys (variant-dependent) ──────────────────────────────────

  readonly sectionPlaceholderKey =
    "components.recipeLineEditor.sectionPlaceholder";

  get itemPlaceholderKey(): string {
    return this.variant === "instructions"
      ? "components.recipeLineEditor.instructionPlaceholder"
      : "components.recipeLineEditor.ingredientPlaceholder";
  }

  get emptyKey(): string {
    return this.variant === "instructions"
      ? "components.recipeLineEditor.empty.instructions"
      : "components.recipeLineEditor.empty.ingredients";
  }

  get addItemKey(): string {
    return this.variant === "instructions"
      ? "components.recipeLineEditor.addStep"
      : "components.recipeLineEditor.addIngredient";
  }

  // ─── Row rendering helpers ─────────────────────────────────────────────────

  isTableLine(line: RecipeLine): boolean {
    return TABLE_ROW_REGEXP.test(line.text);
  }

  // ─── Row interactions ──────────────────────────────────────────────────────

  onInput(line: RecipeLine, event: Event) {
    const el = event.target as HTMLTextAreaElement;
    line.text = el.value;
    this.autoGrow(el);
    this.emit();
  }

  onBlur() {
    this.onTouched();
  }

  /** Enter splits to a fresh row rather than inserting a newline in this one. */
  onEnter(event: Event, id: string) {
    event.preventDefault();
    this.insertAfter(id, "", false);
  }

  /**
   * Backspace on an *already empty* row deletes it and moves focus back. It
   * deliberately does not merge two non-empty rows.
   */
  onBackspace(event: Event, id: string) {
    const el = event.target as HTMLTextAreaElement;
    if (el.value !== "") return;
    event.preventDefault();
    this.removeLine(id);
  }

  /**
   * Multi-line paste explosion: pasting a block of text from a cookbook, a
   * website, or the Text-mode textarea fills one row per line, honouring
   * `[Section]` syntax and backslash continuations.
   */
  onPaste(event: ClipboardEvent, id: string) {
    const text = event.clipboardData?.getData("text") ?? "";
    const segments = text
      .split(LINE_SPLIT_REGEXP)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    // A single-line paste is an ordinary inline paste - let the browser do it.
    if (segments.length <= 1) return;
    event.preventDefault();

    const lines = [...this.lines()];
    const idx = lines.findIndex((line) => line.id === id);
    const inserted = segments.map((segment) => this.toLine(segment));

    if (idx >= 0 && lines[idx].text === "") {
      lines.splice(idx, 1, ...inserted);
    } else if (idx >= 0) {
      lines.splice(idx + 1, 0, ...inserted);
    } else {
      lines.push(...inserted);
    }

    this.lines.set(lines);
    this.emit();
    this.pendingFocusId.set(inserted[inserted.length - 1].id);
  }

  removeLine(id: string) {
    const lines = [...this.lines()];
    const idx = lines.findIndex((line) => line.id === id);
    if (idx < 0) return;

    // The editor always keeps one focusable row, so removing the only row
    // clears it in place. Reusing the id keeps @for's DOM node - and therefore
    // the caret - alive; dropping to zero rows would take the target away.
    if (lines.length === 1) {
      if (lines[0].text === "" && !lines[0].isHeader) return;
      lines[0] = { ...lines[0], text: "", isHeader: false };
      this.lines.set(lines);
      this.emit();
      return;
    }

    lines.splice(idx, 1);
    this.lines.set(lines);
    this.emit();

    const previous = lines[idx - 1];
    if (previous) this.pendingFocusId.set(previous.id);
  }

  addItem() {
    this.insertAfter(undefined, "", false);
  }

  addSection() {
    this.insertAfter(
      undefined,
      this.translate.instant("components.recipeLineEditor.newSection"),
      true,
    );
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private insertAfter(
    afterId: string | undefined,
    text: string,
    isHeader: boolean,
  ) {
    const lines = [...this.lines()];
    const newLine: RecipeLine = { id: `rle-${nextId++}`, text, isHeader };

    const idx = afterId ? lines.findIndex((line) => line.id === afterId) : -1;
    if (idx >= 0) {
      lines.splice(idx + 1, 0, newLine);
    } else {
      lines.push(newLine);
    }

    this.lines.set(lines);
    this.emit();
    this.pendingFocusId.set(newLine.id);
  }

  private toLine(raw: string): RecipeLine {
    const trimmed = raw.trim();
    const isHeader = HEADER_REGEXP.test(trimmed);
    return {
      id: `rle-${nextId++}`,
      // Non-header text is kept verbatim so ordinary lines round-trip exactly.
      text: isHeader ? trimmed.slice(1, -1) : raw,
      isHeader,
    };
  }

  private parseLines(raw: string): RecipeLine[] {
    if (!raw) return [];
    return raw.split(LINE_SPLIT_REGEXP).map((line) => this.toLine(line));
  }

  /**
   * An empty value gets one blank row rather than a button-only empty state,
   * so a brand-new recipe has something to type or paste into immediately.
   * A single blank row serializes back to "" exactly, so this adds no content.
   */
  private withAtLeastOneRow(lines: RecipeLine[]): RecipeLine[] {
    if (lines.length) return lines;
    return [{ id: `rle-${nextId++}`, text: "", isHeader: false }];
  }

  private serialize(lines: RecipeLine[]): string {
    return lines
      .map((line) => (line.isHeader ? `[${line.text}]` : line.text))
      .join("\n");
  }

  private emit() {
    const raw = this.serialize(this.lines());
    this.lastEmitted = raw;
    this.isEmpty.set(raw === "");
    this.onChange(raw);
  }

  private autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }
}
