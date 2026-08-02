import { Injectable, inject, NgZone, OnDestroy } from "@angular/core";
import { Router } from "@angular/router";
import {
  Platform,
  ToastController,
  ModalController,
} from "@ionic/angular/standalone";
import { Capacitor } from "@capacitor/core";
import { Subscription } from "rxjs";
import { ServerActionsService } from "./server-actions.service";
import { LoadingService } from "./loading.service";
import { EditRecipePage } from "../pages/recipe-components/edit-recipe/edit-recipe.page";
import {
  RecipeSageShare,
  SharedRecipeData,
} from "../plugins/RecipeSageSharePlugin.module";

// Dynamic import for native-only module
let App: any;
if (Capacitor.isNativePlatform()) {
  import("@capacitor/app").then((module) => {
    App = module.App;
  });
}

interface SharePluginData {
  url?: string;
  text?: string;
  images?: string[];
  timestamp: number;
  source: string;
}

@Injectable({
  providedIn: "root",
})
export class ShareHandlerService implements OnDestroy {
  private router = inject(Router);
  private platform = inject(Platform);
  private serverActionsService = inject(ServerActionsService);
  private loadingService = inject(LoadingService);
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);
  private ngZone = inject(NgZone);

  private appStateSubscription?: Subscription;
  private isHandlingShare = false;

  constructor() {
    this.initializeShareHandler();
  }

  ngOnDestroy(): void {
    this.appStateSubscription?.unsubscribe();
  }

  private async initializeShareHandler(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      // Also check for web-based sharing via URL params
      this.checkForWebShareData();
      return;
    }

    // Wait for App module to be loaded
    if (!App) {
      const module = await import("@capacitor/app");
      App = module.App;
    }

    // Listen for app resume events (when returning from share extension)
    App.addListener("appStateChange", ({ isActive }: { isActive: boolean }) => {
      if (isActive) {
        // Small delay to allow the native layer to process
        setTimeout(() => this.checkForSharedData(), 500);
      }
    });

    // Listen for custom event from native layer (backup mechanism)
    window.addEventListener("recipeSageSharedData", (event: any) => {
      if (event.detail) {
        this.handleSharedJsonData(event.detail);
      }
    });

    // Check on initial load
    this.platform.ready().then(() => {
      // Delay to ensure native bridge is ready
      setTimeout(() => this.checkForSharedData(), 1000);
    });
  }

  /**
   * Check for share data passed via URL (for web/PWA)
   */
  private checkForWebShareData(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const shareUrl = urlParams.get("shareUrl");

    if (shareUrl) {
      const data: SharePluginData = {
        url: shareUrl,
        timestamp: Date.now(),
        source: "web",
      };
      this.handleSharedData(data);

      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }

  private async checkForSharedData(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (this.isHandlingShare) return;

    // Ensure App module is loaded
    if (!App) {
      const module = await import("@capacitor/app");
      App = module.App;
    }

    try {
      // First, try the Capacitor plugin
      const result = await RecipeSageShare.getSharedData();

      if (result.data) {
        await this.handleSharedJsonData(result.data);
        return;
      }

      // Fallback: check URL parameters for deep link
      const { url } = await App.getLaunchUrl();
      if (url) {
        await this.handleDeepLink(url);
      }
    } catch (error) {
      console.error("Error checking for shared data:", error);
    }
  }

  private async handleDeepLink(url: string): Promise<void> {
    if (!url.includes("recipesage://")) return;

    try {
      const urlObj = new URL(url);
      const recipeUrl = urlObj.searchParams.get("url");
      const text = urlObj.searchParams.get("text");

      if (recipeUrl || text) {
        const data: SharePluginData = {
          url: recipeUrl || undefined,
          text: text || undefined,
          timestamp: Date.now(),
          source: "deepLink",
        };
        await this.handleSharedData(data);
      }
    } catch (error) {
      console.error("Error handling deep link:", error);
    }
  }

  private async handleSharedJsonData(jsonString: string): Promise<void> {
    try {
      const data = JSON.parse(jsonString) as SharePluginData;
      await this.handleSharedData(data);
    } catch (error) {
      console.error("Error parsing shared data:", error);
    }
  }

  private async handleSharedData(data: SharePluginData): Promise<void> {
    if (this.isHandlingShare) return;
    this.isHandlingShare = true;

    this.ngZone.run(async () => {
      const loading = this.loadingService.start();

      try {
        if (data.url) {
          // Try to clip from URL first
          await this.importFromUrl(data.url, data.text);
        } else if (data.text) {
          // Try to extract URL from text
          const urlFromText = this.extractUrlFromText(data.text);
          if (urlFromText) {
            await this.importFromUrl(urlFromText, data.text);
          } else {
            // No URL found, show error
            this.showErrorToast(
              "No recipe URL found. Please share a URL from a recipe website.",
            );
          }
        } else if (data.images && data.images.length > 0) {
          // Import from images (OCR)
          await this.importFromImages(data.images);
        } else {
          this.showErrorToast("No recipe data found to import.");
        }
      } catch (error) {
        console.error("Error handling shared data:", error);
        this.showErrorToast("Failed to import recipe. Please try again.");
      } finally {
        loading.dismiss();
        this.isHandlingShare = false;
        // Clear shared data
        try {
          await RecipeSageShare.clearSharedData();
        } catch (e) {
          // Ignore clear errors
        }
      }
    });
  }

  private extractUrlFromText(text: string): string | null {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    const matches = text.match(urlRegex);
    return matches?.[0] || null;
  }

  private async importFromUrl(url: string, caption?: string): Promise<void> {
    try {
      // Upstream's ml.clipFromUrl returns the recipe directly, or undefined on failure
      const recipe = await this.serverActionsService.ml.clipFromUrl({
        url,
      });

      if (recipe) {
        // Open edit recipe page with the imported data
        const modal = await this.modalCtrl.create({
          component: EditRecipePage,
          componentProps: {
            recipe,
            isImport: true,
          },
        });

        await modal.present();

        // Show success toast
        const toast = await this.toastCtrl.create({
          message: "Recipe imported successfully!",
          duration: 3000,
          position: "bottom",
          color: "success",
        });
        await toast.present();
      } else {
        this.showErrorToast(
          "Could not extract recipe from this URL. Try manual entry.",
        );
      }
    } catch (error) {
      console.error("Error importing from URL:", error);
      this.showErrorToast(
        "Failed to import recipe. Please check your connection and try again.",
      );
    }
  }

  private async importFromImages(base64Images: string[]): Promise<void> {
    // Convert base64 to files
    const imageFiles: File[] = base64Images.map((base64, index) => {
      // Handle both standard base64 and data URL format
      let base64Data = base64;
      if (base64.includes(",")) {
        base64Data = base64.split(",")[1];
      }

      const byteString = atob(base64Data);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new File([ab], `shared-image-${index}.jpg`, {
        type: "image/jpeg",
      });
    });

    // Navigate to import images page with preloaded images
    await this.router.navigate(["/settings/import/images"], {
      state: { preloadedImages: imageFiles },
    });

    // Show info toast
    const toast = await this.toastCtrl.create({
      message: `${imageFiles.length} image(s) ready for OCR import`,
      duration: 3000,
      position: "bottom",
      color: "primary",
    });
    await toast.present();
  }

  private async showErrorToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      position: "bottom",
      color: "danger",
      buttons: [
        {
          text: "Dismiss",
          role: "cancel",
        },
      ],
    });
    await toast.present();
  }
}
