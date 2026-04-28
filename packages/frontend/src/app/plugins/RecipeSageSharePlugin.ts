export interface SharedRecipeData {
  url?: string;
  text?: string;
  images?: string[];
}

export interface RecipeSageSharePlugin {
  getSharedData(): Promise<{ data: string | null }>;
  clearSharedData(): Promise<void>;
  checkForSharedData(): Promise<{ hasData: boolean }>;
}
