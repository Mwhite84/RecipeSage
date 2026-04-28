import { Injectable } from "@angular/core";
import { Capacitor, registerPlugin } from "@capacitor/core";
import type {
  RecipeSageSharePlugin,
  SharedRecipeData,
} from "./RecipeSageSharePlugin";

// Register the plugin
const RecipeSageShare = registerPlugin<RecipeSageSharePlugin>(
  "RecipeSageShare",
  {
    web: () =>
      import("./RecipeSageSharePlugin.web").then(
        (m) => new m.RecipeSageSharePluginWeb(),
      ),
  },
);

export { RecipeSageShare };
export type { SharedRecipeData };
