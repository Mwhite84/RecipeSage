import { Injectable, inject, OnDestroy } from "@angular/core";
import { PreferencesService } from "./preferences.service";

export interface RecipeDraft {
  // Core recipe fields
  title: string;
  description: string;
  yield: string;
  activeTime: string;
  totalTime: string;
  source: string;
  url: string;
  notes: string;
  ingredients: string;
  instructions: string;
  rating: number | null;
  lastMadeAt: string;

  // Related data
  imageIds: string[];
  labelIds: string[];
  linkedRecipeIds: string[];

  // Metadata
  savedAt: number;
  recipeId?: string; // undefined for new recipes
}

const DRAFT_LOCALSTORAGE_KEY_PREFIX = "recipe-draft-";
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const AUTOSAVE_DEBOUNCE_MS = 2000; // 2 seconds

@Injectable({
  providedIn: "root",
})
export class RecipeDraftService implements OnDestroy {
  private preferencesService = inject(PreferencesService);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    this.cancelPendingSave();
  }

  /**
   * Get the storage key for a draft
   * For new recipes: "recipe-draft-new"
   * For existing recipes: "recipe-draft-{recipeId}"
   */
  private getDraftKey(recipeId?: string): string {
    return `${DRAFT_LOCALSTORAGE_KEY_PREFIX}${recipeId || "new"}`;
  }

  /**
   * Check if autosave is enabled (can be disabled via preferences in the future)
   */
  isAutosaveEnabled(): boolean {
    // Could add a preference check here in the future
    return true;
  }

  /**
   * Save a draft to localStorage
   */
  saveDraft(draft: Omit<RecipeDraft, "savedAt">, recipeId?: string): void {
    if (!this.isAutosaveEnabled()) return;

    const draftWithTimestamp: RecipeDraft = {
      ...draft,
      savedAt: Date.now(),
    };

    try {
      const serialized = JSON.stringify(draftWithTimestamp);
      localStorage.setItem(this.getDraftKey(recipeId), serialized);
    } catch (e: any) {
      if (e.name === "QuotaExceededError") {
        console.warn("Draft not saved: localStorage quota exceeded");
        // Silently fail - draft won't be persisted but app continues working
      } else {
        console.error("Failed to save recipe draft:", e);
      }
    }
  }

  /**
   * Get a draft from localStorage
   * Returns null if no draft exists or if it's expired
   */
  getDraft(recipeId?: string): RecipeDraft | null {
    const key = this.getDraftKey(recipeId);

    try {
      const serialized = localStorage.getItem(key);
      if (!serialized) return null;

      const draft: RecipeDraft = JSON.parse(serialized);

      // Check if draft is expired
      if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
        this.clearDraft(recipeId);
        return null;
      }

      return draft;
    } catch (e) {
      console.error("Failed to load recipe draft:", e);
      return null;
    }
  }

  /**
   * Check if a draft exists and is valid
   */
  hasDraft(recipeId?: string): boolean {
    return this.getDraft(recipeId) !== null;
  }

  /**
   * Clear a draft from localStorage
   */
  clearDraft(recipeId?: string): void {
    const key = this.getDraftKey(recipeId);

    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error("Failed to clear recipe draft:", e);
    }
  }

  /**
   * Debounced save - useful for autosave on form changes
   * Call this on every input change, and it will save after the debounce period
   */
  debouncedSave(
    draft: Omit<RecipeDraft, "savedAt">,
    recipeId?: string,
    onSave?: () => void,
  ): void {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    this.debounceTimer = setTimeout(() => {
      this.saveDraft(draft, recipeId);
      this.debounceTimer = null;
      onSave?.();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  /**
   * Cancel any pending debounced save
   */
  cancelPendingSave(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Immediately save without debouncing
   * Useful when navigating away or before critical operations
   */
  immediateSave(draft: Omit<RecipeDraft, "savedAt">, recipeId?: string): void {
    this.cancelPendingSave();
    this.saveDraft(draft, recipeId);
  }

  /**
   * Get the age of a draft in milliseconds
   */
  getDraftAge(recipeId?: string): number | null {
    const draft = this.getDraft(recipeId);
    if (!draft) return null;
    return Date.now() - draft.savedAt;
  }

  /**
   * Format draft age for display (e.g., "2 minutes ago", "1 hour ago")
   */
  formatDraftAge(recipeId?: string): string | null {
    const age = this.getDraftAge(recipeId);
    if (age === null) return null;

    const seconds = Math.floor(age / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    return "just now";
  }

  /**
   * Clean up all expired drafts
   * Can be called periodically (e.g., on app startup)
   */
  cleanupExpiredDrafts(): void {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(DRAFT_LOCALSTORAGE_KEY_PREFIX)) {
          try {
            const serialized = localStorage.getItem(key);
            if (serialized) {
              const draft: RecipeDraft = JSON.parse(serialized);
              if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
                localStorage.removeItem(key);
              }
            }
          } catch (e) {
            // Invalid draft, remove it
            localStorage.removeItem(key);
          }
        }
      }
    } catch (e) {
      console.error("Failed to cleanup expired drafts:", e);
    }
  }

  /**
   * Get all draft keys (useful for debugging or migration)
   */
  getAllDraftKeys(): string[] {
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(DRAFT_LOCALSTORAGE_KEY_PREFIX)) {
          keys.push(key);
        }
      }
    } catch (e) {
      console.error("Failed to get draft keys:", e);
    }
    return keys;
  }

  /**
   * Check if a draft has meaningful content (at least 10 characters in any field)
   * or has associations (images, labels, linked recipes)
   */
  draftHasContent(draft: RecipeDraft): boolean {
    const minContentLength = 10;

    const contentFields = [
      draft.title,
      draft.description,
      draft.ingredients,
      draft.instructions,
      draft.notes,
    ];

    const hasMeaningfulContent = contentFields.some(
      (field) => field && field.trim().length >= minContentLength,
    );

    const hasAssociations = !!(
      draft.imageIds?.length ||
      draft.labelIds?.length ||
      draft.linkedRecipeIds?.length
    );

    return hasMeaningfulContent || hasAssociations;
  }
}
