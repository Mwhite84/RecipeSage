import { Injectable } from "@angular/core";
import type {
  RecipeSageSharePlugin,
  SharedRecipeData,
} from "./RecipeSageSharePlugin";

@Injectable({
  providedIn: "root",
})
export class RecipeSageSharePluginWeb implements RecipeSageSharePlugin {
  async getSharedData(): Promise<{ data: string | null }> {
    // Check for data in window object (set by AppDelegate)
    const sharedData = (window as any).recipeSageSharedData;
    if (sharedData) {
      // Clear it after reading
      delete (window as any).recipeSageSharedData;
      return { data: sharedData };
    }
    return { data: null };
  }

  async clearSharedData(): Promise<void> {
    delete (window as any).recipeSageSharedData;
  }

  async checkForSharedData(): Promise<{ hasData: boolean }> {
    return { hasData: !!(window as any).recipeSageSharedData };
  }
}
